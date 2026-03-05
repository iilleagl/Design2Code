#!/usr/bin/env node
/**
 * Pencil Component Copy MCP Server
 * 用于在不同 .pen 文件之间复制组件的 MCP 服务
 * 
 * 修复：
 * 1. 使用文件锁防止并行写入冲突
 * 2. 支持批量复制多个组件（单次调用）
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { exec, execSync } from "child_process";

// 文件锁管理
const fileLocks = new Map();
const lockQueue = new Map();

async function acquireLock(filePath) {
  const normalizedPath = path.resolve(filePath);
  
  // 如果已有锁，等待
  while (fileLocks.has(normalizedPath)) {
    await new Promise(resolve => {
      if (!lockQueue.has(normalizedPath)) {
        lockQueue.set(normalizedPath, []);
      }
      lockQueue.get(normalizedPath).push(resolve);
    });
  }
  
  // 获取锁
  fileLocks.set(normalizedPath, true);
}

function releaseLock(filePath) {
  const normalizedPath = path.resolve(filePath);
  fileLocks.delete(normalizedPath);
  
  // 唤醒等待的进程
  const queue = lockQueue.get(normalizedPath);
  if (queue && queue.length > 0) {
    const next = queue.shift();
    if (queue.length === 0) {
      lockQueue.delete(normalizedPath);
    }
    next();
  }
}

// 生成唯一 ID
function generateId(length = 5) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 读取 .pen 文件
function readPenFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

// 写入 .pen 文件（原子写入：先写临时文件再 rename，触发更可靠的文件变更检测）
function writePenFile(filePath, data) {
  const content = JSON.stringify(data, null, 2);
  const tmpPath = filePath + ".tmp";
  fs.writeFileSync(tmpPath, content);
  fs.renameSync(tmpPath, filePath);
}

// 更新文件修改时间，触发 Cursor 检测「文件已在磁盘上更改」
function touchFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`文件不存在: ${resolved}`);
  }
  const now = Date.now() / 1000;
  fs.utimesSync(resolved, now, now);
}

// 查找 Cursor CLI 路径
function findCursorCli() {
  const absolutePaths = [
    "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    path.join(process.env.HOME || "", ".cursor", "bin", "cursor"),
  ];
  for (const p of absolutePaths) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }

  const bareCommands = ["cursor", "code"];
  for (const cmd of bareCommands) {
    try {
      execSync(`which ${cmd}`, { stdio: "ignore", timeout: 3000 });
      return cmd;
    } catch (_) {}
  }

  return null;
}

let cachedCli = undefined;
function getCursorCli() {
  if (cachedCli === undefined) cachedCli = findCursorCli();
  return cachedCli;
}

// 执行多行 AppleScript（仅 macOS），通过 stdin 传入脚本
function runAppleScript(script, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const child = exec("osascript -", { timeout }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
    child.stdin.write(script);
    child.stdin.end();
  });
}

// 触发 Cursor 编辑器重新加载文件
// 策略：先通过 cursor CLI 聚焦文件标签页，再通过 osascript 关闭标签页，最后重新打开
function triggerEditorReload(filePath) {
  const absPath = path.resolve(filePath);
  const cli = getCursorCli();

  if (!cli) {
    console.error("No cursor/code CLI found, skip editor reload");
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    // Step 1: 聚焦文件标签页
    exec(`"${cli}" --reuse-window "${absPath}"`, { timeout: 5000 }, (err) => {
      if (err) {
        console.error("Failed to focus file:", err.message);
        resolve(false);
        return;
      }

      if (process.platform !== "darwin") {
        resolve(true);
        return;
      }

      // Step 2: macOS - 关闭当前标签页（刚聚焦的那个）
      setTimeout(() => {
        const closeScript =
          'tell application "System Events" to tell process "Cursor" to keystroke "w" using {command down}';
        exec(`osascript -e '${closeScript}'`, { timeout: 5000 }, () => {
          // Step 3: 重新打开文件，Pencil 将从磁盘加载
          setTimeout(() => {
            exec(
              `"${cli}" --reuse-window "${absPath}"`,
              { timeout: 5000 },
              (err2) => resolve(!err2)
            );
          }, 300);
        });
      }, 800);
    });
  });
}

// 递归收集所有元素
function collectAllElements(node, elements = new Map(), parentPath = "") {
  if (!node) return elements;

  const currentPath = parentPath
    ? `${parentPath} > ${node.name || node.id}`
    : node.name || node.id || "root";

  if (node.id) {
    elements.set(node.id, {
      element: node,
      path: currentPath,
      reusable: node.reusable === true,
    });
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectAllElements(child, elements, currentPath);
    }
  }

  if (Array.isArray(node)) {
    for (const child of node) {
      collectAllElements(child, elements, parentPath);
    }
  }

  return elements;
}

// 收集元素的所有引用依赖
function collectRefDependencies(element, allElements, collected = new Set()) {
  if (!element) return collected;

  if (element.type === "ref" && element.ref) {
    if (!collected.has(element.ref)) {
      collected.add(element.ref);
      const refElement = allElements.get(element.ref);
      if (refElement) {
        collectRefDependencies(refElement.element, allElements, collected);
      }
    }
  }

  if (Array.isArray(element.children)) {
    for (const child of element.children) {
      collectRefDependencies(child, allElements, collected);
    }
  }

  if (Array.isArray(element.slot)) {
    for (const slotId of element.slot) {
      if (!collected.has(slotId)) {
        collected.add(slotId);
        const slotElement = allElements.get(slotId);
        if (slotElement) {
          collectRefDependencies(slotElement.element, allElements, collected);
        }
      }
    }
  }

  return collected;
}

// 收集元素使用的所有变量
function collectVariables(element, variables = new Set()) {
  if (!element) return variables;

  const checkValue = (value) => {
    if (typeof value === "string" && value.startsWith("$")) {
      variables.add(value.slice(1));
    } else if (Array.isArray(value)) {
      value.forEach((v) => checkValue(v));
    } else if (typeof value === "object" && value !== null) {
      Object.values(value).forEach((v) => checkValue(v));
    }
  };

  for (const [key, value] of Object.entries(element)) {
    if (key === "children") {
      if (Array.isArray(value)) {
        value.forEach((child) => collectVariables(child, variables));
      }
    } else {
      checkValue(value);
    }
  }

  return variables;
}

// 深度克隆并重新生成 ID
function cloneWithNewIds(element, idMap = new Map()) {
  if (!element) return { clone: null, idMap };

  const clone = JSON.parse(JSON.stringify(element));

  function regenerateIds(node) {
    if (!node) return;

    if (node.id) {
      const newId = generateId();
      idMap.set(node.id, newId);
      node.id = newId;
    }

    if (Array.isArray(node.children)) {
      node.children.forEach((child) => regenerateIds(child));
    }
  }

  regenerateIds(clone);

  return { clone, idMap };
}

// 更新克隆元素中的引用
function updateRefs(element, idMap) {
  if (!element) return;

  if (element.ref && idMap.has(element.ref)) {
    element.ref = idMap.get(element.ref);
  }

  if (Array.isArray(element.slot)) {
    element.slot = element.slot.map((id) => (idMap.has(id) ? idMap.get(id) : id));
  }

  if (element.descendants) {
    const newDescendants = {};
    for (const [oldId, value] of Object.entries(element.descendants)) {
      const newId = idMap.has(oldId) ? idMap.get(oldId) : oldId;
      newDescendants[newId] = value;
    }
    element.descendants = newDescendants;
  }

  if (Array.isArray(element.children)) {
    element.children.forEach((child) => updateRefs(child, idMap));
  }
}

// ==========================================
// batch_design 方式复制组件的辅助函数
// ==========================================

// 递归移除节点树中所有 id 字段
function stripIdsFromNode(node) {
  if (!node || typeof node !== "object") return node;
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "id") continue;
    if (key === "children" && Array.isArray(value)) {
      result.children = value.map((child) => stripIdsFromNode(child));
    } else {
      result[key] = value;
    }
  }
  return result;
}

// 将节点数据序列化为 batch_design 的 JS 表达式
// refMap: Map<原始ID, 绑定变量名> —— 将 ref/slot 中的旧 ID 替换为绑定变量
function toJsExpression(obj, refMap) {
  if (obj === null || obj === undefined) return "null";
  if (typeof obj === "boolean" || typeof obj === "number") return String(obj);
  if (typeof obj === "string") return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return "[" + obj.map((v) => toJsExpression(v, refMap)).join(", ") + "]";
  }
  const parts = [];
  for (const [k, v] of Object.entries(obj)) {
    let val;
    if (k === "ref" && typeof v === "string" && refMap.has(v)) {
      val = refMap.get(v);
    } else if (k === "slot" && Array.isArray(v)) {
      val =
        "[" +
        v
          .map((s) =>
            typeof s === "string" && refMap.has(s)
              ? refMap.get(s)
              : JSON.stringify(s)
          )
          .join(", ") +
        "]";
    } else if (k === "children" && Array.isArray(v)) {
      val = "[" + v.map((c) => toJsExpression(c, refMap)).join(", ") + "]";
    } else {
      val = toJsExpression(v, refMap);
    }
    parts.push(`${JSON.stringify(k)}: ${val}`);
  }
  return "{" + parts.join(", ") + "}";
}

// 准备 batch_design 操作：读取源文件，生成 Insert 操作字符串
function prepareBatchCopyOps(srcPath, componentIds) {
  const srcData = readPenFile(srcPath);
  const srcElements = collectAllElements(srcData.children);

  const requestedIds = new Set(componentIds);
  const allIds = new Set();
  const missingIds = [];

  for (const id of componentIds) {
    if (srcElements.has(id)) {
      allIds.add(id);
      collectRefDependencies(srcElements.get(id).element, srcElements).forEach(
        (d) => allIds.add(d)
      );
    } else {
      missingIds.push(id);
    }
  }

  if (allIds.size === 0) throw new Error("没有找到任何可复制的组件");

  const depIds = [...allIds].filter((id) => !requestedIds.has(id));
  const mainIds = [...allIds].filter((id) => requestedIds.has(id));

  // 旧 ID → 绑定变量名
  const refMap = new Map();
  depIds.forEach((id, i) => refMap.set(id, `dep${i}`));
  mainIds.forEach((id, i) => refMap.set(id, `comp${i}`));

  // 按顺序生成操作：依赖先于主组件
  const ops = [];
  for (const id of [...depIds, ...mainIds]) {
    const el = srcElements.get(id).element;
    const clean = stripIdsFromNode(el);
    ops.push(`${refMap.get(id)}=I(document, ${toJsExpression(clean, refMap)})`);
  }

  // 收集变量
  const requiredVars = new Set();
  for (const id of allIds) {
    collectVariables(srcElements.get(id).element, requiredVars);
  }
  const srcVars = extractVariables(srcData);
  const vars = {};
  for (const v of requiredVars) {
    if (srcVars[v]) vars[v] = srcVars[v];
  }

  return {
    operations: ops.join("\n"),
    variables: vars,
    componentCount: mainIds.length,
    dependencyCount: depIds.length,
    missingIds,
    copiedComponents: mainIds.map((id) => ({
      originalId: id,
      binding: refMap.get(id),
      name: srcElements.get(id).element.name || "(unnamed)",
    })),
  };
}

// 提取变量定义
function extractVariables(penData) {
  const variables = {};
  for (const [key, value] of Object.entries(penData)) {
    if (key.startsWith("--")) {
      variables[key] = value;
    }
  }
  return variables;
}

// 列出组件
function listComponents(penData, showAll = false) {
  const allElements = collectAllElements(penData.children);

  const components = [];
  for (const [id, info] of allElements) {
    if (showAll || info.reusable) {
      components.push({
        id,
        name: info.element.name || "(unnamed)",
        type: info.element.type,
        reusable: info.reusable,
        path: info.path,
      });
    }
  }

  return components;
}

// 复制组件（带锁保护）
async function copyComponentsWithLock(srcPath, dstPath, componentIds) {
  // 获取目标文件的锁
  await acquireLock(dstPath);
  
  try {
    // 读取源文件
    const srcData = readPenFile(srcPath);
    const srcElements = collectAllElements(srcData.children);

    // 读取或创建目标文件
    let dstData;
    if (fs.existsSync(dstPath)) {
      dstData = readPenFile(dstPath);
    } else {
      dstData = {
        version: srcData.version || "2.6",
        children: [],
      };
    }

    const toCopy = new Set();
    const missingIds = [];

    for (const id of componentIds) {
      if (srcElements.has(id)) {
        toCopy.add(id);
        const deps = collectRefDependencies(srcElements.get(id).element, srcElements);
        deps.forEach((depId) => toCopy.add(depId));
      } else {
        missingIds.push(id);
      }
    }

    if (toCopy.size === 0) {
      throw new Error("没有找到任何可复制的组件");
    }

    // 收集所需变量
    const requiredVars = new Set();
    for (const id of toCopy) {
      const element = srcElements.get(id).element;
      collectVariables(element, requiredVars);
    }

    // 复制变量
    const srcVars = extractVariables(srcData);
    let varsAdded = 0;
    for (const varName of requiredVars) {
      if (srcVars[varName] && !dstData[varName]) {
        dstData[varName] = srcVars[varName];
        varsAdded++;
      }
    }

    // 克隆组件
    const idMap = new Map();
    const clonedComponents = [];

    for (const id of toCopy) {
      const info = srcElements.get(id);
      const { clone } = cloneWithNewIds(info.element, idMap);
      clonedComponents.push(clone);
    }

    // 更新引用
    clonedComponents.forEach((comp) => updateRefs(comp, idMap));

    // 只添加请求的组件（不包括依赖）
    const requestedIds = new Set(componentIds);
    const componentsToAdd = clonedComponents.filter((comp) => {
      for (const [oldId, newId] of idMap) {
        if (newId === comp.id && requestedIds.has(oldId)) {
          return true;
        }
      }
      return false;
    });

    // 计算组件的新位置（放在根节点现有元素的右边）
    let baseX = 0;
    const baseY = 0;

    if (dstData.children && dstData.children.length > 0) {
      const maxX = Math.max(...dstData.children.map((c) => (c.x || 0) + (c.width || 100)));
      baseX = maxX + 100;
    }

    // 调整位置
    let xOffset = 0;
    componentsToAdd.forEach((comp) => {
      comp.x = baseX + xOffset;
      comp.y = baseY;
      xOffset += (comp.width || 200) + 50;
    });

    // 直接添加到根节点 children
    if (!dstData.children) {
      dstData.children = [];
    }
    dstData.children.push(...componentsToAdd);

    // 写入文件
    writePenFile(dstPath, dstData);

    // 触发 Cursor 编辑器重新加载
    const reloaded = await triggerEditorReload(dstPath);

    return {
      copiedCount: componentsToAdd.length,
      dependenciesCount: toCopy.size - componentsToAdd.length,
      variablesAdded: varsAdded,
      missingIds,
      editorReloaded: reloaded,
      copiedIds: componentsToAdd.map((c) => ({
        oldId: [...idMap].find(([o, n]) => n === c.id)?.[0],
        newId: c.id,
        name: c.name,
      })),
    };
  } finally {
    // 释放锁
    releaseLock(dstPath);
  }
}

// 创建 MCP 服务器
const server = new Server(
  {
    name: "pen-component-copy",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "copy_components",
        description: `从源 .pen 文件复制组件到目标 .pen 文件（写入磁盘）。会自动处理组件依赖和变量。

重要提示：
- 此工具支持一次复制多个组件，请将所有要复制的组件 ID 放在一个数组中一次性传入
- 请勿并行调用此工具复制到同一个目标文件，会导致写入冲突
- 复制是写磁盘的，Pencil 持有内存中的文档副本，不会自动感知磁盘变更
- **复制完成后必须立即调用 reloadfile(file_path=目标文件路径)** 关闭并重新打开该文件，让 Pencil 从磁盘重新加载，否则 Pencil 的 batch_get / batch_design 将无法读取到新复制的组件
- 完整流程：copy_components → reloadfile → batch_get 确认组件到位 → batch_design 开始设计`,
        inputSchema: {
          type: "object",
          properties: {
            source_file: {
              type: "string",
              description: "源 .pen 文件的绝对路径",
            },
            target_file: {
              type: "string",
              description: "目标 .pen 文件的绝对路径（如果不存在会创建）",
            },
            component_ids: {
              type: "array",
              items: { type: "string" },
              description: "要复制的组件 ID 列表。支持一次传入多个 ID，工具会批量处理",
            },
          },
          required: ["source_file", "target_file", "component_ids"],
        },
      },
      {
        name: "list_components",
        description: "列出 .pen 文件中的所有可复用组件",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: ".pen 文件的绝对路径",
            },
            show_all: {
              type: "boolean",
              description: "是否显示所有组件（包括非复用组件），默认只显示可复用组件",
              default: false,
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "search_components",
        description: "在 .pen 文件中搜索组件",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: ".pen 文件的绝对路径",
            },
            keyword: {
              type: "string",
              description: "搜索关键词（匹配组件名称或 ID）",
            },
          },
          required: ["file_path", "keyword"],
        },
      },
      {
        name: "prepare_batch_copy",
        description: `准备跨文件复制组件的 batch_design 操作。返回可直接传给 Pencil batch_design 工具的操作字符串。

与 copy_components 的区别：
- copy_components 直接写磁盘，Pencil 不会感知变更，需要手动刷新
- prepare_batch_copy 生成 batch_design 操作，由 Pencil 执行，同时更新内存和磁盘，无需刷新

使用步骤：
1. 调用 prepare_batch_copy 获取 operations 和 variables
2. 如果 variables 非空，调用 Pencil 的 set_variables 在目标文件中添加变量
3. 调用 Pencil 的 batch_design 在目标文件中执行返回的 operations

注意：
- 此工具只读取源文件，不修改任何文件，实际插入由 batch_design 完成
- 自动处理组件的 ref 依赖（依赖组件先插入，主组件通过绑定变量引用）
- 操作数较多时可能需要分批调用 batch_design（每批最多 25 个操作）`,
        inputSchema: {
          type: "object",
          properties: {
            source_file: {
              type: "string",
              description: "源 .pen 文件的绝对路径",
            },
            component_ids: {
              type: "array",
              items: { type: "string" },
              description: "要复制的组件 ID 列表",
            },
          },
          required: ["source_file", "component_ids"],
        },
      },
      {
        name: "reloadfile",
        description: `Reload File: 关闭并重新打开当前文件。通过 cursor CLI 聚焦文件标签页，用 osascript 关闭该标签页，再重新打开同一文件，强制从磁盘重新读取。

适用场景：复制组件写入 .pen 文件后，调用此工具让 Pencil 从磁盘重新加载。
注意：仅 macOS 支持自动关闭+重新打开；其他平台仅聚焦文件。`,
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "要刷新的文件绝对路径",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "reload_pencil",
        description: `Reload Pencil: 重载窗口（重启 Pencil，刷新所有文件）。重载整个 Cursor 窗口，从而重启 Pencil 等扩展；恢复后已打开的文件会重新从磁盘加载。

执行前会弹出 macOS 原生确认对话框，用户确认后才执行。
注意：
- 仅 macOS 支持
- 窗口重载后 MCP 连接会短暂断开并自动重连
- 通过命令面板执行 Developer: Reload Window`,
        inputSchema: {
          type: "object",
          properties: {},
          required: [],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "copy_components": {
        const { source_file, target_file, component_ids } = args;

        // 使用带锁的复制函数
        const result = await copyComponentsWithLock(source_file, target_file, component_ids);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `成功复制 ${result.copiedCount} 个组件到磁盘`,
                  details: {
                    copiedComponents: result.copiedIds,
                    dependenciesCopied: result.dependenciesCount,
                    variablesAdded: result.variablesAdded,
                    missingIds: result.missingIds,
                    targetFile: target_file,
                    editorReloaded: result.editorReloaded,
                  },
                  nextStep: {
                    instruction: `【必须】立即调用 reloadfile(file_path="${target_file}") 关闭并重新打开该文件，让 Pencil 从磁盘重新加载。然后再对该文件做 batch_get 或 batch_design。`,
                  },
                  userFallback: {
                    when: "若 reloadfile 后 Pencil 仍检测不到新组件（ref 报错 non-existent node）",
                    action: "调用 reload_pencil 重载整个 Cursor 窗口，或提示用户手动关闭该 .pen 标签页后重新打开。",
                  },
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "list_components": {
        const { file_path, show_all = false } = args;
        const penData = readPenFile(file_path);
        const components = listComponents(penData, show_all);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  file: file_path,
                  totalCount: components.length,
                  components: components.map((c) => ({
                    id: c.id,
                    name: c.name,
                    type: c.type,
                    reusable: c.reusable,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "search_components": {
        const { file_path, keyword } = args;
        const penData = readPenFile(file_path);
        const allElements = collectAllElements(penData.children);
        const lowerKeyword = keyword.toLowerCase();

        const results = [];
        for (const [id, info] of allElements) {
          const name = (info.element.name || "").toLowerCase();
          const idLower = id.toLowerCase();

          if (name.includes(lowerKeyword) || idLower.includes(lowerKeyword)) {
            results.push({
              id,
              name: info.element.name || "(unnamed)",
              type: info.element.type,
              reusable: info.reusable,
            });
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  file: file_path,
                  keyword,
                  totalCount: results.length,
                  results,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "prepare_batch_copy": {
        const { source_file, component_ids } = args;
        const result = prepareBatchCopyOps(source_file, component_ids);

        const hasVars = Object.keys(result.variables).length > 0;
        const steps = [];
        if (hasVars) {
          steps.push(
            `1. 调用 set_variables 在目标文件中设置变量: ${JSON.stringify(result.variables)}`
          );
          steps.push(
            "2. 调用 batch_design 在目标文件中执行下方 operations"
          );
        } else {
          steps.push(
            "1. 调用 batch_design 在目标文件中执行下方 operations"
          );
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: `已为 ${result.componentCount} 个组件生成 batch_design 操作（含 ${result.dependencyCount} 个依赖）`,
                  operations: result.operations,
                  variables: result.variables,
                  copiedComponents: result.copiedComponents,
                  missingIds: result.missingIds,
                  nextSteps: steps,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "reloadfile": {
        const { file_path } = args;
        const absPath = path.resolve(file_path);

        if (!fs.existsSync(absPath)) {
          throw new Error(`文件不存在: ${absPath}`);
        }

        const cli = getCursorCli();
        if (!cli) {
          throw new Error("未找到 cursor/code CLI，无法操作编辑器标签页");
        }

        const result = await new Promise((resolve) => {
          exec(`"${cli}" --reuse-window "${absPath}"`, { timeout: 5000 }, (err) => {
            if (err) {
              resolve({ success: false, reason: `聚焦文件失败: ${err.message}` });
              return;
            }

            if (process.platform !== "darwin") {
              resolve({ success: true, method: "focus-only", note: "非 macOS 平台，仅聚焦了文件" });
              return;
            }

            setTimeout(() => {
              const closeScript = 'tell application "System Events" to tell process "Cursor" to keystroke "w" using {command down}';
              exec(`osascript -e '${closeScript}'`, { timeout: 5000 }, (closeErr) => {
                if (closeErr) {
                  resolve({ success: false, reason: `关闭标签页失败: ${closeErr.message}` });
                  return;
                }
                setTimeout(() => {
                  exec(`"${cli}" --reuse-window "${absPath}"`, { timeout: 5000 }, (err2) => {
                    if (err2) {
                      resolve({ success: false, reason: `重新打开失败: ${err2.message}` });
                    } else {
                      resolve({ success: true, method: "close-and-reopen" });
                    }
                  });
                }, 500);
              });
            }, 800);
          });
        });

        const fileName = path.basename(absPath);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: result.success,
                  message: result.success
                    ? `已关闭并重新打开文件: ${fileName}`
                    : `操作失败: ${result.reason}`,
                  file: absPath,
                  method: result.method,
                },
                null,
                2
              ),
            },
          ],
          isError: !result.success,
        };
      }

      case "reload_pencil": {
        if (process.platform !== "darwin") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { success: false, message: "此功能目前仅支持 macOS（需 osascript）" },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        let confirmed = false;
        try {
          await runAppleScript(
            'tell application "Cursor"\n' +
            "  activate\n" +
            '  display dialog "确认重载 Cursor 窗口？" & return & return & ' +
            '"这将重启 Pencil 等所有扩展。" & return & ' +
            '"恢复后已打开的文件会重新从磁盘加载。" ' +
            'buttons {"取消", "确认重载"} default button "确认重载" with icon caution\n' +
            "end tell"
          );
          confirmed = true;
        } catch (_) {
          // User clicked "取消" or closed the dialog
        }

        if (!confirmed) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { success: false, message: "用户取消了重载操作" },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // Schedule reload via command palette AFTER response is sent,
        // because the window reload will kill this MCP process.
        setTimeout(() => {
          runAppleScript(
            'tell application "System Events" to tell process "Cursor"\n' +
            "  key code 53\n" +
            "  delay 0.3\n" +
            '  keystroke "p" using {command down, shift down}\n' +
            "  delay 1.0\n" +
            '  keystroke "Reload Window"\n' +
            "  delay 0.8\n" +
            "  key code 36\n" +
            "end tell"
          ).catch(() => {});
        }, 300);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  message: "用户已确认，正在重载 Cursor 窗口…Pencil 将随之重启。窗口重载后 MCP 连接会短暂断开并自动重连。",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              success: false,
              error: error.message,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Pen Component Copy MCP Server running on stdio");
}

main().catch(console.error);
