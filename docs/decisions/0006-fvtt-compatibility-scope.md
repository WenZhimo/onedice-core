# ADR-006: FVTT 兼容模式范围

## Status

Accepted

## Date

2026-07-16

## Context

上游 #3 讨论了 FVTT 风格语法和移动端输入习惯。FVTT 用户常见表达式包括 `{4d6,3d8}kh`、`@abilities.str.mod`、`kh/kl/dh/dl`、`min/max` 等。但 Foundry / FVTT 生态还包含爆骰、重骰、成功计数、actor/item 数据绑定和 roll mode 等大量特性。

本仓库目标是浏览器可嵌入的 OneDice 核心，不应当在默认语法中直接吸收所有 FVTT 习惯。兼容模式必须服务迁移和集成，同时保护 OneDice 默认语法稳定。

## Decision

FVTT 兼容必须通过显式模式启用：

```ts
roll('{4d6,3d8}kh', {
  syntax: 'fvtt-compatible',
  env: {
    'abilities.str.mod': 3,
  },
})
```

第一阶段兼容范围只包含下列已实现或受控实现的子集。`syntax: 'fvtt-compatible'`
只负责启用 FVTT 表面语法适配层；`kh/kl/dh/dl`、`min/max`、`df` 和 `cs`
仍必须继续受各自 `features` 控制，兼容模式不得等同于“打开所有未来语法”。

| 能力 | 状态 | 内部归一化与控制 |
| --- | --- | --- |
| `{a,b,c}` 骰池/tuple 输入 | 已实现受控子集 | 明确的骰池 `{4d6,3d8}` 归一化为内部 tuple literal，并产生 `SYNTAX_NORMALIZED`；非骰逗号池继续按 `{env}` 或结构化拒绝处理 |
| `@path.to.data` | 已实现 | 先调用同步 resolver，返回 `undefined` 时从 `env` 读取路径值；缺失抛 `VARIABLE_NOT_FOUND`，非数字抛 `VARIABLE_INVALID_VALUE`，resolver 普通异常包裹为 `VARIABLE_RESOLVER_FAILED` |
| `kh/kl/dh/dl` | 已实现，仍需 `features.tupleOperators` | FVTT dice pool 归一化后复用 ADR-004 `TupleSelectionNode`；兼容模式不得绕过 tuple operator feature flag |
| `min/max` | 已实现，仍需 `features.clampOperators` | 复用 OneDice clamp 语义；兼容模式不得重新定义为 JavaScript `Math.min/max` 直觉 |
| `df` | 已实现，仍需 `features.fateAlias` | 归一化为 `f` 并产生 `SYNTAX_NORMALIZED` 诊断；骰后 `df` 计数族仍按 FVTT deduct-failures 拒绝 |
| 带目标值 `cs` | 已实现受控子集，仍需 `features.fvttSuccessCounting` | 由 ADR-009 固化，只接受 `csN`、`cs>N`、`cs>=N`、`cs<N`、`cs<=N`、`cs=N` |

除 `ADR-009` 明确接受的带目标值 `cs` 子集外，第一阶段仍不得实现：

- 爆骰。
- 递归重骰。
- 失败计数、无目标成功计数和复杂 success/failure 组合。
- Foundry actor/item 数据模型绑定。
- Foundry roll mode。
- 复杂数学函数和宏系统。
- 任何需要访问浏览器全局状态、localStorage、文件系统或网络的能力。

未实现但可识别的 FVTT 语法必须抛 `PARSE_UNSUPPORTED_SYNTAX`，并提供
`meta.operator`、`meta.feature`、`meta.range` 与 `meta.hint`。不得静默降级为近似
OneDice 行为，也不得访问 `window.game`、actor/item、UUID resolver、localStorage、
文件系统或网络。

## Alternatives Considered

### 把 FVTT 语法并入默认 OneDice 模式

- 优点：用户无需配置。
- 缺点：默认语法会与 OneDice 原生 `{env}`、未来 tuple 和变量策略冲突。
- 结论：不采用。

### 完整复刻 Foundry Roll 语义

- 优点：FVTT 用户迁移成本最低。
- 缺点：范围过大，会把本库变成 Foundry runtime 的不完整替代品。
- 结论：不采用；只实现与上游 #3 交集明确的表达式核心。

### 在外部适配器中实现全部 FVTT 兼容

- 优点：核心更干净。
- 缺点：`kh/kl/dh/dl`、tuple、`@path` 与核心值模型高度相关，完全外置会重复 parser 和 trace。
- 结论：不作为第一阶段方案；核心提供受控兼容模式。

## Compatibility Impact

- 默认 `syntax: 'onedice'` 不接受 FVTT 专属 `{4d6,3d8}kh` 或 `@path`。
- `syntax: 'fvtt-compatible'` 可以接受受支持子集，并通过 diagnostics 说明归一化。
- FVTT 兼容模式必须继续使用 `OneDiceError` 和 `RollDiagnostic`，不得引入另一套错误系统。
- 兼容模式不得改变 V1 `dice()`、`roll('2d20k1')`、`roll('{name}')` 的默认行为。
- `env` 路径读取必须只读取调用方传入对象，不得访问宿主应用全局状态。

## Test Requirements

FVTT 兼容的持续验收必须覆盖：

- 默认模式拒绝 `{4d6,3d8}kh`。
- 兼容模式接受 `{4d6,3d8}kh`，并生成 tuple selection trace。
- 兼容模式仅在 `features.fvttSuccessCounting` 下接受带目标值的 `cs` 成功计数；默认模式和未启用 flag 时必须拒绝。
- 默认模式拒绝 `@abilities.str.mod`。
- 兼容模式读取 `env['abilities.str.mod']` 或明确文档化的 path 解析规则。
- 缺失 `@path.to.data` 抛 `VARIABLE_NOT_FOUND`。
- 未实现的 FVTT 爆骰或重骰抛 `PARSE_UNSUPPORTED_SYNTAX`。
- 兼容归一化必须产生 `SYNTAX_NORMALIZED` 诊断。
- 非骰逗号池 `{attack,bonus}kh` 必须在兼容模式下抛 `meta.feature='fvttNonDicePool'`，不得误提示未开启 FVTT 兼容。
- Foundry roll mode、actor/item/UUID/Compendium 深绑定必须抛 `meta.feature='fvttRuntimeBinding'`，兼容模式下不得调用 resolver。

当前证据落点：

- `test/v1/fvtt-compatibility.test.ts` 覆盖 `@path` resolver/env、FVTT dice pool 归一化、非骰 pool 拒绝、爆骰/重骰/失败计数/Foundry runtime binding 结构化拒绝，以及带目标值 `cs` 子集。
- `test/v1/clamp-operators.test.ts` 覆盖 `min/max` 的 OneDice clamp 语义和 tuple 逐项处理。
- `test/v1/fate-alias.test.ts` 覆盖 `df` 默认拒绝、显式启用、归一化 diagnostic 和近邻反例。
- `test/browser/vite-import.test.ts` 覆盖浏览器 bundle 中的 FVTT pool、`@path` resolver、`df` alias、`cs` 成功计数和 Foundry runtime binding 拒绝路径。

## Rollback Strategy

如果 FVTT 兼容模式产生语义冲突，应当：

1. 保留默认 OneDice 模式不变。
2. 通过 `features` 暂停有争议的 FVTT 子能力。
3. 在 diagnostics 中提示调用方当前能力已禁用或需要升级。
4. 新增 ADR supersede 本 ADR，明确新的兼容范围。
5. 不得用默认语法兼容作为回滚手段。
