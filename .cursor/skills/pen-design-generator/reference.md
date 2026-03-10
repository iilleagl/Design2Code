# Pencil 设计稿生成 — 详细参考

## 1. Pencil MCP 工具速查

### 1.1 读取与发现

| 工具 | 用途 | 示例 |
|------|------|------|
| `get_editor_state` | 获取当前编辑器状态、选中节点，以及（可选）Pencil 设计 schema | 设计任务**开始时**用 `get_editor_state(include_schema=true)` 获取 schema，供后续 batch_design 构造节点；查组件时可用 `include_schema=false` |
| `open_document` | 打开 .pen 文件或创建新文件 | `open_document(filePathOrTemplate=路径)` |
| `batch_get` | 搜索/读取节点（组件发现核心工具） | `batch_get(filePath, patterns=[{reusable:true}])` |
| `snapshot_layout` | 查看布局结构 | `snapshot_layout(filePath, parentId, maxDepth=2)` |
| `get_screenshot` | 节点截图验证 | `get_screenshot(filePath, nodeId)` |
| `get_variables` | 获取变量和主题 | `get_variables(filePath)` |
| `get_guidelines` | 获取设计指南 | `get_guidelines(topic="design-system")` |
| `find_empty_space_on_canvas` | 找空白画布区域 | `find_empty_space_on_canvas(filePath, width, height, padding, direction)` |

**设计任务开始时**：先调用 `get_editor_state(include_schema=true)` 获取 Pencil 的 .pen schema，后续所有 `batch_design` 中的节点数据（I/C/R 的 nodeData、ref 的 descendants）须按该 schema 构造。

### 1.2 设计操作（batch_design）

| 操作 | 语法 | 说明 |
|------|------|------|
| 插入 | `foo=I(parent, {...})` | 创建新节点 |
| 复制 | `bar=C(nodeId, parent, {...})` | 复制现有节点 |
| 更新 | `U(path, {...})` | 修改节点属性 |
| 替换 | `baz=R(path, {...})` | 替换整个节点 |
| 移动 | `M(nodeId, parent, index)` | 移动节点位置 |
| 删除 | `D(nodeId)` | 删除节点 |
| 图片 | `G(nodeId, "stock"/"ai", prompt)` | 生成/获取图片 |

### 1.3 ref 组件与 descendants（按需求改文案/图标）

插入 `ref` 时，可用 **descendants** 字段在**同一步**内覆盖组件内部子节点的属性，无需依赖后续的 `U(path, ...)`（且 U 在某些环境下可能报错）。

**Schema 约定**（见 `schema.ts` 中 `Ref`）：
- `descendants` 为可选对象：`{ [idPath: string]: 属性覆盖 | 整节点替换 }`
- **key**：组件内部的**节点 id** 或**斜杠路径**（如 `"文本节点ID"` 或 `"父ID/子ID"`），指向要覆盖的后代节点
- **value** 两种用法：
  1. **属性覆盖**：只写要改的属性（如 `content`、`fill`），**不要**写 `id`、`type`、`children`
  2. **整节点替换**：传入完整新节点树，用于替换该后代（如卡片 header 整块替换）

**示例 — 面包屑（组件内文本节点 id：fYOAx, EdZqq, kUmvX, a4aCA, 3BnGa）：**

```javascript
breadcrumb=I(header, {
  type: "ref",
  ref: "TJHPF",
  width: "fill_container",
  descendants: {
    "fYOAx": { content: "首页" },
    "EdZqq": { content: "DigitalCity" },
    "kUmvX": { content: "代码托管" },
    "a4aCA": { content: "phoenix-sample" },
    "3BnGa": { content: "设置" }
  }
})
```

**示例 — 按钮文案（组件内 label 节点 id：z9EIT）：**

```javascript
btnCancel=I(repoActions, { type: "ref", ref: "3Hmlq", descendants: { "z9EIT": { content: "取消关注" } } })
btnFork=I(repoActions, { type: "ref", ref: "3Hmlq", descendants: { "z9EIT": { content: "Fork (793)" } } })
btnClone=I(repoActions, { type: "ref", ref: "3Hmlq", descendants: { "z9EIT": { content: "克隆/下载" } } })
```

**示例 — 页签（组件内页签文本 id：rkUIx, JbQoi, MDnYn, hju9U）：**

```javascript
tabRow=I(mainContent, {
  type: "ref",
  ref: "gVHTY",
  descendants: {
    "rkUIx": { content: "代码" },
    "JbQoi": { content: "合并请求" },
    "MDnYn": { content: "设置" },
    "hju9U": { content: "" }
  }
})
```

**示例 — 表单项（标题 id：PSfBx，辅助文本 id：Cw15e）：**

```javascript
row4=I(formCard, {
  type: "ref",
  ref: "5VEij",
  width: "fill_container",
  descendants: {
    "PSfBx": { content: "分支名规则" },
    "Cw15e": { content: "所有分支名必须匹配正则表达式。" }
  }
})
```

**如何拿到组件内节点 id**：对组件做 `batch_get(filePath, nodeIds=["组件ID"], readDepth=3, resolveInstances=true)`，在返回的子树里查要改的 text/frame 的 `id`，再把这些 id 当作 descendants 的 key。

### 1.4 跨文件组件复制

```bash
copy_components(
  source_file=组件库.pen路径,
  target_file=目标设计稿.pen路径,
  component_ids=["id1", "id2", ...]  # 支持批量
)
```

**为何复制后 batch_get 读不到新组件**：复制工具是**写磁盘**的，Pencil 里已打开的目标文件仍是**内存**中的旧版本，`batch_get` 读的是 Pencil 当前文档（内存），所以会漏掉刚复制到磁盘的组件。

**正确流程**：复制成功后**必须先**调用 `reloadfile(设计稿.pen路径)`（或按 nextStep 的 `open_document`）重新加载该文件，再对该文件执行 `batch_get` 或 `batch_design`。`copy_components` 的返回里会包含 `nextStep`，给出本次应调用的 `reloadfile` / `open_document` 参数。

注意事项：
- 支持一次复制多个组件，将所有 ID 放在一个数组中
- **不要**对同一目标文件并行调用此工具
- 复制后**必须先 open_document(目标路径) 再**对目标文件做 batch_get / batch_design

## 2. 组件发现完整流程

Pencil 不支持跨文件引用组件。使用组件库中的组件，必须分两步完成：
1. **先发现**：扫描组件库获取完整组件清单，AI 自主判断所需组件
2. **再复制**：将所需组件批量复制到目标设计稿
3. **最后使用**：在设计稿中通过 ref 引用或复制修改来使用

### 2.1 扫描组件库，获取全部可复用组件

> **核心原则**：不依赖关键词搜索，而是获取完整组件列表后由 AI 智能匹配。

```python
# 获取组件库中所有可复用组件（一次性获取全景）
batch_get(
  filePath="组件库.pen",
  patterns=[{reusable: true}],
  readDepth=2,    # 看到组件的直接子节点
  searchDepth=3   # 搜索 3 层深度
)

# 返回结果包含：
# - 每个组件的 id、name、type、reusable 标志
# - 组件尺寸（width、height）
# - 直接子节点结构（用于快速判断组件用途）
```

### 2.2 AI 分析与组件选型

根据 `batch_get` 返回的完整组件列表，AI 进行以下分析：

1. **按名称和结构分类**：将组件按功能类别归类（导航、按钮、输入、表单、卡片等）
2. **与设计需求匹配**：对照设计需求，逐个区域选择最合适的组件
3. **记录组件 ID**：为后续复制和使用建立清晰的 ID 映射

### 2.3 深度读取关键组件结构

对需要覆写子节点的组件，深度读取其完整结构：

```python
batch_get(
  filePath="组件库.pen",
  nodeIds=["关键组件ID1", "关键组件ID2", ...],
  readDepth=3,          # 看到 3 层子节点
  resolveInstances=true # 展开组件实例，看到完整结构
)
```

### 2.4 批量复制组件到设计稿（前置步骤）

```python
copy_components(
  source_file="组件库.pen",
  target_file="设计稿.pen",
  component_ids=["面包屑ID", "表单项ID", "checkboxID", "按钮ID"]
)

# 复制后确认组件已到位
batch_get(filePath="设计稿.pen", patterns=[{reusable: true}], readDepth=1)
```

注意：
- 将所有需要的 ID 放在一个数组中一次性复制
- **不要**对同一目标文件并行调用 `copy_components`

### 2.5 逐 Pattern 组件检查（设计过程中）

在设计每个新 pattern 之前，检查是否需要补充组件：

```python
# 1. 检查当前设计稿已有的可复用组件
batch_get(filePath="设计稿.pen", patterns=[{reusable: true}])

# 2. 对比当前 pattern 需求，发现缺少的组件

# 3. 从组件库补充缺少的组件
copy_components(
  source_file="组件库.pen",
  target_file="设计稿.pen",
  component_ids=["新发现需要的组件ID"]
)

# 4. 确认后开始该 pattern 的设计
```

### 2.6 优先级 1：直接 ref 引用组件

适用条件：当前页面中已有可复用组件，且完全满足需求。

```javascript
btn=I(parent, {type: "ref", ref: "按钮组件ID"})
U(btn+"/文本节点ID", {content: "确认"})
```

```javascript
breadcrumb=I(header, {type: "ref", ref: "面包屑组件ID", width: "fill_container"})
U(breadcrumb+"/第1级文本ID", {content: "首页"})
U(breadcrumb+"/第2级文本ID", {content: "项目名"})
```

### 2.7 优先级 2：复制组件后修改

适用条件：组件结构接近但部分需求不满足，需要增删改子节点。

```javascript
navbar=C("导航栏组件ID", screen, {width: "fill_container"})
U(navbar+"/标题文本ID", {content: "我的应用"})
D(navbar+"/多余菜单项ID")
newItem=R(navbar+"/旧子节点ID", {type: "text", content: "新内容"})
```

```javascript
card=C("卡片组件ID", container, {
  width: "fill_container",
  descendants: {
    "标题文本ID": {content: "自定义标题"},
    "描述文本ID": {content: "自定义描述"}
  }
})
```

### 2.8 优先级 3：根据设计规范从零创建

适用条件：确认组件索引中无匹配可复用组件后。

```javascript
container=I(parent, {
  type: "frame",
  name: "内容区",
  layout: "vertical",
  gap: 16,
  padding: 24,
  fill: "#FFFFFF",
  cornerRadius: 4,
  width: "fill_container"
})

title=I(container, {
  type: "text",
  content: "标题",
  fontSize: 16,
  fontWeight: "700",
  fill: "#252B3A",
  fontFamily: "Noto Sans SC",
  lineHeight: 1.5
})

img=I(container, {type: "frame", width: 400, height: 300, fill: "#EEF0F5", cornerRadius: 4})
G(img, "stock", "modern workspace")
```

## 3. Design Token 速查

### 浅色模式 — 核心色值

| 用途 | Token | 色值 |
|------|-------|------|
| 品牌主色 | brand-primary | #5E7CE0 |
| 主色悬浮 | brand-primary-hover | #7693F5 |
| 主色点击 | brand-primary-active | #526ECC |
| 页面背景 | bg-page | #EEF0F5 |
| 悬浮背景 | bg-hover | #F2F5FC |
| 组件底色 | bg-component | #E9EDFA |
| 主要文字 | text-primary | #252B3A |
| 次要文字 | text-secondary | #575D6C |
| 占位文字 | text-placeholder | #8A8E99 |
| 分割线 | divider | #DFE1E6 |
| 默认边框 | border-default | #ADB0B8 |
| 导航栏背景 | nav-bg | #282B33 |
| 成功 | success | #3DCCA6 |
| 警告 | warning | #FA9841 |
| 错误 | danger | #F66F6A |
| 信息 | info | #5E7CE0 |

### 排版体系

| 层级 | 字号 | 行高 | 用途 |
|------|------|------|------|
| body | 12px | 18px (1.5) | 正文 |
| card-title | 14px | 20px (~1.43) | 卡片标题 |
| page-title | 16px | 24px (1.5) | 页面标题 |
| dialog-title | 20px | 30px (1.5) | 弹窗标题 |
| number | 24px | 36px (1.5) | 数字 |
| heading | 36px | 54px (1.5) | 标题 |

### 间距规则

基础网格：4px。推荐值：4, 8, 12, 16, 20, 24, 32 px。

| 场景 | 推荐间距 |
|------|----------|
| 同组内元素 | 4-8px |
| 相关组间 | 12-16px |
| 不同区块间 | 20-32px |

### 阴影层级

| 用途 | x | y | blur | color/opacity |
|------|---|---|------|---------------|
| 卡片 | 0 | 1 | 3 | #000/10% |
| 下拉菜单 | 0 | 2 | 5 | #000/20% |
| Tooltip | 0 | 4 | 8 | #000/20% |
| 按钮 | 0 | 2 | 6 | #5E7CE0/40% |
| 弹窗 | 0 | 10 | 40 | #000/10% |
