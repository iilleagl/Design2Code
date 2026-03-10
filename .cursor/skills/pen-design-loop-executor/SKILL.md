---
name: pen-design-loop-executor
description: 根据设计需求拆解文档，在循环池中逐区域实现 .pen 设计稿。优先使用 DevUI2 组件库复用组件，组件库无法满足时从零创建。当用户提供设计需求拆解（区域清单）并要求实现设计稿，或当 ui-page-spec-writer 输出设计文档后需要执行实现时触发。
---

# 设计循环执行器

根据设计需求拆解文档，逐区域循环实现 .pen 设计稿。每个区域判断：能用组件库 → 走组件实现流程；不能 → 从零创建。

## 输入

1. **设计需求拆解文档**：包含页面整体布局、区域清单（每个区域的位置/尺寸/内容/组件选型）
2. **目标 .pen 文件路径**：设计稿输出路径（已有文件或 `"new"`）
3. **组件库路径**（默认）：`designsystem/devUI/components/devUI2.pen`
4. **设计规范文档路径**（可选）

## 工作流程

```
初始化
  ├── 获取 schema
  ├── 准备组件库索引
  └── 创建画布与顶层结构
      ↓
┌─ 循环池（逐区域）─────────────────────┐
│  取下一区域                              │
│    ↓                                     │
│  判断：组件库能否满足？                   │
│    ├─ 能 → 组件实现路径                  │
│    └─ 不能 → 从零创建路径                │
│    ↓                                     │
│  视觉验证 → 有问题则修复                 │
│    ↓                                     │
│  标记完成，回到循环顶部                   │
└──────────────────────────────────────────┘
      ↓
全页验证
```

---

### 阶段 0：初始化

**0.1 获取 Pencil Schema**

```
open_document(filePathOrTemplate=目标文件路径或"new")
get_editor_state(include_schema=true)
```

schema 决定了后续所有 `batch_design` 中节点数据的合法格式。

**0.2 读取设计规范文档**（若有）

```
Read(规范文档路径)
```

关注：颜色体系、字号、间距规则、阴影与圆角。无规范文档时使用默认 Design Token（见 [design-tokens.md](design-tokens.md)）。

**0.3 准备组件库索引**

打开组件库，获取可复用组件全景：

```
open_document(filePathOrTemplate="组件库绝对路径")
get_editor_state(include_schema=false)
```

结合 `devui2-component-guide` 规则（`.cursor/rules/devui2-component-guide.mdc`）中的选型表，建立**组件匹配索引**：按 20 类组件分类，记录每类的推荐 ID、适用场景和嵌套逻辑。

**0.4 批量预复制组件**

根据设计拆解文档，**一次性**识别所有区域需要的组件，批量复制到目标文件：

```
copy_components(source_file="组件库路径", target_file="设计稿路径", component_ids=[...])
reloadfile(file_path="设计稿路径")
batch_get(filePath="设计稿路径", patterns=[{reusable: true}])
```

强制规则：只复制 `reusable: true` 的**单个组件根 ID**，不复制展示区/分组容器。

**0.5 创建画布与顶层结构**

根据设计拆解文档的整体布局，创建页面画布和顶层分区容器：

```javascript
screen=I(document, {type:"frame", name:"页面名称", width:1920, height:1080, fill:"#EEF0F5", layout:"vertical"})
```

按需创建顶栏容器、左右分栏、主内容区等顶层结构。

---

### 阶段 1：循环池 — 逐区域实现

将设计拆解文档中的区域清单作为**任务队列**，按从上到下、从左到右的顺序，对每个区域执行以下循环。

**每个区域的循环步骤：**

#### 步骤 1：分析当前区域需求

从设计拆解文档中提取当前区域的：
- 位置与尺寸
- 布局方式（水平/垂直/网格）
- 内容描述（文案、图标、图片）
- 交互说明（状态、点击行为）
- 推荐组件（如有）

#### 步骤 2：判断组件库能否满足

参照 `devui2-component-guide` 的场景选型表，判断当前区域是否可以用组件库中的组件实现。

**判断标准：**

| 条件 | 结论 |
|------|------|
| 指南中有**完全匹配**的组件场景和推荐 ID | → 组件实现路径 |
| 指南中有**近似**组件，结构可通过 C()+U()/D() 调整 | → 组件实现路径（需改结构） |
| 当前区域是标准 UI 元素但组件库无覆盖 | → 从零创建路径 |
| 当前区域是纯定制内容（如 banner 图、自定义图表） | → 从零创建路径 |

#### 步骤 3A：组件实现路径

当组件库能满足需求时，按 `devui-component-implementer` 的工作流执行。

读取该 Skill 文件获取完整流程：

```
Read(.cursor/skills/devui-component-implementer/SKILL.md)
```

核心步骤：

1. **检查目标文件是否已有该组件**：

```
batch_get(filePath="设计稿路径", patterns=[{reusable: true}])
```

2. **若无则从组件库补充复制**（阶段 0 可能已预复制）：

```
copy_components(...) → reloadfile(...)
```

3. **读取组件子节点结构**（用于 descendants 覆写）：

```
batch_get(filePath="设计稿路径", nodeIds=["组件ID"], readDepth=3, resolveInstances=true)
```

4. **用 ref 插入并定制内容**（`batch_design`，每次 ≤ 25 操作）：

```javascript
// 方式 A：descendants 一次定制（推荐）
item=I(parent, {
  type:"ref", ref:"组件ID",
  descendants: {
    "文本ID": {content: "实际文案"},
    "占位ID": {content: "实际占位文本"}
  }
})

// 方式 B：插入后 U() 修改
item=I(parent, {type:"ref", ref:"组件ID"})
U(item+"/文本ID", {content: "实际文案"})

// 方式 C：需改结构时 C() 复制再修改
item=C("组件ID", parent, {width: "fill_container"})
U(item+"/菜单标题ID", {content: "新标题"})
D(item+"/多余子节点ID")
```

**强制**：ref 后必须修改所有文本/图标/图片，不得保留默认占位内容。

#### 步骤 3B：从零创建路径

当组件库无法满足时，参考 `pen-design-generator` 的设计规范从零创建。

读取该 Skill 文件获取完整规范：

```
Read(.cursor/skills/pen-design-generator/SKILL.md)
```

核心要点：

```javascript
// 创建容器
container=I(parent, {
  type:"frame", name:"区域名称",
  layout:"vertical", gap:16, padding:"24 24 24 24",
  fill:"#FFFFFF", cornerRadius:4, width:"fill_container"
})

// 创建文本
title=I(container, {
  type:"text", content:"标题文本",
  fontSize:16, fontWeight:"700", fill:"#252B3A",
  fontFamily:"Noto Sans SC", lineHeight:1.5
})

// 创建图片
imgFrame=I(container, {type:"frame", width:400, height:300, fill:"#EEF0F5", cornerRadius:4})
G(imgFrame, "stock", "图片描述")
```

严格遵循 Design Token：
- 字号：12/14/16/20/24/36 px
- 间距：4 的倍数
- 颜色：`#252B3A`(主文字) `#575D6C`(次文字) `#5E7CE0`(品牌色) `#EEF0F5`(背景)
- 圆角：4px，字体：`Noto Sans SC`

#### 步骤 4：视觉验证

```
get_screenshot(nodeId="当前区域节点ID")
```

检查清单：
- [ ] 布局无重叠、无溢出
- [ ] 间距符合 4px 网格
- [ ] 文案已替换为实际业务内容
- [ ] 组件状态正确
- [ ] 颜色使用 Design Token

发现问题立即修复后再进入下一区域。

#### 步骤 5：标记完成，进入下一区域

更新进度，取任务队列中下一个区域，重复步骤 1-4。

---

### 阶段 2：全页验证

所有区域完成后：

```
get_screenshot(nodeId="页面根节点ID")
```

检查：
- [ ] 整体布局与设计拆解文档一致
- [ ] 所有区域均已实现
- [ ] 全局间距和对齐一致
- [ ] 无遗漏的占位内容

---

## Placeholder 管理

设计区域前标记 placeholder，完成后移除：

```javascript
area=I(parent, {type:"frame", placeholder:true, name:"待实现区域", width:..., height:...})
// ... 填充内容 ...
U("区域ID", {placeholder: false})
```

## batch_design 限制

每次 `batch_design` 调用控制在 **25 个操作以内**。复杂区域分多次调用完成。

## 详细参考

- Design Token 速查：[design-tokens.md](design-tokens.md)
- 组件选型指南：项目规则 `devui2-component-guide`
- 组件实现详情：`.cursor/skills/devui-component-implementer/SKILL.md`
- 从零创建规范：`.cursor/skills/pen-design-generator/SKILL.md` 及其 `reference.md`
