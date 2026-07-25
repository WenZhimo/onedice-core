# ADR-007: `sp` 元组裁切索引规则

## Status

Accepted

## Date

2026-07-16

## Context

上游 #3 的 `sp` 评论给出了三条关键示例：

```text
[1,2,3,4,5,6]sp[2] = [2] = 2
[1,2,3,4,5,6]sp[2,5] = [2,3,4,5]
[1,2,3,4,5,6]sp[1,2,5] = [2,4]
```

同一评论还写明“类似 Python 的 list，但左界 +1”。这说明 `sp` 不是普通数学运算，而是面向用户可见序号的元组裁切操作。若不先固定索引规则，后续实现会在以下方面产生不可回滚的兼容风险：

- 单索引返回值到底是 scalar 还是单元素 tuple。
- 双参数区间是否包含右边界。
- 三参数中的第二个参数是 `end` 还是 `step`。
- `0`、负索引、越界、反向区间和空结果如何失败。
- 旧 `dice()` 必须返回 number，但新 `roll()` 应当保留 raw tuple。

## Decision

`sp` 必须作为 `features.tupleSlice` 下的后缀运算符实现。默认模式必须继续抛 `PARSE_UNSUPPORTED_SYNTAX`，并带 `meta.feature='tupleSlice'`。

`sp` 的右值必须是显式元组字面量，且 item 必须可投影为整数。右值含义按参数个数区分：

| 形式 | 名称 | 用户可见含义 | 结果 |
| --- | --- | --- | --- |
| `sp[index]` | 单索引 | 取第 `index` 个元素，索引从 1 开始 | 单元素 tuple |
| `sp[start,end]` | 闭区间 | 取第 `start` 到第 `end` 个元素，左右边界都包含，索引从 1 开始 | tuple |
| `sp[leftBoundary,step,end]` | 步进区间 | 取大于 `leftBoundary` 且小于等于 `end` 的元素，每次前进 `step` | tuple |

三参数形式必须采用 `leftBoundary, step, end`，而不是 `start, end, step`。原因是上游示例 `[1,2,5] => [2,4]` 只能由“左边界后一个元素开始、步长 2、右边界 5”稳定推出。该规则虽然与双参数形式不完全对称，但能够完整保留上游已经给出的三个示例。

内部转换必须遵守：

```ts
// items 是 0 基数组，用户可见索引为 1 基。
sp[index] => [items[index - 1]]

sp[start,end] => items.slice(start - 1, end)

sp[leftBoundary,step,end] => {
  const result = []
  for (let visibleIndex = leftBoundary + 1; visibleIndex <= end; visibleIndex += step) {
    result.push(items[visibleIndex - 1])
  }
  return result
}
```

`roll()` 的 raw 合同：

- `roll('[1,2,3]sp[2]', { features: { tupleLiterals: true, tupleSlice: true } }).raw.kind` 必须是 `'tuple'`。
- 单索引结果必须保留为单元素 tuple，`projection='sum'`，旧 `dice()` 再把它投影为 number。
- `raw.source` 必须是 `'slice'`。
- `raw.operator` 必须是 `'sp'`。
- `trace.kind` 必须是 `'tuple-slice'`。
- trace 必须暴露 `sourceIndexes`、`resultIndexes`、`start`、`end`、`step`、`arity`。

## Error Contract

`sp` 必须使用结构化错误，不得抛普通 `Error`：

| 场景 | 错误码 | `meta` 必填字段 |
| --- | --- | --- |
| 左侧不可转为 tuple | `TUPLE_REQUIRED` | `operator='sp'`、`range` |
| 右侧不是显式 tuple 参数 | `TUPLE_INVALID_SLICE_ARITY` | `operator='sp'`、`actual`、`expected` |
| 参数个数不是 1、2、3 | `TUPLE_INVALID_SLICE_ARITY` | `operator='sp'`、`actual`、`expected=[1,2,3]` |
| 参数不是整数 | `TUPLE_INVALID_SLICE_INDEX` | `operator='sp'`、`index`、`received` |
| `index/start/end/leftBoundary` 小于 1 | `TUPLE_INVALID_SLICE_INDEX` | `operator='sp'`、`index`、`received` |
| `step` 小于等于 0 | `TUPLE_INVALID_SLICE_STEP` | `operator='sp'`、`step` |
| 索引越界 | `TUPLE_SLICE_OUT_OF_RANGE` | `operator='sp'`、`index`、`limit` |
| 双参数 `start > end` | `TUPLE_INVALID_SLICE_RANGE` | `operator='sp'`、`start`、`end` |
| 三参数没有选出任何元素 | `TUPLE_EMPTY_PROJECTION` | `operator='sp'`、`start`、`end`、`step` |

不得支持负索引。不得把越界裁切静默降级为空 tuple。原因是浏览器 UI 需要指出用户输入的具体错误位置，而静默空结果会让错误表达式看似成功。

## Test Requirements

`sp` 的持续验收必须覆盖：

| 表达式 | 期望 `value` | 期望 raw items | 说明 |
| --- | --- | --- | --- |
| `[1,2,3,4,5,6]sp[2]` | `2` | `[2]` | 单索引，旧 API 仍能投影为 number |
| `[1,2,3,4,5,6]sp[2,5]` | `14` | `[2,3,4,5]` | 双参数闭区间 |
| `[1,2,3,4,5,6]sp[1,2,5]` | `6` | `[2,4]` | 上游步进示例 |
| `2d6sp[1,2]` | 两颗骰子之和 | 两颗骰子原始值 | 必须消费普通 `d` 的 raw tuple |
| `[1,2,3]sp[0]` | error | n/a | `TUPLE_INVALID_SLICE_INDEX` |
| `[1,2,3]sp[-1]` | error | n/a | `TUPLE_INVALID_SLICE_INDEX` 或 parser 层明确拒绝负参数 |
| `[1,2,3]sp[4]` | error | n/a | `TUPLE_SLICE_OUT_OF_RANGE` |
| `[1,2,3]sp[3,2]` | error | n/a | `TUPLE_INVALID_SLICE_RANGE` |
| `[1,2,3]sp[1,0,3]` | error | n/a | `TUPLE_INVALID_SLICE_STEP` |

还必须覆盖 feature flag：

- 未开启 `features.tupleSlice` 时，`[1,2,3]sp[2]` 必须抛 `PARSE_UNSUPPORTED_SYNTAX`。
- 开启 `features.tupleSlice` 但未开启 `features.tupleLiterals` 时，显式 tuple 输入仍必须按 tuple literal 规则失败。

当前证据落点：

- `test/v1/tuple-slice.test.ts` 覆盖默认拒绝、缺少 tuple literal flag、单索引、双参数闭区间、三参数步进区间、普通 `d` 骰子 raw tuple、标量左值拒绝和所有结构化 slice 错误码。
- `test/v1/json-serialization.test.ts` 覆盖 `sp` 公开结果可 `JSON.stringify()`，并防止 `trace.kind='tuple-slice'` 回退到 generic trace。
- `README.md` 已在 feature flag 表、错误码表和 ADR 链接中记录 `tupleSlice`、`TUPLE_*` slice 错误码和 ADR-007。
- `test/issues/docs-cross-links.test.ts` 必须锁定本 ADR 不得回退到实现前口径。

## Alternatives Considered

### 采用完全 1 基闭区间，并把三参数解释为 `[start,end,step]`

- 优点：更对称，用户更容易理解。
- 缺点：无法解释上游示例 `[1,2,5] => [2,4]`。
- 结论：不采用。

### 采用 Python 原生 0 基半开区间

- 优点：实现最接近 JavaScript `slice()` 和 Python `list[start:end:step]`。
- 缺点：与上游 `sp[2] => [2]` 和 `sp[2,5] => [2,3,4,5]` 不一致。
- 结论：不采用。

### 越界返回空 tuple

- 优点：实现简单，接近 JavaScript `slice()` 容错。
- 缺点：浏览器 UI 无法区分“用户真的想要空结果”和“索引写错”。
- 结论：不采用。

## Compatibility Impact

- `dice()` 返回类型不变，仍为 `[number, DiceNode]`。
- `roll()` 会新增 `trace.kind='tuple-slice'` 变体。
- `RollValue.TupleValue.source` 已包含 `'slice'`，可直接用于 `sp` raw。
- 需要新增 `OneDiceErrorCode`：`TUPLE_REQUIRED`、`TUPLE_INVALID_SLICE_INDEX`、`TUPLE_INVALID_SLICE_STEP`、`TUPLE_INVALID_SLICE_ARITY`、`TUPLE_SLICE_OUT_OF_RANGE`、`TUPLE_INVALID_SLICE_RANGE`。
- `sp` 不得改变 `tp`、`kh/kl/dh/dl`、`min/max` 的已实现行为。

## Rollback Strategy

如果后续上游明确修订 `sp` 三参数语义，应当：

1. 新增 ADR supersede 本 ADR，而不是静默修改本 ADR。
2. 保留旧实现 behind feature flag，并在 README 标记兼容差异。
3. 增加迁移诊断，提示用户三参数顺序变化。
4. 保留默认模式拒绝 `sp` 的行为，直到新语义测试和 README 示例全部同步。
