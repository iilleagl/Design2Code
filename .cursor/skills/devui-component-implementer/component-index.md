# DevUI2 组件完整索引

组件库路径：`designsystem/devUI/components/devUI2.pen`

> 以 `.` 开头的是基础子组件，通常不直接使用。

---

## 按钮 Button

| 类型 | ID | 尺寸/状态 |
|------|----|-----------|
| 按钮-主要 | `K9tFF` `RoYUx` `VoApM` | lg / md / sm, 各有 default/hover/active/disabled |
| 按钮-次要 | `UQ59s` `qTc8e` `9auaH` | lg / md / sm |
| 图标文本按钮 | `hOrvp` `pQrIo` | md / sm |
| 可下拉次要组合 | `XE86l`(icon) `hrHhN`(number) | md |

尺寸规则：lg=页面主操作，md=表单/卡片，sm=表格行内。

---

## 页签 Tabs

| 类型 | 2项 | 3项 | 4项 |
|------|-----|-----|-----|
| Pills（胶囊） | `Fyjni` | `cee0f` | `Mtrw0` |
| Tabs（下划线） | `6gvC2` | `hbi7t` | `nCtvQ` |
| Wrapped（卡片式） | `ABY1y` | `dl8H7` | `ulUOy` |
| Icon（带图标） | `mOgNp` | `Qrd7b` | — |
| 纯图标页签 | `RcvJ4` | `n92Tu` | — |

基础子组件（以 `.` 开头）：`.页签 Pills` `cjfjz`(default) `TAtN1`(active) | `.页签 Wrapped` 等。

---

## 面包屑 BreadCrumbs

| 层级 | ID |
|------|----|
| 2层 | `WYqKP` |
| 3层 | `iLVzA` |
| 4层 | `jGzKJ` |
| 5层 | `AnLIL` |
| 6层 | `rC1xU` |
| 省略 | `mkJuD` |

嵌套：面包屑组 = `.基础面包屑组件` + `.分隔符` 交替排列。

---

## 标签 Tag

| 类型 | green | orange | red | grey |
|------|-------|--------|-----|------|
| 标签 | `PXlZz` | `qWlVQ` | — | — |
| 辅助标签 | `wcoqv` | — | — | `JQE2Y` |
| 线性标签 | `rqTmW` | `UyGV1` | `VnbP7` | — |
| 常规标签 | `6LAHt`(md) `WZFF6`(lg) |

颜色规则：green=成功，orange=警告，red=错误，grey=默认。

---

## 搜索框 Search

| 状态 | 左侧图标 | 右侧图标 |
|------|----------|----------|
| default-noContent | `X93Mt` | `xzhr5` |
| hover | `pepLz` | `adNq4` |
| activation-inputPending | `WHVQH` | — |
| activation-Entered | `oEnOn` | — |
| contentpresent | `mAhsw` | — |
| disabled | `rkdw1` | — |

推荐默认：`X93Mt`（左侧图标 + 空状态）。

---

## 复选框 Checkbox

| 类型 | 未选 | 已选 | 半选 |
|------|------|------|------|
| 纯复选框 | `bzYOF` | `S2hIB` | `c45Iy` |
| 复选框+文本 | `f0TO6` | `4q9SP` | `JEIKW` |

---

## 分页器 Pagination

- 标准分页：`i5IDo`
- 带跳转：`9iCrn`

---

## 输入框 TextInput

| 场景 | ID | 说明 |
|------|----|------|
| 文本输入框 | `jmCZP`(空) `wSpES`(有内容) `oWwr5`(hover) `YqLWX`(focus) | |
| 数字输入框 | `1ggPm`(default) `wZSGs`(hover) | |
| 表单项-文本输入框 | `Laiht`(基础/空) `IKx4V`(必填/空) | 含标签+输入框+辅助文本 |
| 表单标题 | `byJ1L`(基础) `Rl404`(必填) `VPtKX`(必填+提示) | |

表单项属性：`状态-status`、`必选图标-required`、`提示图标-helpTips`、`是否展示辅助文本-showExtraInfo`

---

## 选择框 Select

| 场景 | ID |
|------|----|
| 下拉（关/未选） | `wDKSI` |
| 下拉（关/已选） | `PdpLn` |
| 下拉（开/未选） | `of7nh` |
| 多选 | `QHiNZ`(default) `6R9AA`(active) |
| 表单项-下拉选择框 | `qw7Ux`(空) `NckfV`(已选) |
| 基础选择面板 | `XuL3k` |
| 下拉选项（单选） | `YMDWJ`(default) `PnXfY`(hover) `tvnN1`(选中) |
| 下拉选项（多选） | `uaM8v`(default) `RMaKH`(hover) `QjHQl`(选中) |
| 下拉选项（带图标） | `yyE0a` |

---

## 表格 DataTable

| 样式 | 有阴影 | 无阴影 |
|------|--------|--------|
| 单线 | `35iCd` | `aIr8R` |
| 带分隔线 | `e9Fdp` | `ZxEIK` |

表体单项 contentType：`text` `link` `treeStructure` `statusWithName` `iconWithLabelAndTitle` `textWithLabel` `tags` `labelWithText` `priorityLevel` `perationColumn` `checkBox`

子组件：
- `.操作列`：`IcutX`(3操作) `ED8JJ`(2操作) `RDeTa`(1操作)
- `.priority-flag`：`QFgfR`(低) `1RjoZ`(中) `4031i`(高)
- `.状态图标`：`ZxnlF`(success) `4h5bF`(info) `01K6T`(warning)

---

## 筛选 Filter

| 类型 | default | hover | active |
|------|---------|-------|--------|
| 简易 | `8hidv` | `JmGHs` | `UrLRQ` |
| 复杂 | `dXtcd` | `GY9J9` | `cNpeY` |

筛选选择面板：`Hk6wG`(3项) `89xhB`(4项) `oIVzC`(5项) `fGhHM`(6项)

---

## 分类搜索 CategorySearch

- 默认/关：`Pts3s`  默认/开：`9M9md`
- 输入/关：`gSAa5`  输入/开：`njZwa`

---

## 表单 Form

| 场景 | 带按钮 | 无按钮 |
|------|--------|--------|
| 下拉选择表单 | `PQwRQ` | `jbFdp` |
| 输入框表单 | `hzV0w` | `xdkiR` |

---

## 卡片 Cards

| 类型 | 默认 | 悬浮 |
|------|------|------|
| 项目卡片 | `LcKkl` | `HOW5Y` |
| 基本卡片 | `7ipso` | `Y07Dq` |
| 带图卡片 | `rKwK1` | `kTkmb` |
| 基本卡片容器 | `YCOKr` `WLYWO` | |

子组件：
- `.有图标标题`：`AcYr4`(标题图标off/右侧图标on) `hX9h2`(全on) `jG3Sg`(全off)
- `.无图标标题`：`I1uwM`(副标题off) `86i3l`(副标题on)
- `.信息展示`：`bzUgt`(图标on/md) `znCAX`(图标off/md)
- 卡片icon：`5oHlW`(默认) `qV5cG`(关注) `4r27Q`(归档)

---

## 业务组件

- 左侧选择菜单卡片：`6aBNN`
- banner卡片：`wxO2j`
- banner：`lSc0M`
- 公告卡片：`3kAYs`
- 活动卡片：`ioZGG`

---

## 头信息 Header

- 默认：`Xxf4j`
- 带搜索（2项）：`p1nGW`
- 多搜索（3项）：`psp7m`  （4项）：`b6iRO`

---

## 导航组件

### 工具链专用导航

- 展开：`JGEqF`  收起：`BBmtw`
- 选择项目：`6kK3G`(收起) `3dEjL`(展开) `YFUUW`(收起+下拉) `nX4ck`(展开+下拉)
- 一级菜单（展开）：`QOgvs`(0个二级) `RkIsL`(2个) `prLam`(3个) `s8rZy`(4个)
- 热区按钮：`NwG5t`(展开) `sI2EG`(收起) `656hI`(展开+文本)

### 手风琴侧边栏

- 完整侧边栏：`kyl45`
- 一级菜单组：`zdBwX`(1个) ~ `pimh9`(9个)
- .一级菜单状态：`5VPc9`(default) `YQ0mo`(expand) `GPTQW`(hover) `qVkDb`(active)

### 顶部导航栏

- 默认：`Rpv7B`  占位：`qPAD7`
- 菜单组：`hAO4n`(2项) ~ `9xpjZ`(6项)
- 右侧图标：`S7wd4` `AtXX6` `R4lZq`
- 头像信息：`mrj2n`(default) `VQMoS`(hover)

---

## 图标资源

| 类型 | Frame ID | 尺寸 |
|------|----------|------|
| 操作图标 | `QY5Bx` | 16px |
| 字母图标(48) | `SYWnk` | 48px |
| 字母图标(32) | `HEF9Q` | 32px |
| 数字+字母图标 | `QEl7l` | 48px |
| 2D服务图标 | `c3mAv` | 16px |
| 质感图标 | `iIj5S` | 24px |
| 顶部导航质感图标 | `wqMp8` | 24px |

---

## 实现示例

### 示例 1：表单区域（两个输入项 + 下拉 + 按钮组）

```javascript
// 表单容器
form=I(content, {type:"frame", name:"表单", layout:"vertical", gap:16, padding:"24 24 24 24"})

// 必填文本输入项
nameInput=I(form, {type:"ref", ref:"IKx4V", descendants:{
  "标签文本ID": {content:"仓库名称"},
  "占位文本ID": {content:"请输入英文仓库名称"}
}})

// 可选文本输入项
descInput=I(form, {type:"ref", ref:"Laiht", descendants:{
  "标签文本ID": {content:"描述"},
  "占位文本ID": {content:"请输入仓库描述（可选）"}
}})

// 下拉选择
langSelect=I(form, {type:"ref", ref:"qw7Ux", descendants:{
  "标签文本ID": {content:"开发语言"},
  "占位文本ID": {content:"请选择"}
}})

// 按钮组
btnGroup=I(form, {type:"frame", name:"按钮组", layout:"horizontal", gap:8})
submitBtn=I(btnGroup, {type:"ref", ref:"RoYUx", descendants:{"按钮文本ID":{content:"创建"}}})
cancelBtn=I(btnGroup, {type:"ref", ref:"qTc8e", descendants:{"按钮文本ID":{content:"取消"}}})
```

### 示例 2：数据列表页头部（搜索 + 筛选 + 按钮）

```javascript
toolbar=I(main, {type:"frame", name:"工具栏", layout:"horizontal", gap:8, align:"center"})
search=I(toolbar, {type:"ref", ref:"X93Mt", width:320})
filter=I(toolbar, {type:"ref", ref:"8hidv"})
spacer=I(toolbar, {type:"frame", width:"fill_container", height:1})
addBtn=I(toolbar, {type:"ref", ref:"hOrvp", descendants:{"按钮文本ID":{content:"新建服务"}}})
```
