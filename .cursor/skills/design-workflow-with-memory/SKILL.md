---
name: design-workflow-with-memory
description: 带经验记忆的端到端 UI 设计工作流。调度需求拆解、设计实现、组件审查、布局审查四个 agent 迭代完成设计，结束后将失败经验提炼到 memory 目录。设计前读取历史经验避免重复犯错。当用户要求生成 UI 设计稿、端到端设计、或带记忆的设计流程时触发。
---

# 带记忆的设计全流程

将用户需求转化为高质量 .pen 设计稿，设计前读取历史经验，结束后沉淀新经验。

```
[读取历史经验 memory/]
         ↓
① 需求拆解（design-spec-planner）
         ↓ spec/xxx.md
   ┌─ 设计-审查循环 ──────────────┐
   │ ② 设计实现（pen-design-executor）│
   │ ③ 组件审查 ──┐                │
   │ ④ 布局审查 ──┤ 并行           │
   │              ↓                │
   │  通过 → 跳出 / 未通过 → ②    │
   └────────────────────────────────┘
         ↓
⑤ 经验沉淀（design-experience-distiller）
         ↓
输出设计稿 + 更新 memory/
```

## 输入

用户提供 UI 设计需求描述。可选：
- 参考截图/页面
- 目标 .pen 文件路径（默认 `output/` 下自动命名）
- 设计规范文档路径（默认 `designsystem/devUI/llms-full.txt`）

---

## 步骤 0：读取历史经验

设计开始前，检查 `memory/` 目录是否有历史经验文件，若有则读取：

```
Read(memory/component-reuse.md)    # 组件复用经验
Read(memory/layout-quality.md)     # 布局质量经验
Read(memory/interaction-pattern.md) # 交互完整性经验
```

将经验规则作为**设计约束**传递给后续步骤，尤其是步骤 2（设计实现）。

---

## 步骤 1：需求拆解

调度 `design-spec-planner` subagent。

```
Task(subagent_type="design-spec-planner")
```

**输入**：用户原始需求 + 参考截图 + 特殊约束

**输出**：`spec/[页面名].md`

**进入下一步前检查**：
- [ ] 有整体布局描述
- [ ] 每个区块有独立小节，文案为具体业务内容
- [ ] 组件推荐表包含具体 ID
- [ ] 有实现顺序建议

---

## 步骤 2-4：设计-审查循环

```
max_iterations = 3
issues_log = []    # 累积所有轮次的问题

loop(i = 1 to max_iterations):
  ② 设计实现 / 修复
  ③④ 组件审查 + 布局审查（并行）
  
  if ③ 通过 AND ④ 通过:
    break
  else:
    issues_log.append(本轮问题)
    合并问题 → 回到 ②
```

### 步骤 2：设计实现

调度 `pen-design-executor` subagent。

```
Task(subagent_type="pen-design-executor")
```

**首轮输入**：
- 设计需求文档：`spec/[页面名].md`
- 目标文件：`output/[页面名].pen` 或 `"new"`
- 组件库：`designsystem/devUI/components/devUI2.pen`
- 设计规范：`designsystem/devUI/llms-full.txt`
- **历史经验**：步骤 0 读取的经验规则（作为额外约束传递）

**修复轮输入**（第 2 轮起）：
- 同一 .pen 文件路径（增量修改，不重建）
- 审查问题清单 + 可执行的修复建议

**传递给修复轮的格式**：

```markdown
## 待修复问题

### 组件审查问题
1. [问题描述 + 修复建议]

### 布局审查问题
1. [问题描述 + 修复建议]

请按修复建议逐项修正 .pen 文件。
```

### 步骤 3：组件审查

调度 `pen-design-component-auditor` subagent。

```
Task(subagent_type="pen-design-component-auditor")
```

**输入**：.pen 文件路径
**审查**：复制未使用的组件、应用组件却手搭的区域
**判定**：无问题 → 通过 / 有问题 → 记录问题清单

### 步骤 4：布局审查

调度 `pen-layout-auditor` subagent。

```
Task(subagent_type="pen-layout-auditor")
```

**输入**：同一 .pen 文件路径
**审查**：重叠/超出、间距混乱、缺必要交互控件
**判定**：无问题 → 通过 / 有问题 → 记录问题清单

### 并行优化

步骤 3 和 4 相互独立，并行执行：

```
parallel:
  task_a = Task(subagent_type="pen-design-component-auditor", ...)
  task_b = Task(subagent_type="pen-layout-auditor", ...)
wait(task_a, task_b)
merge results
```

### 循环控制

| 情况 | 动作 |
|------|------|
| ③④ 均通过 | 跳出循环 |
| 任一未通过 | 合并问题 → 回到步骤 2 |
| 达到 max_iterations | 强制跳出，记录未解决问题 |

---

## 步骤 5：经验沉淀

**必须执行**。循环结束后，无论是否全部通过，都执行经验提炼。

读取 `design-experience-distiller` Skill：

```
Read(.cursor/skills/design-experience-distiller/SKILL.md)
```

**经验来源**（按优先级收集）：

| 来源 | 说明 |
|------|------|
| 审查问题 | 循环中 issues_log 累积的所有组件/布局问题 |
| 设计报错 | batch_design 失败、ref 报错、copy_components 异常 |
| 用户反馈 | 对话中用户指出的设计问题或修正要求 |

**提炼流程**：
1. 从 issues_log + 对话上下文中提取所有失败信息
2. 按三大类归类：组件复用 / 布局质量 / 交互完整性
3. 每个问题提炼为一条经验规则（场景→问题→规则，≤3 句话）
4. 与 `memory/` 已有规则去重合并
5. 写入对应文件

**写入目标**：

```
memory/
├── component-reuse.md
├── layout-quality.md
└── interaction-pattern.md
```

**跳过条件**：若本次循环首轮即通过且无任何报错/用户反馈，则无新经验需沉淀，跳过此步。

---

## 步骤 6：输出汇总

向用户报告：

```markdown
## 设计完成

- **设计稿**：output/[页面名].pen
- **规范文档**：spec/[页面名].md
- **迭代次数**：X 轮
- **审查结果**：通过 / 部分通过
- **新增经验**：N 条（已保存到 memory/）
- **未解决问题**：[列表，若有]
```

---

## 调度约束

- subagent 调用**不设 `readonly: true`**
- `pen-design-executor` 需完整 MCP 工具权限
- 修复轮传递**具体问题 + 可执行修复建议**，非泛泛描述
- 修复轮在已有 .pen 上增量修改，不重建
- 每次 `batch_design` ≤ 25 个操作
