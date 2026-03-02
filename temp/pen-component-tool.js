#!/usr/bin/env node
/**
 * Pencil (.pen) 组件复制工具
 * 用于在不同的 .pen 文件之间复制组件
 * 
 * 用法:
 *   node pen-component-tool.js list <file.pen>                    - 列出所有可复用组件
 *   node pen-component-tool.js list <file.pen> --all              - 列出所有组件（包括非复用）
 *   node pen-component-tool.js search <file.pen> <keyword>        - 搜索组件
 *   node pen-component-tool.js copy <src.pen> <dst.pen> <id>      - 复制单个组件
 *   node pen-component-tool.js copy <src.pen> <dst.pen> <id1,id2> - 复制多个组件
 *   node pen-component-tool.js copy <src.pen> <dst.pen> --all     - 复制所有可复用组件
 *   node pen-component-tool.js export <file.pen> <id> <out.json>  - 导出组件为独立文件
 *   node pen-component-tool.js import <file.pen> <component.json> - 导入组件
 *   node pen-component-tool.js vars <file.pen>                    - 列出所有变量
 */

const fs = require('fs');
const path = require('path');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 生成新的唯一 ID
function generateId(length = 5) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
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
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// 写入 .pen 文件
function writePenFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// 递归收集所有元素
function collectAllElements(node, elements = new Map(), parentPath = '') {
  if (!node) return elements;
  
  const currentPath = parentPath ? `${parentPath} > ${node.name || node.id}` : (node.name || node.id || 'root');
  
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
  
  // 处理顶级 children
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
  
  // 检查是否是引用类型
  if (element.type === 'ref' && element.ref) {
    if (!collected.has(element.ref)) {
      collected.add(element.ref);
      const refElement = allElements.get(element.ref);
      if (refElement) {
        collectRefDependencies(refElement.element, allElements, collected);
      }
    }
  }
  
  // 递归检查子元素
  if (Array.isArray(element.children)) {
    for (const child of element.children) {
      collectRefDependencies(child, allElements, collected);
    }
  }
  
  // 检查 slot 引用
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
    if (typeof value === 'string' && value.startsWith('$')) {
      variables.add(value.slice(1));
    } else if (Array.isArray(value)) {
      value.forEach(v => checkValue(v));
    } else if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(v => checkValue(v));
    }
  };
  
  // 检查所有属性
  for (const [key, value] of Object.entries(element)) {
    if (key === 'children') {
      if (Array.isArray(value)) {
        value.forEach(child => collectVariables(child, variables));
      }
    } else {
      checkValue(value);
    }
  }
  
  return variables;
}

// 深度克隆并重新生成 ID
function cloneWithNewIds(element, idMap = new Map(), isRoot = true) {
  if (!element) return isRoot ? { clone: null, idMap } : null;
  
  const clone = JSON.parse(JSON.stringify(element)); // 深度克隆
  
  // 递归生成新 ID
  function regenerateIds(node) {
    if (!node) return;
    
    if (node.id) {
      const newId = generateId();
      idMap.set(node.id, newId);
      node.id = newId;
    }
    
    if (Array.isArray(node.children)) {
      node.children.forEach(child => regenerateIds(child));
    }
  }
  
  regenerateIds(clone);
  
  return isRoot ? { clone, idMap } : clone;
}

// 更新克隆元素中的引用
function updateRefs(element, idMap) {
  if (!element) return;
  
  // 更新 ref 引用
  if (element.ref && idMap.has(element.ref)) {
    element.ref = idMap.get(element.ref);
  }
  
  // 更新 slot 引用
  if (Array.isArray(element.slot)) {
    element.slot = element.slot.map(id => idMap.has(id) ? idMap.get(id) : id);
  }
  
  // 更新 descendants 中的引用
  if (element.descendants) {
    const newDescendants = {};
    for (const [oldId, value] of Object.entries(element.descendants)) {
      const newId = idMap.has(oldId) ? idMap.get(oldId) : oldId;
      newDescendants[newId] = value;
    }
    element.descendants = newDescendants;
  }
  
  // 递归处理子元素
  if (Array.isArray(element.children)) {
    element.children.forEach(child => updateRefs(child, idMap));
  }
}

// 列出组件
function listComponents(penData, showAll = false) {
  const allElements = collectAllElements(penData.children);
  
  const components = [];
  for (const [id, info] of allElements) {
    if (showAll || info.reusable) {
      components.push({
        id,
        name: info.element.name || '(unnamed)',
        type: info.element.type,
        reusable: info.reusable,
        path: info.path,
      });
    }
  }
  
  return components;
}

// 搜索组件
function searchComponents(penData, keyword) {
  const allElements = collectAllElements(penData.children);
  const lowerKeyword = keyword.toLowerCase();
  
  const results = [];
  for (const [id, info] of allElements) {
    const name = (info.element.name || '').toLowerCase();
    const idLower = id.toLowerCase();
    
    if (name.includes(lowerKeyword) || idLower.includes(lowerKeyword)) {
      results.push({
        id,
        name: info.element.name || '(unnamed)',
        type: info.element.type,
        reusable: info.reusable,
        path: info.path,
      });
    }
  }
  
  return results;
}

// 提取变量定义
function extractVariables(penData) {
  const variables = {};
  for (const [key, value] of Object.entries(penData)) {
    if (key.startsWith('--')) {
      variables[key] = value;
    }
  }
  return variables;
}

// 复制组件
function copyComponents(srcData, dstData, componentIds, options = {}) {
  const srcElements = collectAllElements(srcData.children);
  const dstElements = collectAllElements(dstData.children);
  
  // 收集要复制的组件及其依赖
  const toCopy = new Set();
  const missingIds = [];
  
  for (const id of componentIds) {
    if (srcElements.has(id)) {
      toCopy.add(id);
      // 收集依赖
      const deps = collectRefDependencies(srcElements.get(id).element, srcElements);
      deps.forEach(depId => toCopy.add(depId));
    } else {
      missingIds.push(id);
    }
  }
  
  if (missingIds.length > 0) {
    log(`警告: 以下组件 ID 未找到: ${missingIds.join(', ')}`, 'yellow');
  }
  
  if (toCopy.size === 0) {
    throw new Error('没有找到任何可复制的组件');
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
  clonedComponents.forEach(comp => updateRefs(comp, idMap));
  
  // 只添加请求的组件（不包括依赖的子组件）
  const requestedIds = new Set(componentIds);
  const componentsToAdd = clonedComponents.filter(comp => {
    // 找到原始 ID
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
    // 找到现有根节点元素的最大 X 值
    const maxX = Math.max(...dstData.children.map(c => (c.x || 0) + (c.width || 100)));
    baseX = maxX + 100; // 间距 100
  }

  // 调整位置
  let xOffset = 0;
  componentsToAdd.forEach(comp => {
    comp.x = baseX + xOffset;
    comp.y = baseY;
    xOffset += (comp.width || 200) + 50;
  });

  // 直接添加到根节点 children
  if (!dstData.children) {
    dstData.children = [];
  }
  dstData.children.push(...componentsToAdd);
  
  return {
    copiedCount: componentsToAdd.length,
    dependenciesCount: toCopy.size - componentsToAdd.length,
    variablesAdded: varsAdded,
    idMap,
  };
}

// 导出组件为独立文件
function exportComponent(penData, componentId, outputPath) {
  const allElements = collectAllElements(penData.children);
  
  if (!allElements.has(componentId)) {
    throw new Error(`组件 ID 不存在: ${componentId}`);
  }
  
  const info = allElements.get(componentId);
  const element = JSON.parse(JSON.stringify(info.element)); // 深度克隆
  
  // 收集依赖
  const deps = collectRefDependencies(element, allElements);
  const dependencies = [];
  for (const depId of deps) {
    if (depId !== componentId && allElements.has(depId)) {
      dependencies.push(JSON.parse(JSON.stringify(allElements.get(depId).element)));
    }
  }
  
  // 收集变量
  const requiredVars = collectVariables(element);
  deps.forEach(depId => {
    if (allElements.has(depId)) {
      collectVariables(allElements.get(depId).element, requiredVars);
    }
  });
  
  const srcVars = extractVariables(penData);
  const variables = {};
  for (const varName of requiredVars) {
    if (srcVars[varName]) {
      variables[varName] = srcVars[varName];
    }
  }
  
  const exportData = {
    version: '1.0',
    exportedFrom: 'pen-component-tool',
    exportedAt: new Date().toISOString(),
    component: element,
    dependencies,
    variables,
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
  
  return {
    componentName: element.name || componentId,
    dependenciesCount: dependencies.length,
    variablesCount: Object.keys(variables).length,
  };
}

// 导入组件
function importComponent(dstData, componentFilePath) {
  if (!fs.existsSync(componentFilePath)) {
    throw new Error(`文件不存在: ${componentFilePath}`);
  }
  
  const importData = JSON.parse(fs.readFileSync(componentFilePath, 'utf-8'));
  
  if (!importData.component) {
    throw new Error('无效的组件文件格式');
  }
  
  // 复制变量
  let varsAdded = 0;
  if (importData.variables) {
    for (const [varName, value] of Object.entries(importData.variables)) {
      if (!dstData[varName]) {
        dstData[varName] = value;
        varsAdded++;
      }
    }
  }
  
  // 克隆组件和依赖
  const idMap = new Map();
  const { clone: mainComponent } = cloneWithNewIds(importData.component, idMap);
  
  const clonedDeps = [];
  if (importData.dependencies) {
    for (const dep of importData.dependencies) {
      const { clone: clonedDep } = cloneWithNewIds(dep, idMap);
      clonedDeps.push(clonedDep);
    }
  }
  
  // 更新引用
  updateRefs(mainComponent, idMap);
  clonedDeps.forEach(dep => updateRefs(dep, idMap));
  
  // 添加到目标文件
  let targetFrame = null;
  if (dstData.children && dstData.children.length > 0) {
    targetFrame = dstData.children.find(child => child.type === 'frame');
  }
  
  if (targetFrame) {
    if (!targetFrame.children) {
      targetFrame.children = [];
    }
    // 先添加依赖，再添加主组件
    targetFrame.children.push(...clonedDeps, mainComponent);
  } else {
    if (!dstData.children) {
      dstData.children = [];
    }
    dstData.children.push(...clonedDeps, mainComponent);
  }
  
  return {
    componentName: mainComponent.name || mainComponent.id,
    dependenciesCount: clonedDeps.length,
    variablesAdded: varsAdded,
  };
}

// 打印组件列表
function printComponentList(components, title) {
  log(`\n${title}`, 'bright');
  log('─'.repeat(80), 'dim');
  
  if (components.length === 0) {
    log('  (无)', 'dim');
    return;
  }
  
  // 按类型分组
  const byType = {};
  for (const comp of components) {
    const type = comp.type || 'unknown';
    if (!byType[type]) byType[type] = [];
    byType[type].push(comp);
  }
  
  for (const [type, comps] of Object.entries(byType)) {
    log(`\n  [${type}]`, 'cyan');
    for (const comp of comps) {
      const reusableTag = comp.reusable ? `${colors.green}[可复用]${colors.reset}` : '';
      log(`    ${colors.yellow}${comp.id}${colors.reset} - ${comp.name} ${reusableTag}`);
    }
  }
  
  log(`\n共 ${components.length} 个组件`, 'dim');
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    log(`
Pencil 组件复制工具

用法:
  node pen-component-tool.js <命令> [参数]

命令:
  list <file.pen> [--all]           列出组件（--all 显示所有）
  search <file.pen> <关键词>         搜索组件
  copy <源.pen> <目标.pen> <ID,...>  复制组件（逗号分隔多个 ID）
  copy <源.pen> <目标.pen> --all     复制所有可复用组件
  export <file.pen> <ID> <out.json> 导出组件
  import <file.pen> <comp.json>     导入组件
  vars <file.pen>                   列出所有变量

示例:
  node pen-component-tool.js list design.pen
  node pen-component-tool.js search design.pen Button
  node pen-component-tool.js copy lib.pen project.pen xCEfn,zdFKu
  node pen-component-tool.js export lib.pen xCEfn tooltip.json
  node pen-component-tool.js import project.pen tooltip.json
`, 'white');
    process.exit(0);
  }
  
  const command = args[0];
  
  try {
    switch (command) {
      case 'list': {
        const filePath = args[1];
        const showAll = args.includes('--all');
        
        if (!filePath) {
          throw new Error('请指定 .pen 文件路径');
        }
        
        const penData = readPenFile(filePath);
        const components = listComponents(penData, showAll);
        
        const title = showAll ? `所有组件 - ${path.basename(filePath)}` : `可复用组件 - ${path.basename(filePath)}`;
        printComponentList(components, title);
        break;
      }
      
      case 'search': {
        const filePath = args[1];
        const keyword = args[2];
        
        if (!filePath || !keyword) {
          throw new Error('用法: search <file.pen> <关键词>');
        }
        
        const penData = readPenFile(filePath);
        const results = searchComponents(penData, keyword);
        
        printComponentList(results, `搜索结果: "${keyword}"`);
        break;
      }
      
      case 'copy': {
        const srcPath = args[1];
        const dstPath = args[2];
        const idsArg = args[3];
        
        if (!srcPath || !dstPath || !idsArg) {
          throw new Error('用法: copy <源.pen> <目标.pen> <ID,...|--all>');
        }
        
        const srcData = readPenFile(srcPath);
        
        // 检查目标文件是否存在
        let dstData;
        if (fs.existsSync(dstPath)) {
          dstData = readPenFile(dstPath);
        } else {
          // 创建新文件
          dstData = {
            version: srcData.version || '2.6',
            children: [{
              type: 'frame',
              id: generateId(),
              name: 'Imported Components',
              x: 0,
              y: 0,
              width: 1920,
              height: 1080,
              children: [],
            }],
          };
          log(`创建新文件: ${dstPath}`, 'yellow');
        }
        
        // 获取要复制的 ID
        let componentIds;
        if (idsArg === '--all') {
          const components = listComponents(srcData, false);
          componentIds = components.map(c => c.id);
          log(`复制所有可复用组件 (${componentIds.length} 个)...`, 'cyan');
        } else {
          componentIds = idsArg.split(',').map(id => id.trim());
        }
        
        const result = copyComponents(srcData, dstData, componentIds);
        
        writePenFile(dstPath, dstData);
        
        log(`\n复制完成!`, 'green');
        log(`  - 组件: ${result.copiedCount} 个`, 'white');
        log(`  - 依赖: ${result.dependenciesCount} 个`, 'white');
        log(`  - 变量: ${result.variablesAdded} 个`, 'white');
        log(`  - 保存到: ${dstPath}`, 'dim');
        break;
      }
      
      case 'export': {
        const filePath = args[1];
        const componentId = args[2];
        const outputPath = args[3];
        
        if (!filePath || !componentId || !outputPath) {
          throw new Error('用法: export <file.pen> <ID> <output.json>');
        }
        
        const penData = readPenFile(filePath);
        const result = exportComponent(penData, componentId, outputPath);
        
        log(`\n导出完成!`, 'green');
        log(`  - 组件: ${result.componentName}`, 'white');
        log(`  - 依赖: ${result.dependenciesCount} 个`, 'white');
        log(`  - 变量: ${result.variablesCount} 个`, 'white');
        log(`  - 保存到: ${outputPath}`, 'dim');
        break;
      }
      
      case 'import': {
        const filePath = args[1];
        const componentPath = args[2];
        
        if (!filePath || !componentPath) {
          throw new Error('用法: import <file.pen> <component.json>');
        }
        
        let penData;
        if (fs.existsSync(filePath)) {
          penData = readPenFile(filePath);
        } else {
          penData = {
            version: '2.6',
            children: [{
              type: 'frame',
              id: generateId(),
              name: 'Imported Components',
              x: 0,
              y: 0,
              width: 1920,
              height: 1080,
              children: [],
            }],
          };
          log(`创建新文件: ${filePath}`, 'yellow');
        }
        
        const result = importComponent(penData, componentPath);
        
        writePenFile(filePath, penData);
        
        log(`\n导入完成!`, 'green');
        log(`  - 组件: ${result.componentName}`, 'white');
        log(`  - 依赖: ${result.dependenciesCount} 个`, 'white');
        log(`  - 变量: ${result.variablesAdded} 个`, 'white');
        log(`  - 保存到: ${filePath}`, 'dim');
        break;
      }
      
      case 'vars': {
        const filePath = args[1];
        
        if (!filePath) {
          throw new Error('请指定 .pen 文件路径');
        }
        
        const penData = readPenFile(filePath);
        const variables = extractVariables(penData);
        
        log(`\n变量列表 - ${path.basename(filePath)}`, 'bright');
        log('─'.repeat(80), 'dim');
        
        const varNames = Object.keys(variables).sort();
        
        if (varNames.length === 0) {
          log('  (无变量)', 'dim');
        } else {
          for (const name of varNames) {
            const value = variables[name];
            const valueStr = typeof value === 'object' 
              ? JSON.stringify(value).slice(0, 60) + (JSON.stringify(value).length > 60 ? '...' : '')
              : String(value);
            log(`  ${colors.yellow}$${name}${colors.reset} = ${valueStr}`);
          }
          log(`\n共 ${varNames.length} 个变量`, 'dim');
        }
        break;
      }
      
      default:
        throw new Error(`未知命令: ${command}`);
    }
  } catch (error) {
    log(`\n错误: ${error.message}`, 'red');
    process.exit(1);
  }
}

main();
