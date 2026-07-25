# ADR-008: `lp` 循环边界、预算和作用域规则

## Status

Accepted

## Date

2026-07-16

## Context

上游 #3 将 `lp` 描述为循环能力，计划中的浏览器核心也需要它服务“多段掷骰 + 临时变量 + 条件选择 + 受预算约束循环”。`lp` 与此前的 tuple 运算符不同：它不是只消费一个已经求值完成的 tuple，而是会多次执行循环体表达式。若不先固定边界、预算和作用域规则，会产生三类不可回滚风险：

- 浏览器 UI 可能被大量同步循环阻塞。
- 循环变量 `i` 可能泄漏到外层 program 变量表。
- 三元素边界 `[1,2,5]` 可能与 ADR-007 的 `sp[leftBoundary,step,end]` 规则冲突。

ADR-004 已经要求 `lp` 最后实现，并要求循环体使用 tuple-required body。ADR-007 已经把 `sp` 的三参数形式固化为 `[leftBoundary, step, end]`。`lp` 应当沿用同一用户可见边界模型，避免让 `sp[1,2,5]` 和 `[1,2,5]lp[...]` 采用两套不同直觉。

## Decision

`lp` 必须作为 `features.loopOperator` 下的高风险能力实现。默认 `dice()` 和 `roll()` 遇到 `lp` 必须抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='loopOperator'`。

`lp` 的左侧边界必须在进入循环体前一次性求值并归一化为：

```ts
interface LoopBounds {
  start: number
  end: number
  step: number
  count: number
  source: 'scalar' | 'tuple'
}
```

边界形式如下：

| 形式 | 含义 | 循环变量序列 |
| --- | --- | --- |
| `Nlp[...]` | 从 1 到 N，步进 1 | `1,2,...,N` |
| `[N]lp[...]` | 单元素 tuple 等同标量 | `1,2,...,N` |
| `[start,end]lp[...]` | 闭区间，步进 1 | `start,start+1,...,end` |
| `[leftBoundary,step,end]lp[...]` | 与 `sp` 一致的左边界后开区间 | `leftBoundary+step,leftBoundary+2*step,...,<=end` |

三元素形式必须采用 `[leftBoundary, step, end]`，而不是 `[start, end, step]`。因此 `[1,2,5]lp[...]` 的 `i` 序列是 `3,5`。这与 ADR-007 中 `sp[1,2,5]` 选择用户可见位置 `2,4` 的“左界之后，按步长前进”原则一致：`sp` 的结果受现有 tuple 索引约束，`lp` 的结果受数值区间约束。

循环体必须是方括号 tuple body。循环每轮执行 body，并把 body raw tuple 的 items 追加到 loop raw tuple 中：

```text
3lp[i]        => raw items [1,2,3]
2lp[i, i+10]  => raw items [1,11,2,12]
```

`lp` 的顶层 `value` 必须通过 `projectToNumber(raw, 'sum')` 得到，旧 `dice()` 返回 number 的兼容合同不变。

## Budget Contract

`EvaluationBudget` 必须扩展为：

```ts
interface EvaluationBudget {
  maxRandomCalls: number
  randomCalls: number
  maxEvaluationSteps: number
  evaluationSteps: number
  maxLoopIterations: number
  loopIterations: number
  maxLoopDepth: number
  loopDepth: number
}
```

所有预算错误必须使用 `EVALUATION_BUDGET_EXCEEDED`，并通过 `meta.budgetKind` 区分：

| 预算 | `budgetKind` | 触发时机 |
| --- | --- | --- |
| 随机调用 | `randomCalls` | 每次调用 `context.random.nextInt()` 前 |
| 求值步数 | `evaluationSteps` | 每轮循环体求值前 |
| 循环次数 | `loopIterations` | 执行循环体前按归一化 `count` 预检查 |
| 循环深度 | `loopDepth` | 进入嵌套循环前 |

`lp` 必须在执行任何循环体之前完成边界归一化和预算预检查。如果边界非法或预计循环次数超限，不得执行第一轮循环体，也不得写入循环变量。

## Scope Contract

循环变量名固定为 `i`。它必须作为循环体内部只读变量暴露：

- 循环体内读取 `i` 返回 scalar `RollValue`。
- 每轮迭代必须保存外层已有的 `i`，写入当轮 `i`，执行 body 后恢复外层变量。
- 循环结束后，如果外层原本没有 `i`，读取 `i` 必须抛 `VARIABLE_NOT_FOUND`。
- 当前阶段不得支持在循环体内给 `i` 赋值；`i` 的只读保护必须落在 `EvaluationContext.variables` 存储层，而不是只由 `LoopNode` 约定。
- 如果未来引入 `$ie(...)` 或 shadowing，覆盖只读 `i` 必须先抛 `VARIABLE_READONLY`，直到 superseding ADR 明确允许新的 shadowing 行为。

循环体必须共享父级 `EvaluationContext`，不得为每轮创建新的随机源、预算对象、变量表或 diagnostics 数组。

## Error Contract

`lp` 必须使用结构化错误：

| 场景 | 错误码 | `meta` 必填字段 |
| --- | --- | --- |
| 默认模式未启用 `lp` | `PARSE_UNSUPPORTED_SYNTAX` | `operator='lp'`、`feature='loopOperator'`、`range` |
| tuple 边界参数个数不是 1、2、3 | `LOOP_INVALID_BOUNDS_ARITY` | `operator='lp'`、`actual`、`expected=[1,2,3]` |
| 边界不是整数 | `LOOP_INVALID_BOUND` | `operator='lp'`、`index`、`received` |
| 步长小于等于 0 | `LOOP_INVALID_STEP` | `operator='lp'`、`step` |
| `start > end` 或三元素序列为空 | `LOOP_INVALID_RANGE` | `operator='lp'`、`start`、`end`、`step` |
| 循环次数预算耗尽 | `EVALUATION_BUDGET_EXCEEDED` | `budgetKind='loopIterations'`、`actual`、`limit` |
| 循环深度预算耗尽 | `EVALUATION_BUDGET_EXCEEDED` | `budgetKind='loopDepth'`、`actual`、`limit` |
| 覆盖只读循环变量 `i` | `VARIABLE_READONLY` | `variable='i'`、`range` |

## Trace Contract

`roll()` 必须新增 `trace.kind='loop'`：

```ts
interface LoopTrace {
  kind: 'loop'
  range?: SourceRange
  operator: 'lp'
  expression: string
  value: number
  boundsTrace: RollTrace
  bounds: { start: number; end: number; step: number }
  itemCount: number
  iterations: Array<{
    index: number
    variable: 'i'
    value: number
    body: RollTrace
    raw: RollValue
  }>
}
```

`iterations` 必须按执行顺序排列，`index` 从 0 开始，`value` 是当轮循环变量 `i`。`body.range` 必须指向原始循环体源码范围，不得指向展开后的虚拟表达式。

## Alternatives Considered

### 三元素解释为 `[start,end,step]`

- 优点：数学直觉更对称。
- 缺点：与 ADR-007 的 `sp[leftBoundary,step,end]` 不一致，同一项目会出现两套三参数含义。
- 结论：不采用。

### 循环变量写入全局变量表

- 优点：实现简单。
- 缺点：`3lp[i];i` 会泄漏循环内部状态，破坏 program 作用域可解释性。
- 结论：不采用。

### 让 `lp` 复用 tuple literal trace

- 优点：减少 trace 类型。
- 缺点：无法解释每轮迭代、预算消耗和循环变量值。
- 结论：不采用。

## Compatibility Impact

- `dice()` 返回类型不变。
- `roll()` 增加 `LoopTrace` 变体。
- `Config` 增加可选 `maxEvaluationSteps`、`maxLoopIterations`、`maxLoopDepth`，均为向后兼容的新增字段。
- `EvaluationBudget` 增加 loop 字段，公开类型为加字段变更；调用方读取旧字段不受影响。
- `features.loopOperator` 开启时，`lp` 所需的方括号 body 只作为 loop 语法入口使用，不应让默认未启用 tuple literal 的普通 `[1,2,3]` 表达式静默变合法。

## Test Requirements

`lp` 的持续验收必须覆盖：

- 默认拒绝 `dice('3lp[i]')`，错误 `meta.feature='loopOperator'`。
- `roll('3lp[i]', { features: { loopOperator: true } })` 返回 raw items `[1,2,3]`。
- `[3]lp[i]`、`[2,5]lp[i]`、`[1,2,5]lp[i]` 的边界序列稳定。
- `3lp[1d6]` 与固定随机序列产生连续 `randomCall`。
- `3lp[i>1?1d6:0]` 保持三目短路。
- `rollProgram('3lp[i];i')` 在第二 statement 抛 `VARIABLE_NOT_FOUND`。
- `maxLoopIterations` 和 `maxLoopDepth` 分别触发对应 `budgetKind`。
- 覆盖只读变量时抛 `VARIABLE_READONLY`，并保留 `meta.variable='i'` 与赋值源码 `range`。

当前证据落点：

- `test/v1/loop-operator.test.ts` 覆盖默认拒绝、标量边界、tuple 边界、三目短路、随机调用顺序、变量不泄漏、循环次数预算和循环深度预算。
- `test/v1/evaluation-context.test.ts` 覆盖 `EvaluationContext.variables` 的只读变量保护、`VARIABLE_READONLY`、`meta.variable`、`meta.range` 和强制恢复路径。
- `test/v1/json-serialization.test.ts` 覆盖 `lp` 公开结果可 `JSON.stringify()`，并防止 loop trace 回退到 generic trace。
- `test/issues/docs-cross-links.test.ts` 必须锁定本 ADR 不得回退到实现前口径。

## Rollback Strategy

如果后续上游修订 `lp` 三元素边界：

1. 新增 ADR supersede 本 ADR，不得静默改写历史决策。
2. 保留默认 `lp` 拒绝测试。
3. 暂停 `features.loopOperator` 或在 README 标注差异。
4. 同步更新 `LoopTrace`、错误合同和测试矩阵。
