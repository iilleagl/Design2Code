---
name: pen-design-generator
description: Generate UI design drafts (.pen files) using Pencil MCP tools, referencing design component libraries and specification documents. Use when the user asks to create UI designs, mockups, screens, dashboards, or any visual design task that involves .pen files, DevUI components, or Pencil design tools.
---

# Pencil 设计稿生成

根据 UI 设计需求，参考组件库和设计规范文档，使用 Pencil MCP 工具生成 .pen 设计稿。

## 输入要求

用户需提供以下信息（至少前两项）：

1. **UI 设计需求**：详细的页面/功能描述
2. **设计组件库路径**：可复用组件的 .pen 文件路径（如 `devUI.pen`）
3. **设计规范文档路径**（可选）：Design Token / 排版 / 间距等规范文件（如 `llms-full.txt`）

## 工作流程

### 阶段 1：准备 — 理解需求与资源

**1.1 读取设计规范文档**

```bash
# 读取规范文档，提取 Design Token、排版、间距、阴影等全局信息
Read(规范文档路径)
```

关注要点：
- 颜色体系（主色、辅助色、文字色、背景色）
- 排版体系（字号、字重、行高）
- 间距规则（基础网格、推荐间距值）
- 阴影与圆角
- 禁用模式

**1.2 扫描组件库，搜索并验证组件 ID**

> **重要**：不要直接使用文档中硬编码的组件 ID。组件 ID 可能随组件库版本更新而变化，必须通过实际搜索来获取正确的 ID。

```bash
# 第一步：用关键词搜索所需组件，获取真实 ID
search_components(file_path=组件库路径, keyword="导航")
search_components(file_path=组件库路径, keyword="按钮")
search_components(file_path=组件库路径, keyword="输入框")
search_components(file_path=组件库路径, keyword="checkbox")
search_components(file_path=组件库路径, keyword="面包屑")
search_components(file_path=组件库路径, keyword="表单项")
# ... 根据需求搜索更多关键词

# 第二步：从搜索结果中筛选 reusable: true 的组件
# 记录每个可复用组件的 ID、名称和用途
```

按类别记录可复用组件清单：
- 导航类（顶部导航、侧边栏、面包屑、标签页）
- 按钮类（主按钮、次按钮、文本按钮、图标按钮）
- 输入类（文本框、搜索框、下拉框）
- 表单类（表单项组合、复选框）
- 卡片类（基本卡片、操作卡片）
- 提示类（通知、Banner、文字提示）
- 弹窗类

**1.3 深度读取关键组件结构**

对设计中可能频繁使用的组件，用 `batch_get` 读取其完整结构，了解内部子节点 ID（后续 `U()` 覆写时需要）：

```bash
# 示例：读取面包屑和表单项的详细结构
batch_get(filePath=组件库路径, nodeIds=["实际搜到的ID1", "实际搜到的ID2"], readDepth=3)
```

### 阶段 2：规划 — 组件准备与设计稿结构

**2.1 规划设计稿结构与组件映射**

在开始设计前，**先完整规划设计稿的结构**，并为每个区域标注组件复用方案：

1. **页面布局**：确定整体结构（顶部导航 + 侧边栏 + 内容区等）
2. **区域划分**：将页面拆分为独立的功能区域
3. **组件映射**：为每个区域评估组件复用方案，标注使用方式

输出规划清单示例：

```
设计稿结构规划：
├── 顶部导航栏 → [需复制] 组件库 "顶部导航栏" (id: xxx) → ref 引用
├── 左侧边栏 → [需复制] 组件库 "手风琴侧栏" (id: xxx) → 修改后复用
├── 内容区
│   ├── 面包屑 → [需复制] 组件库 "面包屑" (id: xxx) → ref 引用
│   ├── 页面标题 → [无匹配] 根据设计规范自行创建
│   ├── 表单项（带输入框） → [需复制] 组件库 "表单项" (id: xxx) → ref 引用
│   ├── 表单项（带复选框） → [需复制] 组件库 "checkbox" (id: xxx) → 修改后复用
│   └── 提交按钮 → [需复制] 组件库 "主按钮" (id: xxx) → ref 引用
└── 弹窗（按需） → [需复制] 组件库 "弹窗" (id: xxx) → 修改后复用
```

**2.2 批量复制所需组件到当前设计稿**

> **关键步骤**：Pencil 不支持跨文件引用组件。必须先将组件库中的组件复制到当前设计稿文件，之后才能在设计稿中通过 `ref` 引用或修改使用。

根据规划清单，将所有需要的可复用组件一次性复制到设计稿：

```bash
# 收集所有需要复制的组件 ID，一次性批量复制
copy_components(
  source_file=组件库.pen路径,
  target_file=设计稿.pen路径,
  component_ids=["面包屑ID", "表单项ID", "checkboxID", "按钮ID", ...]
)
```

注意事项：
- 将所有需要的组件 ID 放在一个数组中一次性复制，**不要**分多次调用
- **不要**对同一目标文件并行调用 `copy_components`
- 复制完成后，组件以 `reusable` 节点形式存在于设计稿中
- 复制后需通过 `batch_get(patterns=[{reusable: true}])` 确认组件已到位，并记录复制后的组件 ID

### 阶段 3：设计 — 逐区域构建

**核心原则：组件已复制到当前页面后，按以下优先级选择使用方式：**

```
优先级 1：直接 ref 引用（I 操作 + type: "ref"）
  → 条件：当前页面中已有可复用组件，且完全满足需求
  → 操作：I(parent, {type: "ref", ref: "组件ID"})
  → 微调：通过 U(实例+"/子节点ID", {...}) 覆写文本、颜色等属性
  → 适用于：按钮、输入框、面包屑、表单项等结构匹配的组件

优先级 2：修改后复用（C 操作复制 + U/R 操作修改）
  → 条件：当前页面中有可复用组件，结构接近但部分需求不满足
  → 操作：先 C() 复制组件创建副本，再通过 U()/R() 深度修改
  → 适用于：导航栏需要调整菜单项、侧边栏需要增减项目等

优先级 3：根据设计规范从零创建（I 操作 + 自定义结构）
  → 条件：当前页面中无匹配的可复用组件
  → 操作：使用 I() 逐层构建，严格遵循设计规范文档
  → 约束：颜色、字号、间距、圆角等必须使用 Design Token
```

**3.1 创建画布与顶层结构**

```javascript
screen=I(document, {type: "frame", name: "页面名称", width: 1920, height: 1080, fill: "#EEF0F5", layout: "vertical"})
```

**3.2 逐区域设计**

对每个区域执行：

1. **查找匹配组件**：在当前页面的可复用组件中找最接近的
2. **选择使用方式**：按优先级 1→2→3 选择
3. **执行设计操作**：使用 `batch_design` 工具
4. **微调属性**：通过 U 操作调整文本、尺寸、颜色

每个 `batch_design` 调用控制在 **25 个操作以内**。

**优先级 1 示例 — 直接 ref 引用（面包屑）：**

```javascript
// 组件已通过 copy_components 复制到当前页面
// 搜索确认当前页面中面包屑组件的 ID
breadcrumb=I(header, {type: "ref", ref: "面包屑组件ID", width: "fill_container"})
// 覆写面包屑各层级文本
U(breadcrumb+"/第1级文本ID", {content: "首页"})
U(breadcrumb+"/第2级文本ID", {content: "项目名称"})
U(breadcrumb+"/第3级文本ID", {content: "代码托管"})
```

**优先级 2 示例 — 修改后复用（导航栏增减菜单项）：**

```javascript
// 先复制组件创建副本
navbar=C("导航栏组件ID", screen, {width: "fill_container"})
// 修改副本中的子节点
U(navbar+"/标题文本ID", {content: "我的应用"})
// 删除不需要的菜单项
D(navbar+"/多余菜单项ID")
// 替换某个子节点
newItem=R(navbar+"/旧菜单项ID", {type: "text", content: "新菜单项"})
```

**优先级 3 示例 — 从零创建（遵循设计规范）：**

```javascript
title=I(container, {type: "text", content: "页面标题", fontSize: 16, fontWeight: "700", fill: "#252B3A", fontFamily: "Noto Sans SC", lineHeight: 1.5})
```

### 阶段 4：验证 — 截图检查

每完成一个主要区域后，用 `get_screenshot` 验证：

```bash
get_screenshot(filePath=设计稿路径, nodeId=区域节点ID)
```

检查要点：
- [ ] 布局是否正确（无重叠、无溢出）
- [ ] 间距是否符合 4px 网格
- [ ] 颜色是否使用设计令牌
- [ ] 字号是否在规范范围内（12/14/16/20/24/36）
- [ ] 组件状态是否正确

发现问题立即修复后再继续。

## 组件使用指南

### 第一步：将组件复制到当前页面（前置条件）

Pencil **不支持跨文件引用组件**。设计稿中使用的所有组件必须先存在于当前 .pen 文件中。

| 场景 | 操作 | 工具 |
|------|------|------|
| 组件在外部组件库中 | 复制到当前文件 | `copy_components(source, target, ids)` |
| 组件已在当前文件中 | 无需复制，直接使用 | — |

执行时机：在阶段 2（规划）完成后、阶段 3（设计）开始前，一次性将所有需要的组件复制到当前页面。

### 第二步：按优先级使用组件

组件已在当前页面中后，按以下优先级选择使用方式：

| 优先级 | 条件 | 使用方式 | 工具/操作 |
|--------|------|----------|-----------|
| 1（最优） | 组件完全满足需求 | 直接 ref 引用 | `I({type: "ref", ref: ID})` + `U()` 微调 |
| 2 | 组件结构接近但部分不满足 | 复制组件后修改 | `C()` + `U()` / `R()` / `D()` 深度修改 |
| 3（最后） | 无匹配可复用组件 | 根据设计规范从零创建 | `I()` 逐层构建，严格遵循 Design Token |

> **强制检查点**：选择优先级 3 之前，必须确认已通过 `search_components` 搜索过组件库，且确实没有任何接近的可复用组件。

## 设计规范速查

设计过程中始终遵循以下规范：

- **颜色**：使用规范文档中定义的 Design Token，不使用任意色值
- **字号**：仅使用 12/14/16/20/24/36 px
- **间距**：始终为 4 的倍数（4/8/12/16/20/24/32）
- **圆角**：默认 4px，小型组件 2px
- **阴影**：使用规范定义的阴影层级
- **字体**：使用 `Noto Sans SC` 或规范指定字体

## 详细参考

- 组件 ID 速查表和详细工具用法见 [reference.md](reference.md)
