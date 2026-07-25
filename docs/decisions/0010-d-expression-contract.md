# ADR-010: 普通 `d` 表达式合同

## Status

Accepted

## Context

上游 #11 仍是开放讨论，但它指出了一个已经影响浏览器接入的问题：普通 `d` 表达式不能继续只用 `AdB(kq)C(pb)DaE` 这类压缩写法描述。浏览器 UI、测试和错误处理都需要知道每个槽位的含义、默认值、互斥关系和错误 `meta.range`。

当前实现已经支持 V1 普通多面骰、`k/q` 选取线、`p/b` COC 奖惩骰和 `a` 骰池转换；本 ADR 只形式化这些既有行为，不新增 V2/FVTT 语法。

## Decision

普通 `d` 表达式按以下合同解释：

```text
DExpression =
  [DiceCount] "d" [FaceCount] DModifier*

DModifier =
  PoolModifier
  | SelectionModifier
  | BonusPenaltyModifier

PoolModifier =
  "a" Threshold

SelectionModifier =
  ("k" | "q") Count

BonusPenaltyModifier =
  ("p" | "b") Count
```

默认值固定如下：

| 槽位 | 默认值 | 当前行为 |
| --- | --- | --- |
| `DiceCount` | `config.d.a`，默认 `1` | `d20` 等价于 `1d20` |
| `FaceCount` | `config.d.b`，默认 `100` | `2d` 等价于 `2d100`，`d` 等价于 `1d100` |
| `Selection Count` | `DiceCount` | `2d20k` 等价于 `2d20k2` |
| `Bonus/Penalty Count` | `config.d.d`，默认 `0` | `2d20p` 使用 0 个额外惩罚十位骰 |
| `Pool Threshold` | 无默认启用 | 只有出现 `aE` 时进入骰池转换 |

互斥矩阵固定如下：

| 组合 | 结果 | 错误 |
| --- | --- | --- |
| 无 modifier | 合法 | 无 |
| `k/q` | 合法 | 无 |
| `p/b` | 合法 | 无 |
| `a` | 合法，进入骰池转换 | 无 |
| `k/q` + `p/b` | 非法 | `DICE_INCOMPATIBLE_MODIFIERS` |
| `a` + `k/q` | 非法 | `DICE_POOL_MODIFIER_EXCLUSIVE` |
| `a` + `p/b` | 非法 | `DICE_POOL_MODIFIER_EXCLUSIVE` |

错误 `meta` 必须服务浏览器高亮：

| 错误码 | 必须稳定携带 |
| --- | --- |
| `DICE_INVALID_DICE_COUNT` | `operator`、`actual`、`diceCount`、`min`、`max`、`range`、`hint`，越界时还要有 `limit` |
| `DICE_INVALID_FACE_COUNT` | `operator`、`actual`、`faceCount`、`min`、`max`、`range`、`hint`，越界时还要有 `limit` |
| `DICE_INVALID_KEEP_COUNT` | `operator`、`modifier`、`actual`、`keepCount`、`diceCount`、`limit`、`range`、`hint` |
| `DICE_INCOMPATIBLE_MODIFIERS` | `operator`、`modifier`、`leftModifier`、`rightModifier`、`conflictWith`、`range`、`hint` |
| `DICE_POOL_MODIFIER_EXCLUSIVE` | `operator`、`modifier`、`poolModifier`、`conflictingModifier`、`conflictWith`、`range`、`hint` |

`range` 应当尽量指向最具体的用户输入片段：骰数越界指向左值，面数越界指向右值，`k/q` 数量越界指向 modifier，互斥错误指向后出现的冲突 modifier。无法定位更细槽位时才退回完整 `d` 表达式范围。

`roll()` 的浏览器展示合同如下：

- 普通 `d` 成功路径返回 `raw.kind='tuple'`，`raw.items` 按原始投掷顺序排列。
- 每个骰子 item 必须保留 `roll.index`、`roll.randomCall`、`roll.selected`、`roll.dropped` 和 `roll.source`。
- `trace.kind='dice'`，`trace.rolls` 按原始投掷顺序排列。
- `trace.modifiers` 记录 `selection`、`bonusPenalty` 或 `pool` modifier；文档化 `d` 合同不得产生非致命 diagnostic。

## Consequences

- `dice(input, config): [number, DiceNode]` 返回形态保持不变。
- `2d`、`d20` 和 `d` 继续是合法 V1 输入；“缺失右值错误”只适用于真正缺少表达式右操作数的输入，例如 `1d6+`。
- parser 不重写；它仍负责组合 AST，`DNode` 负责参数归一化、互斥判断和预算前检查。
- 新增或调整未来骰子语法时，必须同时更新 README、此 ADR、`test/issues/issue-011-d-notation.test.ts` 和浏览器错误展示合同。
