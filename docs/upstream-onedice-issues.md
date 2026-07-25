# 上游 OneDice Issue 记录

最后同步：2026-07-24

来源仓库：https://github.com/OlivOS-Team/onedice

对应执行方案：[improvement-plan.md](./improvement-plan.md)

本文件记录上游 OneDice 标准仓库中会影响浏览器版 `@onedice/core`
fork 的议题。上游仓库主要承载标准与文档讨论，因此本仓库不得把开放讨论直接转成默认 parser 行为；每个开放议题都应当先落成 ADR、feature flag、默认拒绝测试、成功测试、错误合同和浏览器验收。

2026-07-24 复核结果：#11 与 #3 仍为开放议题，#10、#9、#5 仍为已关闭议题；本仓库执行口径不变，开放议题继续作为设计输入，关闭议题继续作为必须固化的行为规则。

## 优先级映射

| 优先级 | Issue | 主题 | 本仓库应当执行 |
| --- | --- | --- | --- |
| P0 | #11 | 普通 `d` 表达式形式化 | README、grammar 注释、测试命名和结构化错误必须解释 `d` 的槽位、互斥和缺省语义。 |
| P0 | #3 | OneDice V2 草案 | V2 必须拆成 ADR 支撑的独立能力族，不得作为一次性默认语法大改。 |
| P1 | #10 | COC 奖惩骰判断方法 | `p`/`b` 必须符合上游已接受规则，并以确定性随机测试锁定。 |
| P1 | #9 | `d` 左右值上限增加到 `10000` | parser/runtime 必须允许骰数和面数到 `10000`，并用运行预算保护浏览器。 |
| P2 | #5 | Rust `diro` 生态实现 | 只能作为跨实现行为参照，不得成为浏览器核心包的运行时依赖。 |

## 开放 Issue

### #11：普通 `d` 表达式形式化

URL：https://github.com/OlivOS-Team/onedice/issues/11

状态：open

上游问题：

- 旧文档使用 `AdB(kq)C(pb)DaE` 描述普通多面骰，读者必须反复查参数表才能理解每个位置的含义。
- 上游提出把普通 `d` 表达式拆成槽位：

```text
[骰数]d[面数][[骰池参数]|[选取线参数][奖惩数参数]]

骰池参数：a[点数阈值]
选取线参数：(k|q)[选取个数]
奖惩数参数：(p|b)[奖惩个数]
```

本仓库应当执行：

- **文档合同**：README 必须使用“槽位 + 互斥矩阵 + 缺省值 + 成功示例 + 失败示例”的结构说明 `d`，不得只保留压缩口诀。
- **parser 合同**：`DNode` 必须区分骰数缺失、面数缺失、非法面数、非法骰数、保留数量越界、骰池 modifier 与其他 modifier 混用等失败路径。
- **错误合同**：用户可触达错误必须是 `OneDiceError`；`meta` 至少应当包含 `operator`、`modifier`、`range`、`actual`、`limit` 或 `hint` 中的关键字段。
- **测试合同**：测试文件应当按语义命名，而不是只按表达式命名；最小覆盖必须包含 dice count、face count、pool threshold、keep/drop selection、bonus/penalty count。
- **浏览器合同**：错误 `range` 必须能映射到 textarea selection；UI 应当能高亮冲突 modifier，而不是只能高亮整条表达式。
- **兼容合同**：既有合法 V1 表达式必须保持行为稳定；新增文档或错误码不得改变 `dice(input, config): [number, DiceNode]` 的返回形态。

### #3：OneDice V2 草案

URL：https://github.com/OlivOS-Team/onedice/issues/3

状态：open

上游问题：

- #3 是 V2 总讨论，内容包含变量、多语句、比较/布尔、三目、阶乘/阶加、`df`、元组、tuple operator、clamp、loop、slice/projection、FVTT 兼容和移动端输入等多个独立能力。
- 这些能力之间存在优先级、符号占用、移动端输入和 FVTT 兼容边界的冲突，因此本仓库不得把 #3 当作一个单独功能实现。

本仓库应当按下表拆分执行：

| 能力族 | 上游输入 | 本仓库应当执行 | 默认拒绝合同 | 启用/验收合同 |
| --- | --- | --- | --- | --- |
| 变量与多语句 | `$0e(3d6)`、`$0>2`、`;` 分隔、最后语句为结果 | 必须通过 `rollProgram()` 或 program 专用入口启用；变量必须保存完整 `RollValue` 快照 | `dice()` / `roll()` 默认必须拒绝 `$` 和 `;`，`meta.feature='program'` | 测试必须覆盖变量写入、读取、覆盖、缺失变量、预算共享、statement range |
| 比较、布尔、三目 | `>`、`<`、`&`、`|`、`? :` 返回数值布尔 | 必须由 `features.conditionals` 显式启用；三目必须短路 | 未启用时相关 token 必须整体拒绝，不能被普通 parser 拆碎 | 测试必须证明未选分支不消耗随机数、不写变量、不触发运行时错误 |
| `!` 与 `X?` | `!` 被讨论为非运算，`X!` 被讨论为阶乘，`X?` 被讨论为阶加 | 必须先写 ADR 区分逻辑非、阶乘、阶加和三目 `?` 的词法歧义 | 在 ADR 前必须抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='factorialOrNotOperator'` 或 `stepSumOperator` | ADR 必须写清前缀/后缀位置、优先级、整数边界、预算和 trace |
| `df` alias | `df` 等同 `f` | 应当通过 `features.fateAlias` 启用，并归一化到既有 FATE `FNode` | 未启用时 `df` 必须拒绝，`meta.feature='fateAlias'` | 成功时必须产生 `SYNTAX_NORMALIZED` diagnostic，并复用 FATE 随机预算与 trace |
| 元组值模型 | `[4d6k3,...]`、最外层元组计算每个成员、骰子节点有 scalar/tuple 解释 | 必须先有 `RollValue`，再实现 tuple literal 和 tuple-aware operator | 默认不得把 `[]`、`,` 纳入 V1 语法 | `roll().raw` 必须暴露 tuple；旧 `dice()` 必须继续投影成 number |
| `kh/kl/dh/dl` | tuple keep/drop，`2d20kl` 应当作用于 `2d20` 的 tuple 输出 | 必须通过 `features.tupleOperators` 启用，并与 V1 `k/q` 分开 | 未启用时多字符 token 必须整体拒绝 | trace 必须记录 selected/dropped indexes、原始顺序和排序规则 |
| `min/max` clamp | `5min6=6`、`7max6=6`、tuple 逐项 clamp | 必须通过 `features.clampOperators` 启用，且语义必须按 OneDice 约定而不是 JS 函数直觉 | 未启用时 `min/max` 必须整体拒绝 | trace 必须记录 before、limit、after；tuple 输入必须逐项处理 |
| `lp` loop | `[1,2,8]lp[...]`，循环中变量 `i` 可用 | 必须先固化循环边界、步长、预算、局部作用域和嵌套深度 | 未启用时 `lp` 必须拒绝 | 必须有 `maxLoopIterations`、`maxLoopDepth`、`maxEvaluationSteps`，并覆盖预算错误 |
| `sp/tp` | `sp` 做元组索引/裁切，`tp` 强制取 tuple 输出 | `sp` 必须按 ADR-007 的 1 基索引、闭区间、步进区间执行；`tp` 必须只投影已有 raw，不重新求值 | 未启用时 `sp/tp` 必须拒绝 | 测试必须覆盖越界、空 tuple、骰子 tuple、显式 tuple、旧 API 投影 |
| FVTT 与移动端输入 | FVTT 语法是已有用户习惯；`$`、`[`、`]` 移动端输入不便，`@` 被讨论为替代 | 必须通过 `syntax: 'fvtt-compatible'` 或独立 feature flag 隔离；不得同时默认支持多个变量标记 | 默认 `onedice` 必须拒绝 `@path`、FVTT 池、FVTT-only modifier | 兼容模式必须产生归一化 diagnostic；未实现 Foundry 能力必须结构化拒绝 |

## 已关闭 Issue

### #10：COC 奖惩骰判断方法

URL：https://github.com/OlivOS-Team/onedice/issues/10

状态：closed

上游已接受规则：

- 十位骰取值为 `00, 10, 20, ..., 90`。
- 个位骰取值为 `0, 1, 2, ..., 9`。
- 十位与个位相加为 `0` 时，最终结果必须映射为 `100`。
- 奖励骰和惩罚骰替换十位；奖励取较好结果，惩罚取较差结果。

本仓库必须执行：

- `PNode` 或等价百分骰求值路径必须使用上述规则，不得保留旧个位 `1..10` 方案。
- 随机序列必须可注入，测试不得依赖真实 `Math.random()`。
- trace 必须保留基础十位、个位、替换十位、候选最终值和被选中的最终值。
- 最小测试必须覆盖 `00 + 0 => 100`、单奖励、单惩罚、多奖励、多惩罚和候选边界。

### #9：`d` 左右值上限增加到 `10000`

URL：https://github.com/OlivOS-Team/onedice/issues/9

状态：closed

上游已接受规则：

- `d` 的左值和右值必须支持到 `10000`。

本仓库必须执行：

- 语义边界必须允许 `10000d1` 和 `1d10000`。
- 超过语义上限的输入必须抛结构化参数错误，例如 `10001d1`、`1d10001`。
- 浏览器安全必须通过运行预算处理；允许 `10000` 作为语义上限，不等于允许无限随机调用。
- `maxRollCount` 旧配置名应当继续映射到 `maxRandomCalls` 或等价预算字段，避免破坏既有调用方。
- 测试必须区分“语义上限错误”和“运行预算耗尽错误”，后者应当使用 `EVALUATION_BUDGET_EXCEEDED` 并带 `meta.budgetKind='randomCalls'`。

### #5：Rust `diro` 生态实现

URL：https://github.com/OlivOS-Team/onedice/issues/5

状态：closed

上游已接受内容：

- Rust `diro` 库被上游接受为可追加到相关文档中的生态实现。

本仓库应当执行：

- `diro` 只能作为跨实现行为参照或静态 fixture 来源。
- 浏览器核心包不得新增 Rust/WASM 初始化路径、二进制资源加载或 Node-only 构建步骤。
- 若行为对照发现差异，必须先写兼容表或 ADR，不得用运行时分支偷偷切换语义。

## 应当落地的工程产物

后续从这些 issue 拆出的任务必须至少交付以下产物：

1. **Issue 映射**：任务描述必须写明来源 issue、对应 ADR、受影响 API 和默认拒绝行为。
2. **测试矩阵**：每项能力必须有默认拒绝测试、启用成功测试、非法输入测试、预算测试和 `JSON.stringify(result)` 测试。
3. **文档示例**：README 必须展示成功、失败和浏览器 UI 捕获错误的路径。
4. **错误合同**：用户可触达失败必须抛 `OneDiceError`，并断言 `code/meta`，不得只比较 message。
5. **浏览器验收**：影响包入口、类型、trace、diagnostic 或兼容模式时，必须运行 `npm.cmd run test:browser` 与 `npm.cmd pack --dry-run`。
6. **非目标边界**：未实现的 V2/FVTT 能力必须有结构化拒绝测试，不得被普通 parser error 或 fallback 结果掩盖。
