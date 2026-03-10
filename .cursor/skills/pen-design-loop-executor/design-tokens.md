# Design Token 速查

从零创建区域时使用的设计规范值。

## 核心色值（浅色模式）

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

## 排版

| 层级 | 字号 | 行高 | 用途 |
|------|------|------|------|
| body | 12px | 1.5 | 正文、辅助文字 |
| card-title | 14px | ~1.43 | 卡片标题、表单标签 |
| page-title | 16px | 1.5 | 页面标题、区域标题 |
| dialog-title | 20px | 1.5 | 弹窗标题 |
| number | 24px | 1.5 | 数字强调 |
| heading | 36px | 1.5 | 大标题 |

字体：`Noto Sans SC`

## 间距

基础网格：4px。推荐值：4, 8, 12, 16, 20, 24, 32 px。

| 场景 | 推荐间距 |
|------|----------|
| 同组内元素间 | 4-8px |
| 相关组之间 | 12-16px |
| 不同区块间 | 20-32px |
| 容器内边距 | 16-24px |

## 圆角

- 默认：4px
- 小组件（标签/徽章）：2px
- 大容器（弹窗/卡片）：4-8px

## 阴影

| 用途 | x | y | blur | color/opacity |
|------|---|---|------|---------------|
| 卡片 | 0 | 1 | 3 | #000/10% |
| 下拉菜单 | 0 | 2 | 5 | #000/20% |
| Tooltip | 0 | 4 | 8 | #000/20% |
| 按钮 | 0 | 2 | 6 | #5E7CE0/40% |
| 弹窗 | 0 | 10 | 40 | #000/10% |
