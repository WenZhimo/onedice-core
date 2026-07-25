# ADR-002: 错误码与诊断模型

## Status

Accepted

## Date

2026-07-16

## Context

浏览器 UI 不能依赖中文或英文错误字符串来判断错误类型。错误文本会随提示语调整而变化，但 UI 需要稳定分支逻辑，例如：

- 高亮 parser 出错位置。
- 区分非法骰子面数、互斥 modifier、预算耗尽。
- 对未来 V2/FVTT 语法给出“已识别但未启用”的提示。

本地实现已经引入 `OneDiceError`，并把 `DICE_*`、`PARSE_*`、`TUPLE_*`、`VARIABLE_*` 与 `EVALUATION_*` 错误收敛为稳定 code。`RollResult.diagnostics` 也已经进入公开结果，用于承载非致命兼容提示。

## Decision

所有用户可触达的解析和求值失败都应当抛 `OneDiceError`：

```ts
class OneDiceError extends Error {
  code: OneDiceErrorCode
  meta: OneDiceErrorMeta
}
```

错误码必须稳定。测试必须断言 `error.code` 和关键 `error.meta` 字段，不得断言完整 `message`。

当前已接受的错误族：

- `PARSE_*`：lexer/parser 层错误。
- `DICE_*`：当前 V1 骰子语义错误。
- `EVALUATION_*`：预算、上下文和未来求值过程错误。
- `TUPLE_*`：`RollValue` 投影错误。
- `VARIABLE_*`：program 变量、`{env}` 插值和 FVTT `@path` resolver 错误。

`meta` 应当优先包含：

- `input`
- `range`
- `operator`
- `expected`
- `actual`
- `limit`
- `received`
- `hint`

非致命兼容提示不得抛错，当前必须进入 `RollResult.diagnostics`。已公开的第一阶段诊断码是 `SYNTAX_NORMALIZED`，用于 `df` 归一化为 `f` 以及 FVTT dice pool 归一化为内部 tuple。该诊断必须至少包含 `code`、`severity`、`message`、`range`、`feature`、`original` 和 `normalized`。

新增 diagnostic code 前必须同时补齐四件事：

1. 在 `src/trace.ts` 中定义稳定字段。
2. 在 README 中说明浏览器 UI 如何展示。
3. 在本 ADR 或后续 ADR 中说明 fatal error 与 non-fatal diagnostic 的边界。
4. 在测试中断言 code、severity 和关键字段，不得只断言 `message`。

`FEATURE_FLAG_REQUIRED`、`COMPATIBILITY_PROJECTION`、`BUDGET_NEAR_LIMIT` 这类 warning/info 只能在上述合同完成后公开。当前未实现时，浏览器 UI 必须依赖 `OneDiceError.code/meta` 和已实现的 `SYNTAX_NORMALIZED`，不得假设这些未来 code 会出现。

## Alternatives Considered

### 继续抛普通 `Error`

- 优点：改动小。
- 缺点：浏览器 UI 只能解析 message，无法稳定高亮或国际化。
- 结论：不采用。

### 为每类错误创建独立 Error 子类

- 优点：TypeScript 类型分支更细。
- 缺点：类层级膨胀，跨 bundle/iframe 的 `instanceof` 更脆弱。
- 结论：不作为第一阶段方案；统一 `OneDiceError.code` 更稳定。

### 用返回值表达错误

- 优点：无异常控制流。
- 缺点：会破坏旧 `dice()` API，并迫使调用方处理大量 `Result` 包装。
- 结论：不采用；异常继续表示 fatal error。

## Compatibility Impact

- `dice()` 仍然在失败时抛异常，但异常类型逐步从普通 `Error` 收敛为 `OneDiceError`。
- 旧代码如果只展示 `error.message` 仍可工作。
- 新浏览器 UI 应当改用 `error.code` 和 `error.meta`。
- parser 现在对 `>`、`<`、`?`、`:`、`@`、`;` 等已知未来语法抛 `PARSE_UNSUPPORTED_SYNTAX`。

## Test Requirements

必须覆盖：

- `PARSE_UNEXPECTED_END`：如 `dice('1+')`，断言 `meta.range` 和 `meta.expected`。
- `PARSE_UNEXPECTED_TOKEN`：如 `dice('1)')`，断言 token 位置。
- `PARSE_UNSUPPORTED_SYNTAX`：如 `dice('1>2')`，断言 `operator`。
- `DICE_INCOMPATIBLE_MODIFIERS`：如 `2d20k1b1`。
- `DICE_POOL_MODIFIER_EXCLUSIVE`：如 `2d6a5k1`。
- `EVALUATION_BUDGET_EXCEEDED`：预算共享路径必须覆盖。
- `TUPLE_EMPTY_PROJECTION` 和 `TUPLE_CANNOT_PROJECT`：值模型投影必须覆盖。

## Evidence

- `src/errors.ts` 定义公开 `OneDiceErrorCode` 和 `OneDiceErrorMeta`。
- `src/trace.ts` 定义 `RollResult.diagnostics` 与 `RollDiagnostic`。
- `test/v1/runtime-errors.test.ts` 覆盖 V1 dice、parser 防御分支和关键运行时错误。
- `test/v1/parser-errors.test.ts` 覆盖 `PARSE_UNSUPPORTED_SYNTAX`、`meta.feature` 和未来语法默认拒绝。
- `test/v1/fate-alias.test.ts` 与 `test/v1/fvtt-compatibility.test.ts` 覆盖 `SYNTAX_NORMALIZED`。
- `test/v1/fvtt-compatibility.test.ts` 覆盖 `VARIABLE_RESOLVER_FAILED`、`VARIABLE_NOT_FOUND` 和 `VARIABLE_INVALID_VALUE`。
- `test/issues/readme-error-codes.test.ts` 锁定 README 必须覆盖公开错误码。
- `test/issues/no-plain-runtime-errors.test.ts` 防止源码运行时重新引入普通 `throw new Error`。
- `test/issues/docs-cross-links.test.ts` 锁定本 ADR 不得回退到 diagnostics 未来态或 README 旧口径。

## Rollback Strategy

如果某个错误码设计不合适，应当：

1. 新增更精确的错误码。
2. 在一个小版本内保留旧 code 或提供迁移说明。
3. 更新 README 和测试。
4. 不得把已经结构化的错误退回普通 `Error`。
