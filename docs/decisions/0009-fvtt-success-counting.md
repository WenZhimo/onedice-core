# ADR-009: FVTT success-counting 子集

## Status

Accepted

## Date

2026-07-22

## Context

FVTT / Foundry 用户常用 `cs` 表达成功计数。Foundry 文档支持 `cs>{y}`、`cs>={y}`、`cs<{y}`、`cs<={y}`、`cs={y}` 和 `cs20` 等写法，同时还存在 failure counting、margin success、even/odd、爆骰、重骰等更大的 dice modifier 族。

本仓库的目标是浏览器可嵌入的 OneDice 核心。`ADR-006` 已经要求 FVTT 兼容必须通过显式 `syntax: 'fvtt-compatible'` 隔离，并且不得把 Foundry runtime 语义整体搬进默认 OneDice 语法。当前 `RollValue`、普通 `d` 的骰子 tuple、tuple literal 和 trace 模型已经稳定，足以承载带目标值的 success counting 子集。

## Decision

实现 FVTT `cs` 的受控子集，并继续保持默认拒绝：

```ts
roll('4d6cs>4', {
  syntax: 'fvtt-compatible',
  features: { fvttSuccessCounting: true },
})
```

接受的形式只包含：

- `csN`
- `cs>N`
- `cs>=N`
- `cs<N`
- `cs<=N`
- `cs=N`

该能力必须通过 `features.fvttSuccessCounting` 显式启用，并且只有在 `syntax: 'fvtt-compatible'` 下生效。默认 `syntax: 'onedice'` 即使收到该 feature flag，也必须继续抛 `PARSE_UNSUPPORTED_SYNTAX`。

实现必须使用 FVTT 兼容 adapter 在主 parser 前识别顶层 `cs`，手动组装 `SuccessCountNode`。不得把 `cs` 产生式加入 `utils/grammar.yaml`，不得扩张 `src/parser/grammar.json` 或 `src/parser/table.json`，以免破坏已经稳定的 V2 优先级和 parser 表规模。

## Alternatives Considered

### 直接把 `cs` 加入主 grammar

- 优点：语法表可以统一处理 operator precedence。
- 缺点：会扩大核心 grammar，增加冲突风险；此前生成表路径已经表现出膨胀风险。
- 结论：不采用。`cs` 是 FVTT 兼容语法，应当留在兼容 adapter 层。

### 兼容 Foundry 完整 success/failure 族

- 优点：FVTT 迁移体验更完整。
- 缺点：范围包含 failure counting、margin、even/odd、爆骰/重骰组合和无目标默认语义，会显著扩大错误合同和 trace 合同。
- 结论：不采用。当前只实现带目标值的 success counting。

### 默认 OneDice 模式也接受 `cs`

- 优点：调用方无需设置 `syntax`。
- 缺点：污染默认 OneDice 语法，且与未来 OneDice V2 token 空间冲突。
- 结论：不采用。

## Compatibility Impact

- `dice()` 和 `roll()` 的默认模式不接受 `1d20cs>15`。
- `syntax: 'fvtt-compatible'` 但未启用 `features.fvttSuccessCounting` 时仍不接受 `cs`。
- 启用后，`roll().raw` 返回 `{ kind: 'scalar', source: 'operator' }`，`dice()` 返回成功数量。
- `trace.kind` 为 `success-count`，并暴露 `comparator`、`target`、`successIndexes`、`failureIndexes` 和每个 item 的计数状态。
- `1d20cs` 无目标形式继续拒绝；不得提前采用 Foundry 的无目标默认成功语义。

## Test Requirements

- 默认模式拒绝 `1d20cs>15`，即使传入 `features.fvttSuccessCounting`。
- 兼容模式未启用 flag 时拒绝 `1d20cs>15`。
- `4d6cs>4` 在固定随机序列 `[5,4,6,1]` 下返回 `2`。
- `3d6cs>=5`、`3d6cs=1` 和 `3d6cs1` 必须覆盖 inclusive 与 exact comparator。
- `1d20cs` 必须抛目标缺失错误，range 指向输入末尾。
- 显式 tuple 如 `[1,6,2]cs>3` 必须复用同一 success-counting 路径，不得重新求值左侧。
- 浏览器 smoke 必须覆盖 ESM bundle 中的 `fvttSuccessCounting` 调用。

## Evidence

- `src/parser/fvtt-success-count.ts` 在 FVTT adapter 层识别顶层 `cs`，不得修改主 grammar。
- `src/ast/success-count.ts` 定义 `SuccessCountNode` 和 comparator 语义。
- `src/trace.ts` 输出 `trace.kind='success-count'`、`successIndexes` 和 `failureIndexes`。
- `test/v1/fvtt-compatibility.test.ts` 覆盖默认拒绝、兼容未开 flag 拒绝、`4d6cs>4`、inclusive/exact comparator、缺少目标和显式 tuple 消费。
- `test/v1/json-serialization.test.ts` 覆盖 FVTT success-counting 的 JSON-safe 公开结果。
- `test/browser/vite-import.test.ts` 覆盖 ESM bundle 中的 `fvttSuccessCounting` 浏览器 smoke。
- `test/issues/docs-cross-links.test.ts` 锁定本 ADR 不得回退到完整 Foundry success/failure 族或默认 OneDice 接受 `cs`。

## Rollback Strategy

如果 `cs` 与未来 OneDice 或 FVTT 兼容范围冲突，应当：

1. 保留默认 OneDice 拒绝路径不变。
2. 通过关闭 `features.fvttSuccessCounting` 回到结构化拒绝。
3. 保留 `SuccessCountNode` 和 trace 类型，直到迁移路径明确。
4. 新增 superseding ADR 明确是否调整 comparator、无目标语义或 adapter 边界。
