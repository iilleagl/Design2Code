---
skill_name: "pixso-to-pencil"
description: "Convert Pixso design layers to Pencil .pen design files. Extracts DSL from Pixso via MCP, maps layers to reusable design system components, copies required components across .pen files, and renders the final design using Pencil batch_design operations. Use when the user provides a Pixso URL or item-id and wants to recreate the design as a .pen file."
version: "1.0.0"
last_updated: "2026-02-10"
tags:
  - pixso
  - pencil
  - design-conversion
  - pen-files
  - design-system
author: "Antigravity"
---

# SKILL: Pixso 设计图层转化为 Pencil 设计稿

将 Pixso 设计平台的图层结构通过 MCP 工具链转化为 Pencil `.pen` 设计文件，优先复用已有的设计系统组件。

---

## 前置条件 | Prerequisites

用户需提供以下信息（或从对话上下文推断）：

| 参数 | 说明 | 示例 |
|------|------|------|
| `PIXSO_URL` 或 `ITEM_ID` | Pixso 设计稿链接或节点 ID | `https://pixso.cn/app/design/xxx?item-id=1:2` 或 `1:2` |
| `COMPONENT_DIR` | 组件库 .pen 文件路径 | `designsystem/devUI/components/devUI.pen` |
| `LLMS_FULL_PATH` | 设计规范文档路径 | `designsystem/devUI/llms-full.txt` |
| `TARGET_PEN` | 目标输出 .pen 文件路径 | `output/my-page.pen` |

> **URL 解析规则**: 从 Pixso URL 中提取 `item-id` 参数作为节点 ID。
> 例：`https://pixso.cn/app/design/abc?item-id=123:456` → itemId = `123:456`

---

## 工作流程 | Workflow

```
Task Progress:
- [ ] Phase 1: 获取 Pixso 图层信息
- [ ] Phase 2: 加载设计系统资源
- [ ] Phase 3: 图层分析与组件映射
- [ ] Phase 4: 复制所需组件到目标文件
- [ ] Phase 5: 构建设计稿
- [ ] Phase 6: 视觉验证与修正
```

---

### Phase 1: 获取 Pixso 图层信息

**目标**: 获取 Pixso 设计图层的完整 DSL 结构和参考截图。

**1.1 获取参考截图（可选但推荐）**

```
工具: Pixso_Mcp-getImage
参数: { itemId: "ITEM_ID" }
```

保存截图作为后续视觉对照的参考基准。

**1.2 获取图层 DSL**

```
工具: Pixso_Mcp-getNodeDSL
参数: { itemId: "ITEM_ID" }
```

DSL 返回 JSON 结构，包含：
- 图层树（嵌套的 frame/group/text/shape 结构）
- 每个节点的视觉属性（fill、stroke、effect、cornerRadius 等）
- 布局信息（Auto Layout 的 direction、gap、padding 等）
- 文本内容与字体属性

**1.3 解析 DSL 关键信息**

从 DSL 中提取以下核心信息并记录：

```
- 整体画布尺寸 (width × height)
- 顶层布局方向 (horizontal / vertical / none)
- 主要区块划分 (header / sidebar / content / footer 等)
- 使用的颜色值列表
- 使用的字体与字号列表
- 图片/图标资源的位置
```

---

### Phase 2: 加载设计系统资源

**目标**: 读取可复用组件和设计规范，建立组件索引。

**2.1 读取设计规范**

```
工具: Read
路径: LLMS_FULL_PATH (如 designsystem/devUI/llms-full.txt)
```

从 llms-full.txt 中提取：
- **设计令牌 (Design Tokens)**: 颜色映射表（hex → token name）、字号体系、间距规则、阴影令牌
- **组件目录**: 所有组件的 Node ID、名称、变体列表
- **转换规则**: Pencil 属性到 CSS 的映射关系

**2.2 扫描组件库中的可复用组件**

```
工具: pen-component-copy-list_components
参数: { file_path: "COMPONENT_DIR 的绝对路径" }
```

记录所有 `reusable: true` 的组件清单：
- 组件 ID
- 组件名称
- 组件用途（从命名推断）

**若无 reusable 组件**，则通过 `batch_get` 搜索具有规律命名的 frame：

```
工具: pencil-batch_get
参数: {
  filePath: "COMPONENT_DIR",
  patterns: [{ "type": "frame" }],
  searchDepth: 2,
  readDepth: 1
}
```

按命名模式（如 `按钮/主/L/默认`、`输入类/文本框/单行文本框/默认`）识别组件。

---

### Phase 3: 图层分析与组件映射

**目标**: 将 Pixso DSL 中的图层映射到设计系统组件或原子节点。

**3.1 构建映射表**

遍历 Pixso DSL 节点树，逐层判断：

```
对每个 Pixso 节点:
  1. 是否有直接匹配的可复用组件？ → 标记为 REF (组件引用)
  2. 是否为标准 UI 模式？ (按钮/输入框/卡片等) → 搜索最接近的组件
  3. 以上都不是？ → 标记为 PRIMITIVE (用基础节点手动构建)
```

**匹配策略优先级**:

| 优先级 | 策略 | 说明 |
|--------|------|------|
| 1 | 完全匹配 | 组件名称/结构完全对应 |
| 2 | 近似匹配 | 组件基本结构相同，需覆盖部分属性（颜色、文字、尺寸） |
| 3 | 部分复用 | 复用子组件（如只复用按钮，容器手动构建） |
| 4 | 纯手工 | 无可复用组件，用 frame/text/rectangle 原子构建 |

**3.2 生成构建计划**

输出格式：

```
构建计划:
├── Screen (frame, 1920×1080)
│   ├── [REF] 顶部导航 → 复用 "导航/顶部导航" (组件ID: xxx)
│   ├── [PRIMITIVE] 主内容区 (frame, vertical layout)
│   │   ├── [REF] 搜索框 → 复用 "输入类/搜索/线框/默认" (组件ID: yyy)
│   │   ├── [PRIMITIVE] 数据表格 (手动构建)
│   │   └── [REF] 分页 → 复用 "分页/完整/默认" (组件ID: zzz)
│   └── [REF] 侧边栏 → 复用 "导航/左侧边栏/默认" (组件ID: www)
```

---

### Phase 4: 复制所需组件到目标文件

**目标**: 将构建计划中标记为 REF 的组件从组件库复制到目标 .pen 文件。

> **核心约束**: Pencil 不支持跨文件 `ref` 组件。必须先将组件复制到目标文件中，然后才能在目标文件中引用（ref）它们。

**4.1 收集需要复制的组件 ID 列表**

从构建计划中提取所有 REF 类型的组件 ID，去重。

**4.2 批量复制组件**

```
工具: pen-component-copy-copy_components
参数: {
  source_file: "COMPONENT_DIR 的绝对路径",
  target_file: "TARGET_PEN 的绝对路径",
  component_ids: ["组件ID1", "组件ID2", ...]
}
```

> **重要**: 
> - 一次调用传入所有需要复制的组件 ID，不要分多次调用
> - 不要对同一目标文件并行调用此工具，会导致写入冲突
> - 复制后组件会自动处理依赖关系和变量

**4.3 验证复制结果**

```
工具: pen-component-copy-list_components
参数: { file_path: "TARGET_PEN 的绝对路径" }
```

确认所有需要的组件已存在于目标文件中。

---

### Phase 5: 构建设计稿

**目标**: 在目标 .pen 文件中，按照 Pixso DSL 结构和构建计划绘制完整设计稿。

**5.1 打开目标文件**

```
工具: pencil-open_document
参数: { filePathOrTemplate: "TARGET_PEN 路径" }
```

若目标文件不存在，传 `"new"` 创建新文档，后续保存到指定路径。

**5.2 获取设计指南（如需要）**

```
工具: pencil-get_guidelines
参数: { topic: "design-system" }
```

**5.3 按区块逐步构建**

使用 `batch_design` 工具，每次最多 25 个操作。按自顶向下的顺序构建：

**构建顺序**:
1. 创建根 Frame（屏幕容器）
2. 插入顶层区块（header / sidebar / content / footer）
3. 在每个区块内填充内容

**操作语法参考**:

```javascript
// 1. 创建根屏幕
screen=I(document, {type: "frame", name: "Dashboard", width: 1920, height: 1080, layout: "vertical", fill: "#F5F5F6"})

// 2. 插入组件引用 (REF) — 使用复制后的组件
navbar=I(screen, {type: "ref", ref: "已复制的组件ID", width: "fill_container", height: 48})

// 3. 覆盖组件内部属性
U(navbar+"/titleText", {content: "仪表盘"})

// 4. 创建原始布局容器 (PRIMITIVE)
content=I(screen, {type: "frame", layout: "horizontal", gap: 16, padding: 24})

// 5. 插入子内容
sidebar=I(content, {type: "ref", ref: "侧边栏组件ID", width: 200, height: "fill_container"})
main=I(content, {type: "frame", layout: "vertical", gap: 16, width: "fill_container"})

// 6. 图片节点 — 先创建 frame 再用 G() 填充
heroImg=I(main, {type: "frame", name: "Hero", width: "fill_container", height: 300})
G(heroImg, "stock", "enterprise dashboard hero")
```

**属性映射规则 (Pixso DSL → Pencil .pen)**:

| Pixso DSL 属性 | Pencil .pen 属性 | 说明 |
|----------------|------------------|------|
| `fills[0].color` | `fill: "#hex"` | 取第一个填充的颜色，反查 Design Token |
| `strokes[0]` | `stroke: {fill, thickness, align}` | 描边 |
| `effects[0] (shadow)` | `effect: {type: "shadow", ...}` | 阴影 |
| `cornerRadius` | `cornerRadius` | 圆角，使用 Token 值 (4px) |
| `layoutMode: "HORIZONTAL"` | `layout: "horizontal"` | 水平布局 |
| `layoutMode: "VERTICAL"` | `layout: "vertical"` | 垂直布局 |
| `itemSpacing` | `gap` | 子元素间距 |
| `paddingLeft/Right/Top/Bottom` | `padding` 或分别设置 | 内边距 |
| `primaryAxisAlignItems` | `justifyContent` | 主轴对齐 |
| `counterAxisAlignItems` | `alignItems` | 交叉轴对齐 |
| `characters` (text) | `content` | 文本内容 |
| `fontSize` | `fontSize` | 对齐到字号体系 (12/14/16/20/24/36) |
| `fontFamily` | `fontFamily` | 字体族 |
| `fontWeight` | `fontWeight` | "normal" 或 "bold" |
| `lineHeightPx` / `lineHeightPercent` | `lineHeight` | 行高（倍数） |
| `absoluteBoundingBox.width` | `width` | 宽度 |
| `absoluteBoundingBox.height` | `height` | 高度 |

**颜色值处理**: 始终将裸色值反查 llms-full.txt 中的 Design Token。例如 `#5E7CE0` → `brand-primary`。在构建时使用实际 hex 值，但保持与 Token 一致。

**5.4 分批次构建**

复杂页面需要多次 `batch_design` 调用。每批控制在 25 个操作以内：

```
第 1 批: 根容器 + 顶层区块结构 (5-10 ops)
第 2 批: Header 区域内容 (10-15 ops)
第 3 批: Sidebar 区域内容 (10-15 ops)
第 4 批: Main content 区域 (15-25 ops)
第 5 批: Footer + 细节调整 (5-15 ops)
```

> **重要**: 每批 `batch_design` 调用必须使用全新的 binding 名称，不要跨批次复用 binding。

---

### Phase 6: 视觉验证与修正

**目标**: 对比 Pixso 原稿与 Pencil 输出，发现并修正差异。

**6.1 截图验证**

```
工具: pencil-get_screenshot
参数: { filePath: "TARGET_PEN", nodeId: "根屏幕节点ID" }
```

**6.2 对比检查清单**

```
- [ ] 整体布局方向和比例是否一致
- [ ] 颜色是否匹配设计令牌
- [ ] 字体大小和字重是否对齐字号体系
- [ ] 间距是否遵循 4px 网格
- [ ] 组件状态是否正确（默认/悬浮/禁用等）
- [ ] 没有元素被裁切或溢出
- [ ] 图片/图标位置是否正确
```

**6.3 修正**

发现问题后使用 `batch_design` 的 Update (U) 操作修正：

```javascript
// 修正颜色
U("nodeId", {fill: "#正确色值"})
// 修正间距
U("nodeId", {gap: 16, padding: 24})
// 修正文本
U("nodeId", {content: "正确文本", fontSize: 14})
```

**6.4 布局问题排查**

如果布局异常，使用 `snapshot_layout` 工具检查：

```
工具: pencil-snapshot_layout
参数: { filePath: "TARGET_PEN", parentId: "问题节点ID", maxDepth: 2, problemsOnly: true }
```

---

## 关键约束 | Key Constraints

### 必须遵守

1. **组件优先**: 永远优先使用设计系统中的可复用组件，而非手动重建
2. **先复制再引用**: 跨文件使用组件必须先通过 `copy_components` 复制到目标文件
3. **Token 一致**: 颜色、字号、间距必须与 llms-full.txt 中定义的 Design Token 保持一致
4. **批量复制**: 所有需复制的组件 ID 在一次 `copy_components` 调用中完成
5. **操作上限**: 每次 `batch_design` 最多 25 个操作
6. **绑定唯一**: 每次 `batch_design` 调用使用全新的 binding 名称

### 禁止事项

1. **禁止跨文件 ref**: 不能直接引用其他 .pen 文件中的组件
2. **禁止并行写入**: 不能对同一 .pen 文件并行执行 `copy_components` 或 `batch_design`
3. **禁止臆造组件 ID**: 必须从实际的 `list_components` 或 `batch_get` 结果中获取真实 ID
4. **禁止忽略 Auto Layout**: Pixso 中的 Auto Layout 必须转换为 Pencil 的 layout 属性
5. **禁止硬编码 x/y**: 当父容器使用 layout 时，子节点不应设置绝对坐标

---

## 错误处理 | Error Handling

| 场景 | 处理方式 |
|------|----------|
| Pixso URL 无效或超时 | 请求用户确认 URL 或提供 item-id |
| 组件库无 reusable 组件 | 使用 `batch_get` + 命名模式搜索，或全部手动构建 |
| `copy_components` 失败 | 检查源文件路径和组件 ID 是否正确，重试一次 |
| `batch_design` 操作回滚 | 检查错误信息，修正后重新执行该批次 |
| 截图显示布局异常 | 使用 `snapshot_layout(problemsOnly: true)` 定位问题节点 |
| 目标 .pen 文件不存在 | 使用 `open_document("new")` 创建新文件 |

---

**End of SKILL Document**
