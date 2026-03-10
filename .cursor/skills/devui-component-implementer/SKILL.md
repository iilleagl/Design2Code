---
name: devui-component-implementer
description: 根据设计需求，从 DevUI2 组件库中选择并实现组件。负责组件选型、复制、ref 实例化与内容定制。当用户要求使用 DevUI 组件库实现 UI 区块、页面区域、表单、表格、导航或卡片等组件设计时触发。
---

# DevUI 组件实现

根据设计需求，从 `designsystem/devUI/components/devUI2.pen` 选择组件并在目标 `.pen` 文件中实现。

## 前置条件

- 组件使用指南：读取项目规则 `devui2-component-guide`（`.cursor/rules/devui2-component-guide.mdc`），获取 20 类组件的场景选型表、嵌套逻辑和推荐 ID
- 组件库路径：`designsystem/devUI/components/devUI2.pen`（705 个可复用组件）
- 跨文件不能直接 ref，必须先 `copy_components` 到目标文件

## 工作流程

### 1. 需求分析 → 组件选型

将设计需求拆解为**组件清单**，参照组件指南选型。

**选型速查**（完整列表见 [component-index.md](component-index.md)）：

| 需求 | 组件 | 推荐 ID |
|------|------|---------|
| 主按钮 | 按钮-主要 | `RoYUx`(md) `VoApM`(sm) `K9tFF`(lg) |
| 次要按钮 | 按钮-次要 | `qTc8e`(md) `9auaH`(sm) `UQ59s`(lg) |
| 图标按钮 | 按钮-图标文本按钮 | `hOrvp`(md) `pQrIo`(sm) |
| 文本输入（带标签） | 表单项-文本输入框 | `Laiht`(基础) `IKx4V`(必填) |
| 下拉选择（带标签） | 表单项-下拉选择框 | `qw7Ux`(空) `NckfV`(已选) |
| 搜索框 | 搜索框 | `X93Mt` |
| 复选框+文字 | 复选框文本组合 | `f0TO6`(未选) `4q9SP`(已选) |
| 数据表格 | 表格 | `35iCd`(有阴影) `aIr8R`(无阴影) |
| 分页 | 分页 Pagination | `i5IDo`(标准) `9iCrn`(带跳转) |
| 页签（胶囊） | 页签Pills | `Fyjni`(2) `cee0f`(3) `Mtrw0`(4) |
| 页签（下划线） | 页签Tabs | `6gvC2`(2) `hbi7t`(3) `nCtvQ`(4) |
| 面包屑 | 面包屑组 | `WYqKP`(2层) `iLVzA`(3层) `jGzKJ`(4层) |
| 顶部导航 | 顶部导航栏 | `Rpv7B` |
| 工具链侧栏 | 工具链专用导航 | `JGEqF`(展开) `BBmtw`(收起) |
| 手风琴侧栏 | 侧边导航-手风琴 | `kyl45` |
| 头信息 | 头信息 | `Xxf4j`(默认) `p1nGW`(带搜索) |
| 基本卡片 | 基本卡片 | `7ipso` |
| 项目卡片 | 项目卡片 | `LcKkl` |
| 筛选 | 筛选 | `8hidv`(简易) `dXtcd`(复杂) |
| 标签 | 标签/辅助标签 | `PXlZz`(green) `qWlVQ`(orange) |

### 2. 读取组件内部结构

对选中的组件，从组件库按 ID 读取子节点信息：

```
open_document(filePathOrTemplate="组件库绝对路径")
batch_get(filePath="组件库路径", nodeIds=["ID1","ID2",...], readDepth=3, resolveInstances=true)
```

**记录每个组件的子节点 ID**（文本、图标等），后续用于 `descendants` 覆写。

### 3. 复制组件到目标文件

**强制规则**：只复制单个 `reusable: true` 组件根 ID，不复制展示区/分组容器。

```
copy_components(source_file="组件库路径", target_file="设计稿路径", component_ids=["ID1","ID2",...])
reloadfile(file_path="设计稿路径")
batch_get(filePath="设计稿路径", patterns=[{reusable: true}])
```

### 4. 实例化与定制（核心步骤）

用 `batch_design`（每次 ≤ 25 个操作）插入组件实例并修改内容。

**强制规则：使用 ref 引用组件时，必须在 `descendants` 中将组件内所有文本图层修改为符合设计需求的实际文案。禁止省略 descendants，禁止保留任何默认占位文本。**

**步骤**：
1. 在步骤 2 中已读取组件内部结构（`readDepth=3, resolveInstances=true`），找出所有 text 类型子节点的 ID
2. 根据设计需求，为每个 text 子节点准备对应的实际文案
3. 插入 ref 时，在 `descendants` 中**逐一列出所有文本图层**并赋予实际内容

**标准用法（必须遵守）**：

```javascript
input=I(formArea, {
  type: "ref", ref: "Laiht",
  descendants: {
    "标签文本ID": {content: "仓库名称"},
    "占位文本ID": {content: "请输入仓库名称"}
  }
})
```

**多文本组件示例 — 面包屑（3层 `iLVzA`）**：

```javascript
bread=I(headerArea, {
  type: "ref", ref: "iLVzA",
  descendants: {
    "层级1文本ID": {content: "首页"},
    "层级2文本ID": {content: "项目管理"},
    "层级3文本ID": {content: "仓库设置"}
  }
})
```

**多文本组件示例 — 页签（4项 `nCtvQ`）**：

```javascript
tabs=I(contentArea, {
  type: "ref", ref: "nCtvQ",
  descendants: {
    "tab1文本ID": {content: "基本信息"},
    "tab2文本ID": {content: "成员管理"},
    "tab3文本ID": {content: "权限设置"},
    "tab4文本ID": {content: "操作日志"}
  }
})
```

**需要改结构时用 C() 复制后修改（同样必须改文本）**：

```javascript
nav=C("JGEqF", screen, {width: 288})
U(nav+"/菜单标题ID", {content: "代码托管"})
U(nav+"/子菜单1ID", {content: "仓库列表"})
U(nav+"/子菜单2ID", {content: "分支管理"})
D(nav+"/多余菜单ID")
```

**禁止以下写法**（缺少 descendants 或遗漏文本图层）：

```javascript
// 错误：未提供 descendants
input=I(formArea, {type: "ref", ref: "Laiht"})

// 错误：只改了部分文本，遗漏了占位文本
input=I(formArea, {
  type: "ref", ref: "Laiht",
  descendants: {
    "标签文本ID": {content: "仓库名称"}
    // 缺少占位文本ID的修改！
  }
})
```

### 5. 根据需求定制内容（必须执行）

组件插入后，**必须逐项检查并替换**组件内所有面向用户的内容，使其完全匹配当前设计需求：

| 检查项 | 操作 | 示例 |
|--------|------|------|
| **按钮文案** | 替换为实际操作动词 | "主要按钮" → "提交" / "新建仓库" |
| **标签/标题文本** | 替换为实际字段名 | "标签" → "仓库名称" |
| **占位提示文本** | 替换为实际输入提示 | "请输入" → "请输入英文仓库名称" |
| **面包屑层级** | 替换为实际导航路径 | "层级1/层级2" → "首页/项目管理" |
| **导航菜单项** | 替换为实际功能名称 | "菜单项1" → "代码托管" |
| **页签文案** | 替换为实际分类名 | "选项一" → "基本信息" |
| **表头文案** | 替换为实际列名 | "列标题" → "仓库名称" |
| **图标** | 替换为语义匹配的图标 | 默认图标 → 对应业务图标 |
| **图片** | 替换为实际内容或相关素材 | 占位图 → `G(nodeId, "stock", "描述")` |

**自检清单**（每个组件实例必过）：
- [ ] ref 插入时是否提供了 `descendants` 参数？
- [ ] `descendants` 是否覆盖了组件内**所有** text 类型子节点？
- [ ] 所有可见文本是否已替换为需求中的实际文案？
- [ ] 是否还残留 "主要按钮""请输入""标签""选项一" 等默认占位？
- [ ] 图标是否与当前业务语义匹配？
- [ ] 若需求未明确文案，是否根据上下文合理推断（而非留空/留默认）？

### 6. Placeholder 管理

```javascript
// 开始设计区块时
container=I(parent, {type: "frame", placeholder: true, ...})
// ... 填充内容 ...
// 完成后移除 placeholder
U("容器ID", {placeholder: false})
```

### 7. 视觉验证

每完成一个区块用截图检查：

```
get_screenshot(nodeId="区块ID")
```

检查：布局无重叠、间距符合 4px 网格、文案已替换、状态正确。

---

## 组件使用优先级

| 优先级 | 条件 | 操作 |
|--------|------|------|
| 1 | 目标文件已有该组件 | `I({type:"ref", ref:"ID", descendants:{所有文本ID:{content:"实际文案"}}})` |
| 2 | 组件库有匹配组件 | `copy_components` → `reloadfile` → ref + descendants 改全部文本 |
| 3 | 组件结构接近但需改 | `C()` 复制 + `U()` 修改所有文本/图标 + `D()` 删多余 |
| 4 | 无匹配组件 | 按设计规范从零创建（Design Token） |

选择优先级 4 前，**必须确认**已查阅组件指南和组件库，确实无匹配组件。

---

## 设计规范

- **字号**：12/14/16/20/24/36 px
- **间距**：4 的倍数（4/8/12/16/20/24/32）
- **圆角**：默认 4px，小组件 2px
- **字体**：`Noto Sans SC`
- **颜色**：使用 Design Token，不用任意色值

## 详细参考

- 完整组件 ID 索引见 [component-index.md](component-index.md)
- 组件嵌套逻辑和场景选型详见项目规则 `devui2-component-guide`
