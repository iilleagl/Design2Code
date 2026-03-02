# Pencil 设计稿生成 — 详细参考

## 1. Pencil MCP 工具速查

### 1.1 读取与发现

| 工具 | 用途 | 示例 |
|------|------|------|
| `get_editor_state` | 获取当前编辑器状态和选中节点 | `get_editor_state(include_schema=true)` |
| `batch_get` | 搜索/读取节点 | `batch_get(filePath, patterns=[{reusable:true}])` |
| `snapshot_layout` | 查看布局结构 | `snapshot_layout(filePath, parentId, maxDepth=2)` |
| `get_screenshot` | 节点截图验证 | `get_screenshot(filePath, nodeId)` |
| `get_variables` | 获取变量和主题 | `get_variables(filePath)` |
| `get_guidelines` | 获取设计指南 | `get_guidelines(topic="web-app")` |
| `find_empty_space_on_canvas` | 找空白画布区域 | `find_empty_space_on_canvas(filePath, width, height, padding, direction)` |

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

### 1.3 跨文件组件复制

```bash
copy_components(
  source_file=组件库.pen路径,
  target_file=目标设计稿.pen路径,
  component_ids=["id1", "id2", ...]  # 支持批量
)
```

注意事项：
- 支持一次复制多个组件，将所有 ID 放在一个数组中
- **不要**对同一目标文件并行调用此工具
- 复制后需在编辑器中重新加载文件

### 1.4 组件搜索

```bash
# 在组件库中搜索组件
search_components(file_path=组件库路径, keyword="按钮")

# 列出所有可复用组件
list_components(file_path=组件库路径)
```

## 2. 组件使用完整流程

Pencil 不支持跨文件引用组件。使用组件库中的组件，必须分两步完成：
1. **先复制**：将组件从组件库 .pen 文件复制到当前设计稿 .pen 文件
2. **再使用**：在设计稿中通过 ref 引用或复制修改来使用组件

### 2.1 搜索组件库，获取真实 ID

> **重要**：不要直接使用文档中硬编码的组件 ID。组件库更新后 ID 会变化，必须通过实际搜索获取。

```python
# 按关键词搜索，从结果中筛选 reusable: true 的组件
search_components(file_path="组件库.pen", keyword="导航")
search_components(file_path="组件库.pen", keyword="按钮")
search_components(file_path="组件库.pen", keyword="面包屑")
search_components(file_path="组件库.pen", keyword="checkbox")
search_components(file_path="组件库.pen", keyword="表单项")
search_components(file_path="组件库.pen", keyword="输入框")

# 深度读取组件结构，了解内部子节点 ID（后续覆写时需要）
batch_get(filePath="组件库.pen", nodeIds=["搜到的真实ID"], readDepth=3)
```

### 2.2 批量复制组件到设计稿（前置步骤）

```python
# 将所有需要的组件一次性复制到设计稿
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

### 2.3 优先级 1：直接 ref 引用组件

适用条件：当前页面中已有可复用组件，且完全满足需求。

```javascript
// 插入组件实例
btn=I(parent, {type: "ref", ref: "按钮组件ID"})

// 覆写实例内部节点的属性（文本、颜色等）
U(btn+"/文本节点ID", {content: "确认"})
```

```javascript
// 引用面包屑组件并覆写各层级文本
breadcrumb=I(header, {type: "ref", ref: "面包屑组件ID", width: "fill_container"})
U(breadcrumb+"/第1级文本ID", {content: "首页"})
U(breadcrumb+"/第2级文本ID", {content: "项目名"})
```

### 2.4 优先级 2：复制组件后修改

适用条件：组件结构接近但部分需求不满足，需要增删改子节点。

```javascript
// C 操作复制组件创建副本
navbar=C("导航栏组件ID", screen, {width: "fill_container"})

// 修改副本中的子节点
U(navbar+"/标题文本ID", {content: "我的应用"})
D(navbar+"/多余菜单项ID")
newItem=R(navbar+"/旧子节点ID", {type: "text", content: "新内容"})
```

```javascript
// 使用 descendants 属性在复制时直接覆写
card=C("卡片组件ID", container, {
  width: "fill_container",
  descendants: {
    "标题文本ID": {content: "自定义标题"},
    "描述文本ID": {content: "自定义描述"}
  }
})
```

### 2.5 优先级 3：根据设计规范从零创建

适用条件：确认无匹配可复用组件后（必须先通过 `search_components` 搜索确认）。

```javascript
// Frame 容器
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

// 文本节点
title=I(container, {
  type: "text",
  content: "标题",
  fontSize: 16,
  fontWeight: "700",
  fill: "#252B3A",
  fontFamily: "Noto Sans SC",
  lineHeight: 1.5
})

// 图片占位
img=I(container, {type: "frame", width: 400, height: 300, fill: "#EEF0F5", cornerRadius: 4})
G(img, "stock", "modern workspace")
```

## 3. DevUI 组件 ID 速查

> **警告**：以下 ID 仅为参考索引，可能因组件库版本更新而失效。实际使用时**必须**通过 `search_components` 搜索获取真实 ID，并从结果中筛选 `reusable: true` 的组件。

### 导航类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 顶部导航栏 (默认) | J7Na7 | 1920×40 |
| 顶部导航栏 (变体1) | o4ysM | 1920×40 |
| 顶部导航栏 (变体2) | BH50x | 1920×40 |
| 面包屑 | 0HCYy | - |
| 手风琴侧栏/默认 | Ps2QO | 192×800 |
| 手风琴侧栏/选中二级菜单 | j4ck0 | 192×800 |
| 左侧边栏/默认 | 8C9TN | 40×912 |
| 左侧边栏/展开默认 | CdEfs | 200×912 |
| 标签页 tab | 59j8x | 220×32 |
| 步骤条 | 4TAVt | 500×58 |
| 云龙导航/一级菜单展开 | q756r | 1920×48 |
| 云龙导航/二级 | TXxwm | 1920×40 |

### 按钮类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 主按钮/L/默认 | dQo4K | 72×32 |
| 主按钮/M/默认 | A8yYa | 64×28 |
| 主按钮/S/默认 | fg1KQ | 56×24 |
| 次按钮/L/默认 | qVoo7 | 72×32 |
| 次按钮/M/默认 | FbW1D | 64×28 |
| 文本按钮/默认 | PuHuY | 48×18 |
| 图标按钮/默认 | ZLpVX | 28×28 |
| 带边框文本+图标/默认 | jdW6j | 97×28 |
| 带图标下拉/默认 | WZNFE | 120×28 |

### 输入类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 单行文本框/默认 | ItmJi | 200×28 |
| 多行文本框/默认 | mB80m | 200×100 |
| 自动补齐输入框/默认 | ADF9r | 400×28 |
| 数字输入框/默认 | C9rTx | 63×28 |
| 微调器/默认 | iA4bC | 90×28 |

### 选择类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 下拉框/默认 | PghtN | 200×28 |
| 下拉框/展开 | DwCH6 | 200×190 |
| 无框下拉/默认 | t3YzH | 82×28 |
| 下拉复选框/默认 | WnGYs | 232×28 |

### 卡片类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 基本卡片 | YCOKr | 380×auto |
| 卡片/大标题 | SobM3 | 400×82 |
| 卡片/小标题 | sRrFd | 400×82 |
| 卡片/操作模板/默认 | VkkjX | 422×82 |
| 卡片/按钮样式/默认 | cte52 | 200×70 |

### 提示类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 全局通知/成功 | 5Ybq9 | 210×38 |
| 全局通知/错误 | UtbT3 | 210×38 |
| Banner通知/成功 | iC3Xs | 520×42 |
| 文字提示/单行 | vimvd | 149×28 |
| 通知/成功 | iUh9e | 300×34 |

### 弹窗类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 弹窗/960 | 7lIky | 960×344 |
| 弹窗/800 | kBLwP | 800×344 |
| 弹窗/600 | KXQVF | 600×224 |
| 弹窗/400 | RecdT | 400×224 |
| 弹窗/带图标 | SRlFB | 400×164 |

### 表单类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 表单/选择 | nkTEu | 200×50 |
| 表单/输入 | 5FAv5 | 200×50 |
| 表单/标签 | X1hNe | 200×50 |
| 表单/错误 | DRXVB | 200×76 |
| 表单/单选 | 4iDw9 | 134×50 |

### 分页类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 分页/完整/默认 | hy4or | 482×24 |
| 分页/精简/默认 | pDl8h | 204×24 |

### 日期类
| 组件 | Node ID | 尺寸 |
|------|---------|------|
| 年月选择 | 1jd9d | 122×220 |
| 日期选择 | 6OSkG | 252×272 |
| 日期区间选择 | eyCnn | 520×272 |

## 4. Design Token 速查

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
