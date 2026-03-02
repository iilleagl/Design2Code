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

// 写入 .pen 文件
function writePenFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
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

    return {
      copiedCount: componentsToAdd.length,
      dependenciesCount: toCopy.size - componentsToAdd.length,
      variablesAdded: varsAdded,
      missingIds,
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
        description: `从源 .pen 文件复制组件到目标 .pen 文件。会自动处理组件依赖和变量。

重要提示：
- 此工具支持一次复制多个组件，请将所有要复制的组件 ID 放在一个数组中一次性传入
- 请勿并行调用此工具复制到同一个目标文件，会导致写入冲突
- 复制后需要在 Pencil 编辑器中重新加载文件才能看到变更`,
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
                  message: `成功复制 ${result.copiedCount} 个组件`,
                  details: {
                    copiedComponents: result.copiedIds,
                    dependenciesCopied: result.dependenciesCount,
                    variablesAdded: result.variablesAdded,
                    missingIds: result.missingIds,
                    targetFile: target_file,
                  },
                  note: "如果目标文件已在 Pencil 编辑器中打开，请关闭并重新打开文件以查看变更",
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
