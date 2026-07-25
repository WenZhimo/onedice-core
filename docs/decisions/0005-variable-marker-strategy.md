# ADR-005: 变量标记与多语句策略

## Status

Accepted

## Date

2026-07-16

## Context

上游 #3 讨论了 `$0e(3d6)`、`$0>2`、`;` 多语句、`$t` 临时变量，以及移动端输入对 `$`、`[`、`]` 的不便。FVTT 用户又习惯 `@path.to.data`。当前仓库已经支持 `{name}` env 插值，但 `{}` 也可能与 FVTT 池语法冲突。

变量设计必须同时满足：

- 不破坏旧 `dice(input): [number, DiceNode]`。
- 不让默认 OneDice 语法同时接受多套等价标记。
- 支持浏览器 UI 对变量缺失进行结构化提示。
- 为未来 `rollProgram()`、三目惰性求值和循环变量 `i` 保留上下文空间。

## Decision

默认 OneDice 模式必须采用分层变量策略：

| 语法 | 入口 | 状态 | 说明 |
| --- | --- | --- | --- |
| `{name}` | `dice()` / `roll()` | 已支持 | 继续表示外部 env 插值，不写入内部变量 store |
| `$0`、`$1` | `rollProgram()` | 已实现 | 表示程序寄存器，只在 program feature 中启用；普通 `dice()` / `roll()` 继续拒绝 `$` |
| `$tName` | `rollProgram()` | 已实现 | 表示具名临时变量，只在 program feature 中启用，变量名大小写按源码保留 |
| `i` | `lp` 循环体 | 已实现 | 循环局部只读变量，只在循环上下文中可见，循环结束后不得泄漏 |
| `@path.to.data` | `syntax: 'fvtt-compatible'` | 已实现受控子集 | 仅 FVTT 兼容模式启用；先走同步 resolver，返回 `undefined` 时回退 `env` |

`dice()` 和 `roll()` 默认不得接受 `;` 或寄存器赋值。多语句必须通过新 API：

```ts
rollProgram('$0e(2d6);($0>7)?($0):(1d4)', config)
```

`rollProgram()` 返回结构必须包含：

```ts
interface ProgramResult {
  input: string
  value: number
  raw: RollValue
  statements: ProgramStatementTrace[]
  variables: Record<string, ProgramVariableSnapshot>
  diagnostics: RollDiagnostic[]
  budget: EvaluationBudget
}
```

`ProgramStatementTrace` 必须保留 statement `index`、原始 `expression`、源码 `range`、结构化 `result`、statement 级 `diagnostics`，赋值语句还必须保留 `assignedVariable`。`ProgramVariableSnapshot` 必须保存完整 JSON-safe `raw`、数值投影 `value`、变量 `range` 和 `assignedAtStatement`，读取变量时必须返回保存 raw 的副本或只读视图，避免 tuple selection、slice 或 clamp 污染变量快照。

变量缺失必须抛 `VARIABLE_NOT_FOUND`，并带：

- `actual`：变量名或路径。
- `range`：若 parser 已有源码区间。
- `hint`：提示先赋值或传入 env。

循环局部 `i` 必须由 `EvaluationContext.variables` 以只读绑定维护。当前阶段不得新增 `$ie(...)` 或表达式级赋值语法；未来若出现覆盖只读变量的赋值路径，必须抛 `VARIABLE_READONLY`，并带 `meta.variable='i'` 和可用的赋值源码 `range`。如果未来允许 shadowing，必须新增 superseding ADR。

`{name}` env 插值继续保留，但它不是寄存器赋值语法。env 表达式求值必须继承父级 `EvaluationContext`，确保随机预算不被重置。

## Alternatives Considered

### 默认同时支持 `$name` 和 `@name`

- 优点：移动端和 FVTT 用户都方便。
- 缺点：默认语法习惯分裂，并占用未来语法空间。
- 结论：不采用；`@` 只进入 FVTT 兼容模式。

### 用 `{name}` 同时表示 env、FVTT 池和变量

- 优点：用户输入简单。
- 缺点：`{attack}`、`{4d6,3d8}` 和 block/tuple 含义冲突。
- 结论：不采用；FVTT 池必须由 `syntax` 隔离。

### 让 `dice()` 自动支持多语句

- 优点：API 少。
- 缺点：旧 API 从纯表达式变成有状态程序，错误和 trace 语义扩大。
- 结论：不采用；多语句必须走 `rollProgram()`。

## Compatibility Impact

- 旧 `{env}` 插值继续可用。
- `{missing}` 失败必须是 `VARIABLE_NOT_FOUND`。
- 默认 `dice()` 遇到 `$0e(...)`、`;`、`@path` 必须保持拒绝或 unsupported syntax。
- `rollProgram()` 开启后，`dice()` 仍只返回单表达式 `[number, DiceNode]`。
- FVTT 的 `@path` 不得污染默认 OneDice 模式。
- FVTT resolver 返回 `RollValue` 时必须复制 raw，并按 raw 自身的 `projection` 标量化；若该 projection 为 `identity`，必须抛 `TUPLE_CANNOT_PROJECT` 且 `meta.range` 指向原始 `@path`。

## Test Requirements

变量、多语句、循环变量和 FVTT path 的持续验收必须覆盖：

- `{attack}` 缺失抛 `VARIABLE_NOT_FOUND`。
- `{attack}` 中的 `1d6` 与外层 `1d6` 共享随机预算。
- `dice('$0e(2d6);$0')` 默认拒绝。
- `rollProgram('$0e(2d6);$0')` 共享上下文并返回所有 statement trace。
- 未定义 `$0` 抛 `VARIABLE_NOT_FOUND`。
- 三目运算只求值被选分支，不消耗未选分支随机数。
- `@path.to.data` 只在 `syntax: 'fvtt-compatible'` 下解析。
- resolver 返回 `projection='identity'` 的 `RollValue` 时抛 `TUPLE_CANNOT_PROJECT`，并保留 `@path` 的源码 range。
- `rollProgram('3lp[i];i')` 在第二 statement 抛 `VARIABLE_NOT_FOUND`。
- 覆盖只读变量时抛 `VARIABLE_READONLY`，并保留 `meta.variable/range`。
- resolver 抛出的普通异常必须包裹为 `VARIABLE_RESOLVER_FAILED`。

当前证据落点：

- `test/v1/program.test.ts` 覆盖 `$0`、`$tName`、statement range、变量覆盖、缺失变量、变量 raw clone 和旧 API 默认拒绝。
- `test/v1/loop-operator.test.ts` 覆盖局部 `i` 可见性、循环结束不泄漏、循环预算和 trace。
- `test/v1/evaluation-context.test.ts` 覆盖 `VariableStore` 的只读变量覆盖错误。
- `test/v1/fvtt-compatibility.test.ts` 覆盖 `@path` resolver/env、缺失变量、非数字变量、resolver 抛错、resolver 返回 `RollValue` 复制和 `identity` 投影拒绝 range。

## Rollback Strategy

如果变量标记需要调整，应当：

1. 保留 `{env}` 插值兼容行为。
2. 通过 feature flag 暂停 program 语法。
3. 在 README 中标记旧变量标记为 deprecated，而不是静默改变含义。
4. 不得让 FVTT `@path` 成为默认 OneDice 变量标记。
