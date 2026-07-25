# ADR-004: V2 运算符优先级与绑定策略

## Status

Accepted

## Date

2026-07-16

## Context

上游 #3 同时讨论了 `kh/kl/dh/dl`、`min/max`、`tp/sp/lp`、比较运算、三目运算和多语句。若直接把这些 token 加入当前 grammar，会产生几个风险：

- `2d20kh1` 必须操作 `2d20` 的骰子元组，而不是先把 `2d20` 投影成和。
- `min/max` 在 OneDice 中是 clamp 语义，容易被误写成 JavaScript `Math.min/max` 直觉。
- `tp/sp/lp` 都依赖 `RollValue` 和 `EvaluationContext`，不能只靠 parser 语法糖解决。
- FVTT 兼容语法也会复用 `kh/kl/dh/dl`，默认 OneDice 模式和兼容模式必须共享核心语义但隔离入口。

当前仓库已经有 `RollValue`、`projectToNumber()`、`roll().raw` 和随机预算上下文，因此可以先确定运算符绑定规则，再进入 parser 实现。

## Decision

V2 运算符必须按以下层级实现。数值越小表示绑定越弱：

| 层级 | 运算符/结构 | 结合性 | 消费模式 | 说明 |
| --- | --- | --- | --- | --- |
| 1 | `;` | 左结合 | program | 只允许 `rollProgram()` 或显式 program feature 使用 |
| 2 | `? :` | 右结合 | scalar condition | 条件只消费标量，被选分支惰性求值 |
| 3 | `|` | 左结合 | scalar | 非零为真，返回 `1` 或 `0` |
| 4 | `&` | 左结合 | scalar | 非零为真，返回 `1` 或 `0` |
| 5 | `>`、`<`、`=` | 左结合 | scalar | 返回数值布尔 `1` 或 `0` |
| 6 | `+`、`-` | 左结合 | scalar | 沿用 V1 算术投影 |
| 7 | `*`、`x`、`/` | 左结合 | scalar | `/` 继续使用 `Math.trunc(left / right)` |
| 8 | `kh`、`kl`、`dh`、`dl`、`min`、`max` | 左结合 | tuple-preferred 或 scalar | tuple 运算符优先消费 raw tuple；clamp 可作用于 scalar 或 tuple |
| 9 | `^` | 右结合 | scalar | 沿用 V1 指数 |
| 10 | `d`、`f`、`df`、显式 tuple、括号 | 原子/后缀 | source | 产生 scalar 或 tuple raw |
| 11 | `tp`、`sp` | 后缀 | tuple-preferred / tuple-required | 只暴露或裁切已有 tuple，不得重新求值 |
| 12 | 一元 `+`、`-`、未来 `!` | 前缀/后缀待定 | scalar | `!` 和 `?` 后缀在单独 ADR 前不得实现 |
| 13 | `lp` | 中缀 | tuple-required body | 已由 ADR-008 固化边界、预算和作用域；仍必须最后消费 tuple body |

`kh/kl/dh/dl` 必须被实现为 tuple selection 节点，而不是普通二元算术节点。左值消费规则如下：

- 如果左值有 `raw.kind === 'tuple'`，直接消费该 tuple。
- 如果左值是 scalar，则包装为单元素 tuple。
- 选择数量缺省为 `1`。
- `kh/kl` 标记 selected 项，`dh/dl` 标记 dropped 项。
- 顶层 `value` 为 selected 项标量投影之和。

`min/max` 必须按 OneDice 标准语义实现：

- `AminB` 表示把 A 中低于 B 的值提升到 B。
- `AmaxB` 表示把 A 中高于 B 的值降低到 B。
- 对 tuple 应当逐项 clamp，并保留 tuple 结构。

`tp` 必须暴露已有 tuple；若左值没有 tuple，可包装为单元素 tuple。`sp` 已由 ADR-007 固化为用户可见的 1 基索引、闭区间和步进区间；后续只能按 ADR-007 补漏或新增 superseding ADR。

## Alternatives Considered

### 把 `kh/kl/dh/dl` 放在 `d` 内部作为普通 modifier

- 优点：实现路径接近当前 `k/q`。
- 缺点：无法支持 `[2,7,4]kh1`、FVTT 池和非骰子 tuple。
- 结论：不采用；V2 tuple 运算符必须脱离 `DNode` modifier。

### 让所有新运算符都先投影成 scalar

- 优点：实现简单。
- 缺点：会破坏 `2d20kh1` 的核心语义。
- 结论：不采用。

### 先实现 parser，再补语义测试

- 优点：短期可以更快看到语法跑通。
- 缺点：容易把错误优先级固化进生成表，后续难以回滚。
- 结论：不采用；必须先写 parse/eval/trace 测试。

## Compatibility Impact

- `dice()` 默认不得接受 `;`、FVTT 池、未显式启用的 `lp/sp/tp/kh/kl/dh/dl/min/max` 语法。
- `2d20 + 1` 必须继续使用 `2d20` 的 sum 投影。
- `2d20kh1` 启用后必须读取 `2d20` 的 raw tuple。
- V1 `2d20k1` 语义不得因 `kh` 实现改变。
- 默认 OneDice 模式和 FVTT 兼容模式可以共享 `kh/kl/dh/dl` AST，但入口必须由 `syntax` 或 feature flag 隔离。

## Test Requirements

V2 运算符优先级与消费模式的持续验收必须覆盖：

- parse：`2d20kh1`、`[2,7,4]dl1`、`5min6`、`7max6`、`3d100tp`、`[1,2,3]sp[2]`、`3lp[i]` 在正确 feature flag 下生成专属 AST。
- eval：`2d20kh1` 使用骰子 raw tuple，而 `2d20 + 1` 使用 sum 投影；`tp` / `sp` / `lp` 不得重新求值已经求出的左侧 raw。
- trace：selection 的 selected/dropped、clamp 的 before/limit/after、projection/slice/loop 的专属 trace 必须与 `raw.items` 对齐。
- errors：越界数量、slice 参数错误、loop 边界错误和未启用 feature 必须使用稳定 `OneDiceError.code/meta`。
- flags：未开启对应 feature 时，保留 token 必须抛 `PARSE_UNSUPPORTED_SYNTAX` 并填充 `meta.feature`；不得退回普通 parser message。

当前证据落点：

- `test/v1/tuple-operators.test.ts` 覆盖 `kh/kl/dh/dl`、默认数量、稳定排序、骰子隐式 tuple 和越界错误。
- `test/v1/clamp-operators.test.ts` 覆盖 `min/max` 的 OneDice clamp 语义和 tuple 逐项处理。
- `test/v1/tuple-projection.test.ts` 覆盖 `tp` 不二次求值、普通骰子 tuple、显式 tuple 和旧 API 投影。
- `test/v1/tuple-slice.test.ts` 覆盖 `sp` 的 ADR-007 索引规则和结构化 slice 错误。
- `test/v1/conditionals.test.ts` 覆盖比较、布尔和三目优先级以及短路求值。
- `test/v1/loop-operator.test.ts` 覆盖 `lp` 的 ADR-008 边界、预算、变量作用域和 trace。
- `test/v1/parser-errors.test.ts` 覆盖默认拒绝矩阵，防止 V2 token 泄漏到默认 OneDice 模式。
- `test/issues/docs-cross-links.test.ts` 必须锁定本 ADR 不得回退到实现前口径。

## Rollback Strategy

如果后续发现优先级不符合上游标准，应当：

1. 新增 ADR supersede 本 ADR，说明冲突表达式。
2. 保留旧 `dice()` V1 行为。
3. 通过 feature flag 暂停有争议的 V2 operator。
4. 保留错误码和测试向量，更新 parser 生成文件和 README。