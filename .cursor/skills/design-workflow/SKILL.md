---
name: design-workflow
description: 端到端 UI 设计工作流编排。根据用户需求，依次调度需求拆解、设计实现、组件审查、布局审查四个 agent，在设计-审查循环中迭代直至通过。当用户要求生成完整的 UI 设计稿、从需求到设计稿的全流程、或需要端到端设计时触发。
---

# 设计全流程编排

将用户需求转化为高质量 .pen 设计稿的端到端工作流。

```
用户需求
  ↓
① 需求拆解（design-spec-planner）
  ↓ spec/xxx.md
② 设计实现（pen-design-executor）
  ↓ output/xxx.pen
③ 组件审查（pen-design-component-auditor）
④ 布局审查（pen-layout-auditor）
  ↓
  有问题 → 回到 ② 修复，再审查
  无问题 → 完成
```

## 输入

用户提供 UI 设计需求描述。可选附加：
- 参考截图/页面
- 目标 .pen 文件路径（默认 `output/` 下自动命名）
- 设计规范文档路径

## 步骤 1：需求拆解

调度 `design-spec-planner` subagent，将用户需求转化为结构化设计文档。

```
Task(subagent_type="design-spec-planner") 或直接调用该 agent
```

**输入给 agent**：
- 用户的原始需求描述
- 参考截图（若有）
- 特殊约束（若有）

**期望输出**：
- `spec/[页面名].md` — 包含整体布局、区块清单、组件选型、实现顺序的设计规范文档

**质量检查**：确认文档包含以下内容后才进入下一步：
- [ ] 整体布局描述
- [ ] 所有区块有独立小节
- [ ] 每个区块的文案为具体业务内容
- [ ] 组件推荐表包含具体 ID
- [ ] 实现顺序建议

---

## 步骤 2-4：设计-审查循环

步骤 2、3、4 构成一个循环，直到两项审查均通过才跳出。

```
max_iterations = 3

loop:
  ② 设计实现 / 修复
  ③ 组件审查
  ④ 布局审查
  
  if ③ 通过 AND ④ 通过:
    break → 完成
  else:
    收集问题 → 回到 ②
```

### 步骤 2：设计实现

调度 `pen-design-executor` subagent。

```
Task(subagent_type="pen-design-executor") 或直接调用该 agent
```

**首轮输入**：
- 设计需求文档：步骤 1 输出的 `spec/[页面名].md`
- 目标文件：`output/[页面名].pen` 或 `"new"`
- 组件库：`designsystem/devUI/components/devUI2.pen`
- 设计规范：`designsystem/devUI/llms-full.txt`

**修复轮输入**（循环第 2 轮起）：
- 同一 .pen 文件路径
- 审查报告中的问题清单和修复建议
- 指令：按修复建议逐项修正

### 步骤 3：组件审查

调度 `pen-design-component-auditor` subagent。

```
Task(subagent_type="pen-design-component-auditor")
```

**输入**：步骤 2 输出的 .pen 文件路径

**审查内容**：
- 复制了但未 ref 使用的组件
- 应该用组件却手动搭建的区域

**结果判定**：
- 无问题 → 组件审查通过
- 有问题 → 记录问题清单，传递给步骤 2 修复

### 步骤 4：布局审查

调度 `pen-layout-auditor` subagent。

```
Task(subagent_type="pen-layout-auditor")
```

**输入**：同一 .pen 文件路径

**审查内容**：
- 组件重叠/超出
- 间距不一致/不合理
- 缺少必要交互控件

**结果判定**：
- 无问题 → 布局审查通过
- 有问题 → 记录问题清单，传递给步骤 2 修复

### 循环控制

| 情况 | 动作 |
|------|------|
| ③④ 均通过 | 跳出循环 → 进入完成 |
| 任一未通过 | 合并问题清单 → 回到步骤 2 修复 |
| 达到 max_iterations | 强制跳出，输出当前结果 + 未解决问题清单 |

**修复轮传递给步骤 2 的信息格式**：

```markdown
## 待修复问题

### 组件审查问题（来自 pen-design-component-auditor）
1. [问题描述 + 修复建议]
2. ...

### 布局审查问题（来自 pen-layout-auditor）
1. [问题描述 + 修复建议]
2. ...

请按上述修复建议逐项修正 .pen 文件。
```

---

## 步骤 5：完成

### 输出汇总

向用户报告：
1. **设计稿路径**：`output/[页面名].pen`
2. **设计规范文档**：`spec/[页面名].md`
3. **审查结果**：通过/部分通过（附未解决问题）
4. **迭代次数**：共经过几轮设计-审查循环

### 经验沉淀（可选）

若审查中发现了问题并修复，调用 `design-experience-distiller` Skill 将失败经验提炼到 `memory/` 目录：

```
Read(.cursor/skills/design-experience-distiller/SKILL.md)
```

---

## 并行审查优化

步骤 3 和步骤 4 相互独立，可并行执行以提高效率：

```
parallel:
  task_a = Task(subagent_type="pen-design-component-auditor", ...)
  task_b = Task(subagent_type="pen-layout-auditor", ...)
wait(task_a, task_b)
merge results
```

---

## 调度注意事项

- 所有 subagent 调用**不要设置 `readonly: true`**，审查 agent 需要读取 .pen 文件结构
- `pen-design-executor` 需要完整的 MCP 工具访问权限
- 每轮循环传递给修复步骤的应是**具体的问题 + 可执行的修复建议**，而非泛泛的"有问题"
- 修复轮的 `pen-design-executor` 应在已有 .pen 文件上增量修改，不重新创建
