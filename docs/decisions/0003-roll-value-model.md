# ADR-003: `RollValue` 与标量投影规则

## Status

Accepted

## Date

2026-07-16

## Context

OneDice V2 讨论包含元组、`kh/kl/dh/dl`、`tp/sp/lp`、多语句和 FVTT 兼容等能力。旧 API `dice(input): [number, DiceNode]` 只能表达标量结果，无法让浏览器 UI 或已实现的 V2 运算读取：

- 普通 `2d20` 中每个骰子的原始结果。
- 哪些骰子被保留或丢弃。
- 元组在不同上下文中如何投影成 number。

本地实现已经引入 `roll()`，并在 `RollResult.raw` 中返回初版 `RollValue`。

## Decision

内部值模型使用：

```ts
type RollValue = ScalarValue | TupleValue
```

`ScalarValue` 表示标量数字，可携带骰子元数据。`TupleValue` 表示有序值列表，并声明默认投影方式：

- `sum`：求和投影，普通 `d` 掷骰默认使用。
- `last`：取最后一个元素，当前用于显式元组和 program 结果兼容旧 API。
- `identity`：不得被旧 `dice()` 隐式消费，调用方应当读取 `roll().raw`。

`projectToNumber(value, mode, range?)` 是唯一允许把 `RollValue` 投影为 number 的公共 helper。普通算术、旧 `dice()` 兼容路径和 resolver 返回的 `RollValue` 不得散落自定义投影逻辑；调用方已知源码位置时必须把 `range` 传入，让投影失败可以被浏览器 UI 高亮。

普通 `d` 的合同：

- `roll('2d20').raw.kind === 'tuple'`。
- `raw.items` 按原始投掷顺序排列。
- `trace.rolls` 也按原始投掷顺序排列。
- 每个骰子通过 `roll.index` 和 `roll.randomCall` 保留原始下标与随机调用序号。
- `selected/dropped` 表示选取线处理后的状态。

## Alternatives Considered

### 只在 trace 中保留骰子明细

- 优点：值模型改动更小。
- 缺点：后续 `kh/kl/dh/dl/tp/sp/lp` 仍然没有统一输入值。
- 结论：不采用。

### 直接修改 `dice()` 返回 tuple

- 优点：API 更纯粹。
- 缺点：破坏所有旧调用方。
- 结论：不采用；旧 `dice()` 必须继续返回 number。

### 用数组直接表示所有多值结果

- 优点：实现简单。
- 缺点：缺少投影来源、骰子元数据和后续 trace 语义。
- 结论：不采用；必须使用带 `kind/source/projection` 的结构。

## Compatibility Impact

- `dice()` 返回值不变。
- `roll()` 新增 `raw`，浏览器 UI 和 V2 运算应当读取它。
- `2d20 + 1` 继续按 `2d20` 的标量求和结果消费。
- `2d20` 的 `raw` 可以暴露 `[r1, r2]`，但 `value` 仍是 `r1 + r2`。
- 空元组投影必须抛 `TUPLE_EMPTY_PROJECTION`。
- `identity` 元组被旧 API 或标量消费方消费必须抛 `TUPLE_CANNOT_PROJECT`，并在可定位时携带 `meta.range`。
- FVTT resolver 返回 `RollValue` 时必须复制 raw，再按该 raw 自身的 `projection` 投影；`projection='identity'` 不得被静默改成 `sum`。

## Test Requirements

必须覆盖：

- `roll('2d20')` 暴露原始骰子 tuple。
- `roll('2d20k1')` 在 `raw.items` 中保留 selected/dropped。
- `trace.rolls` 与 `raw.items` 都按原始投掷顺序排列。
- `projectToNumber(raw)` 对普通 `2d20` 求和。
- `projectToNumber(raw)` 对 `2d20k1` 跳过 dropped 项。
- 空元组和 `identity` 投影抛稳定 `OneDiceError`，并在调用方提供源码范围时保留 `meta.range`。
- `@path` resolver 返回 `projection='identity'` 的 `RollValue` 时抛 `TUPLE_CANNOT_PROJECT`，`meta.range` 指向原始 `@path` token。
- `JSON.stringify({ raw, trace })` 不应包含循环引用或函数。

当前证据落点：

- `test/v1/roll-value.test.ts` 覆盖 `projectToNumber()` 的 `sum`、`last`、selected/dropped、空 tuple、`identity` 错误和投影错误 `meta.range`。
- `test/v1/fvtt-compatibility.test.ts` 覆盖 resolver 返回 `RollValue` 时的复制、投影和 `identity` 投影拒绝 range。
- `test/v1/tuple-literal.test.ts` 覆盖显式 tuple 的旧 API `last` 投影、`roll().raw` 和 tuple trace。
- `test/v1/tuple-operators.test.ts` 覆盖 `kh/kl/dh/dl` 对骰子 raw tuple 和显式 tuple 的消费。
- `test/v1/json-serialization.test.ts` 覆盖 tuple、slice、loop、FVTT pool、FVTT `cs` 和 `rollProgram()` 的 JSON-safe 公开结果。
- `test/issues/docs-cross-links.test.ts` 必须锁定本 ADR 不得回退到 future-only 口径。

## Rollback Strategy

如果后续 V2 需要调整 `RollValue` 字段，应当：

1. 保留 `kind`、`value/items`、`projection` 这些核心字段。
2. 新增字段而不是改变现有字段含义。
3. 用 `RollDiagnostic` 或 README 说明兼容投影变化。
4. 不得改变 `dice()` 的 `[number, DiceNode]` 返回形态。
