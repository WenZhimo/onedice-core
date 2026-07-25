# OneDice 浏览器核心改进方案

最后更新：2026-07-25

适用仓库：`WenZhimo/onedice-core`，上游源码为 `Anillc/onedice`，包名为
`@onedice/core`。

资料来源：

- 上游标准仓库：`OlivOS-Team/onedice`
- 本地议题记录：[upstream-onedice-issues.md](./upstream-onedice-issues.md)
- 当前源码入口：`src/index.ts`
- 当前语法定义：`utils/grammar.yaml`、`src/parser/grammar.json`
- 当前骰子节点：`src/ast/dice/*.ts`

### 2026-07-24 方案强化结果

本轮修订将方案口径固定为“应当/必须/不得”的工程合同。文档正文不再把必做事项写成软性任务；凡是仍未定的能力，必须写成“待 ADR 决定，当前 parser 拒绝”，并同步写明阻塞问题、临时错误码、`meta.feature` 和浏览器展示方式。

### 2026-07-25 七次强化：应当化执行版

本轮修订继续把方案从“改进方向”推进为“执行要求”。本文档后续不得使用软性动词表达执行事项；凡是来自上游 issue、ADR、README、公开 API、浏览器包目标或测试缺口的内容，都应当写成“应当/必须/不得/待 ADR 决定”。如果某段文字无法改写为这些词，说明它还不是可实现任务，必须补充阻塞原因、ADR 缺口、当前拒绝策略和验收命令。

| 原软性口径 | 当前必须改写为 | 必须展开的技术细节 | 验收证据 |
| --- | --- | --- | --- |
| “软性：支持某语法” | “在 `<入口>` 下应当支持 `<成功输入>`，默认模式必须拒绝 `<失败输入>`” | `syntax` / `features` / `rollProgram()` 入口、lexer token、AST 节点、`RollValue` 输入输出、默认拒绝错误码 | 默认拒绝测试、启用成功测试、近邻旧语法回归 |
| “软性：错误提示更友好” | “必须抛稳定 `OneDiceError.code` 并填充指定 `meta` 字段” | `meta.range`、`meta.feature`、`meta.actual`、`meta.limit`、`meta.operator`、`meta.hint`、textarea 高亮策略 | 错误测试断言 `code/meta`，README 错误表覆盖该 code |
| “软性：兼容 FVTT” | “应当通过 `syntax: 'fvtt-compatible'` 或独立 `features` 隔离 FVTT 子集” | adapter 白名单、默认模式拒绝、归一化 diagnostic、resolver 同步边界、未实现 Foundry 能力拒绝矩阵 | 默认模式和兼容模式成对测试，browser smoke 执行 bundle |
| “软性：改善浏览器使用” | “必须满足浏览器工程验收矩阵” | ESM/CJS/types 导出、`sideEffects=false`、Node-only 字符串扫描、JSON-safe trace、pack 白名单 | `npm.cmd run test:browser`、`npm.cmd pack --dry-run`、`.tgz` 残留检查 |
| “软性：后续再处理” | “待 ADR 决定，当前 parser 应当结构化拒绝” | ADR 编号或缺口、临时 `meta.feature`、拒绝 token 的 `range`、不能提前实现的兼容风险 | 暂缓清单、默认拒绝测试、docs/ADR 链接 |

执行本方案时，每个条目必须落成“入口、解析、求值、错误、trace/diagnostic、文档、测试、浏览器验收、回滚”九段式合同。缺少任何一段，不得进入源码实现。

```text
入口：调用方应当通过 <dice/roll/rollProgram/syntax/features/env/resolver> 触发能力。
解析：lexer/scanner/grammar/adapter 必须说明 token、优先级、range 和默认拒绝路径。
求值：AST 节点必须说明消费 scalar 还是 tuple、是否消耗随机数、是否共享 EvaluationContext。
错误：每条失败路径必须有 OneDiceError.code、meta 字段、range 和浏览器 hint。
Trace：成功路径必须声明 raw.kind、trace.kind、子 trace 顺序、随机调用序号和 JSON-safe 约束。
Diagnostic：non-fatal diagnostic 必须先落到 RollDiagnostic 类型、README、ADR 和测试。
文档：README、ADR、issue 记录和本方案必须同步公开入口、错误码、feature flag 与非目标。
验收：必须列出单元测试、typecheck、browser smoke、build、pack dry-run 和残留检查。
回滚：关闭 feature flag 或恢复默认 syntax 后，必须回到结构化拒绝，而不是静默改变旧语义。
```

#### Issue 级执行蓝图

以下蓝图把上游 issue 的执行要求继续展开到模块、类型、控制流和浏览器结果。后续拆 PR 时不得只引用本表标题；必须把对应行展开成具体测试文件、具体错误码和具体输出字段。

| Issue | 应当实现或固化的行为 | 解析与 AST 落点 | 求值与公开输出 | 错误和浏览器高亮 | 必须验收 |
| --- | --- | --- | --- | --- | --- |
| #11 `d` 表达式形式化 | 普通 `d` 应当以槽位合同表达骰数、面数、骰池阈值、keep/drop、奖惩数和缺省值；README 不得只保留压缩口诀 | `src/ast/dice/d.ts` 必须在随机调用前归一化参数；lexer/parser 必须区分缺失右值、未知尾缀、互斥 modifier 和越界数量 | `roll()` 应当返回可展示的 dice raw tuple；trace 必须保留原始投掷顺序、kept/dropped、modifier、range 和随机调用序号 | `1d`、`d0`、`2d6a5k1`、`2d6k1p1` 必须分别有稳定 `code/meta.range/meta.hint`；UI 应当能高亮具体缺失或冲突片段 | `test/issues/issue-011-d-notation.test.ts`、`test/v1/runtime-errors.test.ts`、README 槽位表测试 |
| #3 V2 草案 | V2 应当拆成独立能力族；不得出现“V2 总开关”，不得让 `dice()` 默认接受 program、tuple 或 FVTT 语法 | `utils/grammar.yaml`、`src/parser/*`、`src/ast/tuple*.ts`、`src/ast/clamp.ts`、`src/ast/conditionals.ts`、`src/ast/loop.ts` 必须按 feature flag 隔离 | `RollValue` 必须表达 scalar、tuple、dice-roll tuple 和 operator tuple；tuple operator 不得二次求值左侧；program/loop 必须共享预算和变量快照 | 未启用时 `$`、`;`、`[]`、`kh/kl/dh/dl`、`min/max`、`tp/sp/lp`、`!`、后缀 `?` 必须整体结构化拒绝并带 `meta.feature` | 对应 `test/v1/<feature>.test.ts`、`test/v1/parser-errors.test.ts`、`test/v1/json-serialization.test.ts`、`npm.cmd run typecheck` |
| #10 COC 奖惩骰 | 百分骰应当按上游关闭规则执行：十位 `00..90`、个位 `0..9`、`00+0=>100`，奖励取较小最终值，惩罚取较大最终值 | `src/ast/dice/p.ts` 必须把基础十位、个位、追加十位和候选构造成显式 trace；不得把个位实现回退为 `1..10` | `trace.kind='percentile'` 必须包含 `baseTensRandomCall`、`onesRandomCall`、`extraTensRandomCalls`、`candidates`、`selected` | 非法奖惩数量、预算不足、随机源越界必须区分；失败路径不得留下半成品候选 trace | `test/issues/issue-010-percentile-bonus-penalty.test.ts`、`test/v1/roll-trace.test.ts`、固定随机序列回归 |
| #9 `d` 上限与预算 | 骰数和面数上限应当支持到 `10000`；浏览器同步安全必须由运行预算承担，不得用降低语义上限规避风险 | `src/config.ts`、`src/evaluation/context.ts`、`src/ast/dice/d.ts` 必须分离语义上限和 `maxRandomCalls`；旧 `maxRollCount` 应当映射到兼容预算入口 | 合法边界 `1d10000`、`10000d1` 应当成功；低预算下的大骰量应当在随机消耗前或消耗边界处抛预算错误 | `10001d1`、`1d10001` 是参数错误；低预算是 `EVALUATION_BUDGET_EXCEEDED` 且 `meta.budgetKind='randomCalls'`；二者不得共用错误码 | `test/issues/issue-009-d-limits.test.ts`、`test/v1/evaluation-context.test.ts`、随机源未继续调用断言 |
| #5 Rust `diro` 生态 | `diro` 应当只作为跨实现行为参照；浏览器核心不得引入 Rust、WASM、native addon、二进制资源或异步初始化 | 对照数据只能进入 `docs/`、ADR 或 `test/compat/*` 静态 fixture；核心 parser 不得为了 Rust 实现改变默认 OneDice 语义 | fixture 只记录表达式、配置、随机序列、结果、错误码、trace 差异和来源版本；运行时不得加载外部实现 | pack/browser 审计发现 `.wasm`、Rust wrapper、`fs/path/os/crypto`、`process.`、`Buffer` 或 native addon 时必须视为失败 | `npm.cmd run test:browser`、`npm.cmd pack --dry-run`、pack 白名单和 Node-only 字符串扫描 |

#### 浏览器实现细节必须展开

浏览器目标不得停留在“能打包”。每个影响公开入口、错误、trace、diagnostic、feature flag 或包字段的任务，都必须补齐以下工程细节：

| 浏览器面 | 应当固定的实现细节 | 不得出现的退化 |
| --- | --- | --- |
| 导入方式 | README 应当展示纯 TypeScript、Vite、React、Vue 的最小接入，并统一从包入口导入公开 API | 不得要求浏览器用户从 `src/` 深路径导入，也不得依赖 Node polyfill |
| 结果展示 | UI 应当消费 `roll().value`、`raw`、`trace`、`diagnostics`；错误 UI 应当消费 `OneDiceError.code/meta` | 不得解析 `DiceNode#toString()`、完整 `message` 或内部类名 |
| 输入高亮 | 所有用户可触达错误应当尽量提供 `meta.range`；无法精确定位时必须写明最小可用范围和后续补齐条件 | 不得只返回整条输入的笼统错误，除非文档和测试写明该限制 |
| 随机复现 | 示例和测试应当传入确定性 `random`，trace 应当保留全局随机调用序号 | 不得在测试中依赖真实 `Math.random()`，不得让节点绕过 `EvaluationContext` |
| 同步预算 | 大骰量、循环和复杂 tuple 应当受 `maxRandomCalls`、`maxEvaluationSteps`、`maxLoopIterations`、`maxLoopDepth` 控制 | 不得让浏览器线程因未受控循环或随机调用阻塞 |
| 发布内容 | `files` 白名单应当只发布 `README.md`、`package.json` 和 `dist/*`，并由 pack dry-run 审计 | 不得发布 `src/`、`test/`、临时 tarball、WASM/native addon 或宿主 runtime bridge |

#### 公开类型与测试同步要求

新增或修改公开能力时，以下对象必须同步变化；任意缺项都应当阻止合并：

| 变化类型 | 必须同步的对象 | 最小测试 |
| --- | --- | --- |
| 新 feature flag | `RollFeatureFlags`、`DEFAULT_FEATURES`、README 配置说明、本方案执行口径 | `test/issues/readme-feature-flags.test.ts`，默认 false 与文档覆盖 |
| 新错误码 | `OneDiceErrorCode`、错误抛出点、README 错误表、运行时错误测试 | `test/issues/readme-error-codes.test.ts`，断言 `code/meta` |
| 新 trace kind | `RollTrace` 类型、产生节点、JSON 序列化测试、浏览器 smoke 如影响 bundle | `test/v1/json-serialization.test.ts`，不得回退 `kind='generic'` |
| 新 diagnostic code | `RollDiagnostic` 类型、ADR-002、README 示例、成功结果携带规则 | 对应 diagnostic 测试，`JSON.stringify(result)` 成功 |
| 新语法 token | lexer/scanner、parser 表、默认拒绝测试、启用成功测试、近邻旧语法回归 | `test/v1/parser-errors.test.ts` 和 feature 专属测试 |
| 新包入口或导出 | `src/index.ts`、声明文件、`exports`、README 导入示例、browser fixture | `npm.cmd run typecheck`、`npm.cmd run test:browser`、`npm.cmd pack --dry-run` |

后续从本方案拆出的任务必须同时交付以下证据：

| 证据类型 | 必须落到的技术细节 | 不满足时的处理 |
| --- | --- | --- |
| 入口证据 | 明确 `dice()`、`roll()`、`rollProgram()`、`syntax`、`features`、`env`、`resolver` 中哪一个启用能力 | 补 API 合同；默认 parser 不得隐式开启新语义 |
| 解析证据 | 明确 lexer token、兼容 scanner、grammar 产生式、parser 表生成命令和源码 `range` | 补默认拒绝测试；不得让未来语法退化为普通 parse error |
| 求值证据 | 明确 AST 节点如何消费 `RollValue`、是否消耗随机数、是否共享 `EvaluationContext` | 补预算和变量快照合同；不得在节点内部绕过预算随机源 |
| 错误证据 | 明确每条失败路径的 `OneDiceError.code`、`meta.range`、`meta.actual`、`meta.limit`、`meta.hint` | 补错误码和 `meta` 测试；不得只断言完整 message |
| trace 证据 | 明确 `trace.kind`、子 trace 顺序、随机调用序号、selected/dropped/success indexes 和 JSON-safe 约束 | 补 trace 类型和序列化测试；浏览器 UI 不得解析 `toString()` |
| 浏览器证据 | 明确 ESM/CJS/types 输出、无 Node-only 依赖、pack 内容、同步预算和 textarea 高亮路径 | 跑 `npm.cmd run test:browser` 与 `npm.cmd pack --dry-run`；不得发布不受控产物 |

### 2026-07-25 八次强化：补丁验收与反回退执行细则

本轮修订把“概括性内容展开”继续压到补丁验收层。后续维护者不得只把任务写成“某能力已完成”“浏览器可用”“错误已处理”或“trace 已有覆盖”；每个补丁都必须证明它在默认拒绝、显式启用、非法输入、预算保护、序列化、文档同步和发布内容七个维度同时成立。任一维度缺失时，该补丁只能停留在准备阶段，不得作为执行完成。

| 验收维度 | 必须写清的补丁级证据 | 必须断言的失败边界 | 不得接受的概括写法 |
| --- | --- | --- | --- |
| 默认拒绝 | 未启用 `syntax` 或 `features` 时，lexer/scanner 必须把保留 token 识别为完整能力片段，并抛 `PARSE_UNSUPPORTED_SYNTAX` 或更具体 `OneDiceError.code` | `meta.feature`、`meta.range`、必要 `meta.hint` 必须指向原始输入片段 | “默认不支持该语法” |
| 显式启用 | 启用入口必须写成具体调用，例如 `roll(input, { features: { tupleOperators: true } })` 或 `rollProgram(input, config)` | 开启后仍非法的参数必须走能力专属错误，不得变成普通 parser message | “开启后可用” |
| 求值控制 | AST 节点必须声明读取 scalar 还是 tuple、是否重新求值左侧、是否消耗随机数、是否写变量、是否共享 `EvaluationContext` | 预算不足时必须抛 `EVALUATION_BUDGET_EXCEEDED`，并保留 `meta.budgetKind/actual/limit/range` | “按现有逻辑求值” |
| 公开输出 | 成功结果必须断言 `value`、`raw.kind`、`raw.source`、`trace.kind`、关键子 trace 和 `diagnostics` 顺序 | `JSON.stringify(result)` 必须成功；新增节点不得回退为 `kind='generic'` | “trace 已覆盖” |
| 错误输出 | 用户可触达失败必须断言 `OneDiceError.code` 和最小稳定 `meta` 字段集合 | 测试不得断言完整 `message` 作为唯一合同；普通 `throw new Error` 不得出现在源码用户路径 | “错误已处理” |
| 文档同步 | README、ADR、`docs/upstream-onedice-issues.md` 和本方案必须同步公开入口、feature flag、错误码、trace/diagnostic 或非目标边界 | 新增公开 code/kind/flag 未进入 README 或 ADR 时必须让文档一致性测试失败 | “文档后续补” |
| 浏览器发布 | 影响入口、类型、trace、diagnostic、feature flag 或包字段时必须运行 browser smoke 和 pack dry-run | bundle 不得出现 `fs/path/os/crypto`、`process.`、`Buffer`、`.wasm`、native addon、`src/`、`test/` 或临时 `.tgz` | “Vite 能构建” |

#### 补丁描述必须包含的字段

从本方案拆出的每个 PR 或 issue 描述必须使用以下字段；字段为空时不得进入实现：

```md
## 来源与状态
- 来源：#<issue> / ADR-<number> / README / 浏览器发布目标
- 上游状态：open / closed / accepted / deferred
- 本仓库口径：已关闭规则必须固化；开放规则必须隔离；待 ADR 能力必须结构化拒绝

## 入口与默认行为
- 成功入口：<dice/roll/rollProgram/syntax/features/env/resolver>
- 默认拒绝输入：
- 默认拒绝错误码：
- 默认拒绝 meta：

## 成功输出
- value：
- raw.kind / raw.source：
- trace.kind：
- diagnostics：
- JSON 序列化断言：

## 失败输出
- 非法输入：
- 错误码：
- meta.range：
- meta.actual / meta.limit / meta.feature / meta.hint：
- 浏览器 UI 高亮或提示：

## 文件落点
- parser / scanner / grammar：
- AST / evaluation：
- errors / trace / config：
- README / ADR / issue 记录：
- test 文件：

## 验收命令
- 单元测试：
- typecheck：
- browser smoke：
- pack dry-run：
- 残留检查：
```

#### 当前下一批补丁应当优先补强的证据

以下补丁不新增语法面，属于防回退守卫。它们应当优先执行，因为它们直接决定浏览器调用方能否稳定消费错误、diagnostic、trace 和发布包：

| 补丁 | 应当补强的技术细节 | 必须证明的公开合同 | 最小验收 |
| --- | --- | --- | --- |
| `test: serialize rollProgram diagnostics` | 已在 `test/v1/json-serialization.test.ts` 中使用显式启用 `features.fateAlias` 的 `$0e(4df);$0+1` 锁定 `rollProgram()` diagnostic 序列化 | 顶层 `diagnostics`、statement 级 diagnostics 与 statement result diagnostics 均 JSON-safe；`feature/original/normalized/range`、变量快照和预算字段已被断言 | `npm.cmd test -- test/v1/json-serialization.test.ts test/v1/program.test.ts test/v1/fate-alias.test.ts` |
| `test: lock public diagnostic boundary` | 已通过 `RollDiagnosticCode = 'SYNTAX_NORMALIZED'`、`EvaluationDiagnostic.code` 字面量类型和 `test/issues/diagnostic-boundary.test.ts` 锁定当前公开诊断边界 | `FEATURE_FLAG_REQUIRED`、`COMPATIBILITY_PROJECTION`、`BUDGET_NEAR_LIMIT` 在类型、README、ADR、测试完成前不得进入源码或 README 合同 | `npm.cmd test -- test/issues/diagnostic-boundary.test.ts test/v1/fate-alias.test.ts test/v1/fvtt-compatibility.test.ts test/issues/docs-cross-links.test.ts` |
| `test: verify projection ranges` | 已通过 `test/issues/projection-range-contract.test.ts` 扫描 `src/` 中所有 `projectToNumber()` 消费方必须传入 range，并在 `test/v1/roll-value.test.ts` 补齐递归 `sum/last` 投影失败的 range 断言 | `TUPLE_EMPTY_PROJECTION`、`TUPLE_CANNOT_PROJECT` 的 `meta.range` 可映射到 textarea；resolver 返回 `RollValue` 时不得丢失原始 `@path` 范围 | `npm.cmd test -- test/issues/projection-range-contract.test.ts test/v1/roll-value.test.ts test/v1/fvtt-compatibility.test.ts` |
| `test: harden package publication audit` | 已通过 `test/browser/package-contents.test.ts` 读取真实 `npm pack --dry-run --json` 文件列表，并精确锁定当前 8 个受控发布文件 | 发布文件只允许 `README.md`、`package.json`、`dist/index.cjs`、`dist/index.cjs.map`、`dist/index.d.mts`、`dist/index.d.ts`、`dist/index.mjs`、`dist/index.mjs.map`；dry-run 后不得留下 `.tgz` | `npm.cmd run test:browser`、`npm.cmd pack --dry-run`、`Get-ChildItem -Name *.tgz` |
| `docs: sync issue plan with ADR status` | 已通过 `test/issues/docs-cross-links.test.ts` 锁定本方案、README、ADR 与 `docs/upstream-onedice-issues.md` 的互链、状态和执行口径；`#3/#11` 必须保持 Open 设计输入，`#5/#9/#10` 必须保持 Closed 测试规则 | 开放 issue 只能作为设计输入；关闭 issue 必须成为测试规则；暂缓能力必须写明当前拒绝策略；新增 ADR 或 issue 状态变化必须同步计划表、上游 issue 记录和对应验收测试 | `npm.cmd test -- test/issues/docs-cross-links.test.ts` |

这些补丁完成前，第一阶段不得被标记为全部完成。即使 `npm.cmd test` 已经通过，若上述公开合同没有被对应测试或文档锁定，也只能视为“当前实现可运行”，不能视为“计划已执行完毕”。

#### 2026-07-24 二次强化：应当化与技术展开范围

本次补强继续把方案从方向性描述收敛为可派发、可测试、可回滚的工程任务。凡是来自上游 issue、已关闭决议、ADR 或浏览器目标的条款，正文必须使用“应当/必须/不得”；无法落成这些词的内容，不得停留在实施章节，必须移入“待 ADR 决定”并写明当前 parser 的结构化拒绝行为。

| 审计对象 | 文档必须写成 | 技术展开必须包含 | 验收必须证明 |
| --- | --- | --- | --- |
| 能力入口 | “在 `roll()`/`rollProgram()`/`syntax`/`features` 下应当启用” | API 名称、配置字段、默认值、是否修改调用方传入对象 | 默认配置保持保守；显式配置启用后才接受输入 |
| 默认拒绝 | “默认模式必须拒绝某输入” | token、`meta.feature`、`range`、`OneDiceError.code`、UI 高亮片段 | 拒绝测试断言 `code/meta`；不得依赖完整 message |
| 成功语义 | “显式启用后应当产生某结果” | `value`、`raw.kind`、`raw.source`、`trace.kind`、随机调用序号 | 固定随机序列下结果稳定，`JSON.stringify(result)` 成功 |
| 预算安全 | “运行预算必须先于随机消耗生效” | `maxRandomCalls`、`maxEvaluationSteps`、`maxLoopIterations`、`maxLoopDepth` | 预算耗尽抛 `EVALUATION_BUDGET_EXCEEDED`，且不留下半成品 trace |
| 兼容归一化 | “兼容模式应当产生 diagnostic” | `SYNTAX_NORMALIZED`、`original`、`normalized`、`feature`、原始 `range` | 默认模式仍拒绝；兼容模式只归一化已实现白名单 |
| 发布输出 | “浏览器包必须可直接消费” | ESM、CJS、`.d.ts`、`sideEffects`、Node-only 字符串扫描、pack 白名单 | `npm.cmd run test:browser` 与 `npm.cmd pack --dry-run` 通过且无临时包残留 |

概括性任务必须展开成三段式合同：

```text
入口：在 <API/config> 下，应当接受 <成功输入>，并产生 <value/raw/trace/diagnostic>。
拒绝：在默认 <syntax/features> 下，必须拒绝 <失败输入>，错误为 <code/meta/range>。
验收：必须运行 <测试文件>、<typecheck/build/browser/pack 命令>，并说明是否影响 README 或 ADR。
```

例如“FVTT 池”不得只写成一句兼容目标。它必须拆成：默认 `onedice` 拒绝 `{4d6,3d8}kh`、`syntax: 'fvtt-compatible'` 归一化 `{4d6,3d8}` 为内部 tuple、`features.tupleOperators` 决定 `kh/kl` 是否可用、diagnostic 保留原始片段、Vite smoke 实际执行 bundle、pack 审计确认未引入 Foundry runtime 或 Node-only 依赖。

本方案后续不接受只写“实现某能力”的任务。每个任务标题必须写成“在某入口下实现某行为，并在默认模式下拒绝某输入”；任务正文必须包含成功输入、失败输入、错误码、trace 字段、受影响文件和验收命令。

#### 2026-07-24 三次强化：Issue 合同落地粒度

本次补强把软性措辞彻底降级为上游原文语气，不能作为本仓库执行语气。凡是来自
GitHub issue、ADR、README 公开 API 或浏览器目标的内容，在本方案中都必须写成
“应当/必须/不得/待 ADR 决定”。如果某句话只是“可以考虑”“后续支持”“优化体验”，
维护者必须先把它拆成以下五段，才能进入实现任务：

```text
来源：来自 <issue/ADR/README/API>，当前状态是 <open/closed/accepted/deferred>。
入口：调用方通过 <dice/roll/rollProgram/syntax/features/env/resolver> 触发。
行为：成功输入应当产生 <value/raw/trace/diagnostic>，默认输入必须结构化拒绝。
边界：失败必须抛 <OneDiceError.code>，并填充 <meta.feature/range/hint/actual/limit>。
验收：必须运行 <测试文件/命令>，并同步 <README/ADR/issue 记录>。
```

上游 issue 的每一条执行内容都应当至少拆成一个“成功合同”和一个“拒绝合同”。只描述成功路径的任务不得合并，因为浏览器调用方同样依赖失败路径来做输入高亮、feature 开关提示、错误国际化和安全预算控制。

| Issue | 成功合同应当写清 | 拒绝合同必须写清 | 技术展开必须落到 | 浏览器侧必须能看到 |
| --- | --- | --- | --- | --- |
| #11 `d` 表达式形式化 | `2d20k1`、`d20`、`2d20p1`、`7a5m6k4` 等 V1 合法表达式的槽位、缺省值、modifier 顺序和 trace | `1d`、`d0`、`2d20a8k1`、`2d20k1p1`、未知尾缀必须分别抛结构化错误，不得共享普通 parser message | `DNode` 参数模型、modifier 互斥矩阵、`src/errors.ts` 错误码、README 槽位表、`test/issues/issue-011-d-notation.test.ts` | `meta.range` 指向缺失/冲突/越界片段；`meta.hint` 能说明骰池、选取线和奖惩骰的互斥关系 |
| #3 V2 草案 | 每个能力族在显式 `features`、`rollProgram()` 或 `syntax` 下独立启用，并产生专属 `raw.kind` / `trace.kind` | 默认 `dice()` / `roll()` 必须拒绝 `$`、`;`、`[]`、`kh/kl`、`min/max`、`lp/sp/tp`、FVTT-only token | `RollFeatureFlags`、ADR-004 到 ADR-009、grammar/adapter 边界、AST 专属节点、`EvaluationContext` 预算 | UI 能按 `meta.feature` 告诉用户需要开启哪个能力，而不是只显示“解析失败” |
| #10 COC 奖惩骰 | 十位 `00..90`、个位 `0..9`、`00+0=>100`、奖励取较小最终值、惩罚取较大最终值 | 非法奖惩数量、预算不足、随机源越界必须在结构化错误中区分 | `PNode` 候选生成、全局随机调用序号、候选 trace、固定随机测试 | UI 能按 trace 展示基础十位、个位、追加十位、候选结果和最终选中候选 |
| #9 `d` 上限 | `1d10000` 与 `10000d1` 是语义合法输入；旧 `maxRollCount` 继续兼容 `maxRandomCalls` | `10001d1` / `1d10001` 是语义错误；低预算下的大量随机调用是预算错误，二者不得混淆 | `src/config.ts`、`src/evaluation/context.ts`、`DNode` 参数校验、预算错误 `meta.budgetKind` | UI 能提示“参数超过语义上限”或“随机调用预算不足”，并能给出提高预算或减少骰数的操作方向 |
| #5 `diro` 生态 | 静态 fixture 应当记录外部实现的公开表达式、结果、错误或 trace 差异 | 不得引入 Rust/WASM、native addon、二进制资源、Node-only 构建步骤或运行时桥接 | `docs/upstream-onedice-issues.md`、兼容表；触发跨实现对照时必须新增 `test/compat/*` 静态数据和 pack 审计 | 浏览器包仍只暴露 TypeScript 核心入口，不出现 `.wasm`、Rust wrapper、`fs/path/os/crypto` 或异步初始化 |

概括性内容必须继续展开到“实现文件 + 公开类型 + 运行控制流 + 验收命令”。以下表格是后续拆 PR 时的最小任务颗粒度；任一列写不出来，任务应当退回 ADR 或测试设计阶段：

| 任务包 | 应当修改或核验 | 成功输入与输出 | 默认拒绝与错误 | 验收命令 |
| --- | --- | --- | --- | --- |
| `docs: harden d notation contract` | `README.md`、`docs/upstream-onedice-issues.md`、本方案 | README 展示 `[骰数]d[面数]`、骰池、选取线、奖惩数和互斥矩阵 | 文档必须列出 `a` 与 `k/q/p/b` 冲突、非法骰数/面数、缺失右值 | `npm.cmd test -- test/issues/readme-error-codes.test.ts test/issues/issue-011-d-notation.test.ts` |
| `test: lock d parser diagnostics` | `src/ast/dice/d.ts`、`src/errors.ts`、`test/issues/issue-011-d-notation.test.ts` | 合法 V1 表达式保留旧 `dice()` 数值返回和新 `roll()` trace | 非法路径断言 `OneDiceError.code/meta.range/meta.hint`，不得断言完整 message | `npm.cmd test -- test/issues/issue-011-d-notation.test.ts test/v1/runtime-errors.test.ts` |
| `feat: isolate one V2 operator` | `utils/grammar.yaml`、生成表、对应 `src/ast/*`、`src/config.ts` | 显式 `features.<name>=true` 后返回专属 `raw/trace` | 未开 flag 时 `PARSE_UNSUPPORTED_SYNTAX` + `meta.feature`，旧 V1 邻近语法不变 | `npm.cmd test -- test/v1/<feature>.test.ts test/v1/parser-errors.test.ts`; `npm.cmd run typecheck` |
| `feat: extend program semantics` | `src/program.ts`、`src/ast/variable.ts`、`src/evaluation/context.ts` | `rollProgram()` statement 顺序、变量快照、最终 statement 结果稳定 | 普通 `dice()` / `roll()` 继续拒绝 `$` 和 `;`；只读/缺失变量抛专属错误 | `npm.cmd test -- test/v1/program.test.ts test/v1/evaluation-context.test.ts` |
| `feat: extend FVTT adapter subset` | `src/parser/fvtt-normalize.ts`、`src/parser/fvtt-success-count.ts`、ADR-006/009 | `syntax: 'fvtt-compatible'` 只接受白名单语法，并产生 `SYNTAX_NORMALIZED` | 默认模式拒绝；兼容模式也拒绝未实现 Foundry 能力，且不得调用 resolver 或宿主全局对象 | `npm.cmd test -- test/v1/fvtt-compatibility.test.ts test/v1/parser-errors.test.ts`; `npm.cmd run test:browser` |
| `build: verify browser package contract` | `package.json`、`tsup.config.ts`、`test/browser/*` | ESM/CJS/types 均从 `dist` 消费；browser smoke 真实执行 bundle | pack 内容不得包含源码草稿、测试、临时 tarball、WASM/native addon 或 Node-only 依赖 | `npm.cmd run test:browser`; `npm.cmd pack --dry-run`; `Get-ChildItem -Name *.tgz` |

技术细节不得只停留在“测试通过”。每项验收都必须明确断言公开对象形状：

- **成功结果**必须断言 `value`、`raw.kind`、必要的 `raw.source/projection/items`、`trace.kind`、关键子 trace 和 `diagnostics`。
- **失败结果**必须断言 `OneDiceError.code`、`meta.range`、`meta.feature`、`meta.actual/limit` 或 `meta.hint`；不得把完整错误文本当作唯一合同。
- **预算结果**必须断言 `EVALUATION_BUDGET_EXCEEDED`、`meta.budgetKind`、`actual`、`limit`，并证明随机源没有继续被调用。
- **浏览器结果**必须断言 `JSON.stringify(result)` 成功、错误对象可结构化展示、bundle 不含 Node-only 依赖、pack dry-run 后没有残留 `.tgz`。
- **文档结果**必须把 README、ADR、issue 记录和本方案保持同源；新增 feature flag、错误码、trace kind 或 diagnostic code 时，四处必须同步更新或明确说明不受影响。

本方案后续不得把“支持浏览器”解释为“能被 Vite 编译”。浏览器可用性必须同时满足：包入口可导入、无 Node-only 依赖、同步预算可控、随机可复现、错误可高亮、trace 可序列化、diagnostic 可解释、feature flag 可回滚、README 示例可复制运行、pack 内容可审计。

#### 2026-07-24 四次强化：未实现诊断与执行队列收口

本轮继续把“概括性缺口”改写为可派发合同。任何仍没有源码类型、README 展示、测试断言和浏览器 UI 使用方式的能力，都不得写成已经存在的公开能力。尤其是 warning diagnostic、near-limit 提醒、兼容性投影提示这类非致命提示，必须先落到 `RollDiagnostic` 字段、诊断码表、测试样例和 README 示例，再允许浏览器 UI 依赖。

| 收口对象 | 当前执行口径 | 应当补齐的技术细节 | 不满足时的处理 |
| --- | --- | --- | --- |
| 已实现 diagnostic | 当前公开合同只包含已落到源码和测试的诊断码 | `src/trace.ts` 类型字段、产生节点、`diagnostics` 顺序、`range`、`feature`、`original`、`normalized` | README、ADR 和本方案必须同步；不得让 UI 解析 `message` |
| 未实现 diagnostic | 只能写为“待 ADR 或测试定义”，不得作为 UI 依赖字段 | code 名称、severity、触发阈值、是否随成功结果返回、是否影响旧 `dice()` | 保持为计划项；不得在示例中读取该 code |
| 执行队列 | 每个待办必须有入口、失败路径、文件落点和验收命令 | `dice()` / `roll()` / `rollProgram()` 入口，`syntax/features`，错误码，trace/raw 字段，测试文件 | 缺少任一项时退回文档或 ADR，不得进入实现 PR |
| 浏览器保护 | 预算失败必须依赖结构化错误，非致命预算提醒必须单独定义 | `EVALUATION_BUDGET_EXCEEDED.meta.budgetKind/actual/limit/range`，未来 warning 的阈值和展示规则 | 当前 UI 只能依赖 fatal 预算错误，不得假设存在 near-limit 诊断 |
| 发布守卫 | 文档写到的浏览器能力必须被真实 bundle 和 pack 审计覆盖 | Vite fixture 执行、Node-only 字符串扫描、CJS/ESM/types 导出、pack 白名单 | 只在 Node import 源码中通过不得视为浏览器完成 |

上游 issue 快照（2026-07-24 复核）：

| Issue | 上游状态 | 本仓库执行口径 | 必须转化为 |
| --- | --- | --- | --- |
| #3 OneDice V2 草案 | Open | 作为长期设计输入，不得一次性合并为默认语法 | ADR、feature flag、默认拒绝测试、分阶段实现 |
| #11 掷骰表达式形式化 | Open | 上游形式化讨论在本仓库内应当升级为文档和错误合同 | README 语法槽位、互斥矩阵、`DNode` 错误码、浏览器 hint |
| #10 奖惩骰判断方法 | Closed | 作为已接受规则，不得再保留旧个位 `1..10` 方案 | 确定性随机测试、纯函数化百分骰 resolver、候选 trace |
| #9 `d` 左右值上限 | Closed | 作为 V1 边界合同，`10000` 必须是骰数和面数的合法上限 | 上限测试、预算语义、错误码和 README 示例 |
| #5 Rust `diro` 生态 | Closed | 只作为跨实现行为参考，不得引入 Rust/WASM 运行时依赖 | 兼容 fixture、行为对照表、非目标说明 |

### 2026-07-24 Issue 复核结论

本轮复核以 GitHub 当前 issue 状态为准：#11 与 #3 仍为开放讨论，#10、#9、#5 已关闭。执行口径必须区分“已关闭规则”和“开放设计输入”，不得把两类 issue 混成同一类开发任务。

| 上游证据 | 当前状态 | 本仓库必须采用的处理方式 | 不得采用的处理方式 |
| --- | --- | --- | --- |
| #11 `d` 表达式形式化 | Open | 应当先固化 README 槽位表、互斥矩阵、错误码、`meta.range` 和浏览器 UI 高亮合同 | 不得只把 `AdB(kq)C(pb)DaE` 换成更长描述后直接结束 |
| #3 OneDice V2 草案 | Open | 应当拆成 feature flag、ADR、默认拒绝测试、启用成功测试和预算/trace 合同 | 不得新增“V2 总开关”，也不得让 `dice()` 默认接受程序语法或 FVTT 语法 |
| #10 奖惩骰规则 | Closed | 必须按 COC 百分骰候选规则锁定实现和 trace，`00+0` 必须映射为 `100` | 不得保留旧个位 `1..10` 或只按十位骰做 `min/max` |
| #9 `d` 上限 | Closed | 必须允许骰数和面数到 `10000`，并用运行预算保护浏览器同步求值 | 不得把面数上限、骰数上限和随机调用预算混成一个错误 |
| #5 Rust `diro` | Closed | 应当作为跨实现行为参照和静态 fixture 来源 | 不得把 Rust/WASM、二进制资源或 Node-only 构建链路引入浏览器核心 |

复核后的任务优先级必须按“关闭 issue 先固化、开放 issue 先隔离、浏览器风险先加守卫”的顺序处理。若后续发现上游 issue 状态变化，必须先更新 `docs/upstream-onedice-issues.md`、本节快照和对应 ADR，再修改 parser 或公开 API。

#### 2026-07-24 五次强化：硬性口径与补丁级技术展开

本轮继续把方案从“方向描述”压缩为“补丁合同”。后续维护者不得保留只表达意图的句子；凡是要进入实现队列的内容，都必须能直接映射到一个最小 diff、一个失败路径、一个公开类型变化和一组验收命令。若某项能力无法写出这些信息，它只能停留在 ADR、issue 记录或暂缓清单中，不得进入 parser、AST 或公开 API。

| 审计项 | 不得保留的写法 | 必须改写成的执行口径 | 技术细节必须写清 |
| --- | --- | --- | --- |
| 能力描述 | “可做 X”“后面处理 X”“改一下 X” | “在 `<入口>` 下应当接受 `<成功输入>`，并在默认模式下拒绝 `<失败输入>`” | API、`syntax/features`、输入样例、错误码、`meta.range` |
| 错误描述 | “提示更友好”“报错更明确” | “必须抛 `<OneDiceError.code>`，并填充 `<meta 字段>`” | `feature`、`range`、`actual`、`limit`、`hint`、浏览器高亮行为 |
| 兼容描述 | “兼容 FVTT/移动端习惯” | “应当通过 `<syntax>` 或 `<feature flag>` 隔离兼容语义” | adapter 边界、归一化 diagnostic、默认拒绝、未实现能力拒绝 |
| 结果描述 | “返回结构化结果” | “应当返回 `<value/raw.kind/trace.kind/diagnostic>`” | raw 数据形状、trace 子节点顺序、随机调用序号、JSON-safe 约束 |
| 验收描述 | “补测试”“跑一下构建” | “必须运行 `<测试文件>` 与 `<命令>`，并说明覆盖的合同” | 单测、typecheck、browser smoke、pack dry-run、`.tgz` 残留检查 |

每个补丁级任务必须按以下顺序展开。顺序不可随意调换，因为默认拒绝合同必须先于成功语义出现，避免浏览器用户在功能半成品阶段获得不稳定 parser 行为。

```text
1. 来源锁定：写明来自 #3/#5/#9/#10/#11、ADR 或 README 的哪一条合同。
2. 默认拒绝：先增加或核验默认 `syntax: 'onedice'` 下的失败路径。
3. 启用入口：定义 `roll()`、`rollProgram()`、`syntax`、`features`、`env` 或 `resolver` 的触发方式。
4. 解析落点：写明 lexer/scanner/grammar/adapter 中的修改点和 `range` 来源。
5. 求值落点：写明 AST 节点如何消费 `RollValue`、预算、随机源和变量快照。
6. 公开输出：写明 `value`、`raw`、`trace`、`diagnostics` 和 `OneDiceError.meta` 的稳定字段。
7. 文档同步：同步 README、ADR、本方案和 issue 记录；新增公开 code/kind/flag 时不得只改源码。
8. 浏览器验收：执行 bundle、序列化、错误高亮和 pack 内容审计。
```

| Issue | 补丁级技术展开 | 必须优先锁定的失败路径 | 必须补齐的公开对象 | 必须运行或保留的验收 |
| --- | --- | --- | --- | --- |
| #11 `d` 形式化 | `DNode` 应当在随机消耗前完成槽位解析、缺省值填充、`a/k/q/p/b` 互斥判断和上限检查；README 槽位表必须与测试读取的文本一致 | `1d`、`d0`、`2d6a5k1`、`2d6k1p1`、未知尾缀和越界数量必须分别落到稳定 `DICE_*` 或 parser 错误 | `meta.range` 指向缺失位置或冲突 modifier；`meta.hint` 解释骰池、选取线、奖惩数的组合规则；trace 保留原始 rolls、kept/dropped 和奖惩候选 | `test/issues/issue-011-d-notation.test.ts`、`test/v1/runtime-errors.test.ts`、README 文档护栏 |
| #3 V2 草案 | 每个能力族应当独立 flag、独立 AST 节点、独立 `raw.kind/trace.kind`，不得出现“V2 总开关”；实现顺序应当按 `RollValue` -> tuple -> selection/clamp -> projection/slice -> conditionals/program/loop -> FVTT 子集推进 | 未开启 flag 时 `$`、`;`、`[]`、`kh/kl/dh/dl`、`min/max`、`tp/sp/lp`、`!`、后缀 `?`、FVTT-only token 必须整体拒绝 | `RollFeatureFlags` 默认 false；`PARSE_UNSUPPORTED_SYNTAX.meta.feature` 指明能力名；所有新 trace 必须可 JSON 序列化且不落回 `generic` | 对应 `test/v1/<feature>.test.ts`、`test/v1/parser-errors.test.ts`、`test/v1/json-serialization.test.ts`、`npm.cmd run typecheck` |
| #10 COC 奖惩骰 | `PNode` 应当把百分骰拆成 base tens、ones、extra tens candidates 和最终候选选择；随机调用必须通过同一 `EvaluationContext` 编号 | 非法奖惩数量、随机预算不足、随机源返回越界必须区分；失败不得生成半成品候选 trace | `trace.kind='percentile'` 应当包含 `baseTensRandomCall`、`onesRandomCall`、`extraTensRandomCalls`、`candidates`、`selected` | `test/issues/issue-010-percentile-bonus-penalty.test.ts`、`test/v1/roll-trace.test.ts`、固定随机序列回归 |
| #9 `d` 上限与预算 | 语义上限应当由 dice/face 参数校验承担，运行安全应当由 `maxRandomCalls` 等预算承担；旧 `maxRollCount` 只作为兼容输入映射 | `10001d1`、`1d10001` 是语义错误；`10000d1` 在低预算下是预算错误；二者不得共用错误码或 `meta.budgetKind` | `DICE_INVALID_DICE_COUNT` / `DICE_INVALID_FACE_COUNT` 应当带 `actual/limit/range`；`EVALUATION_BUDGET_EXCEEDED` 应当带 `budgetKind='randomCalls'` | `test/issues/issue-009-d-limits.test.ts`、预算测试、随机源未继续调用断言 |
| #5 `diro` 生态 | `diro` 只能沉淀为静态对照数据；fixture 应当记录 `implementation/version/expression/config/random/result/raw/trace/error/delta`，不得让运行时加载 Rust、WASM 或 native addon | 任何 `.wasm`、Rust wrapper、Node-only import、异步初始化或二进制资源都必须被 pack/browser 审计拒绝 | 兼容差异应当进入文档或 ADR，不得通过运行时分支自动切换语义 | `npm.cmd run test:browser`、`npm.cmd pack --dry-run`、pack 内容白名单和 Node-only 字符串扫描 |

未实现能力的公开口径必须更加严格：只有 `SYNTAX_NORMALIZED` 已经进入公开 diagnostic 合同；`FEATURE_FLAG_REQUIRED`、`COMPATIBILITY_PROJECTION`、`BUDGET_NEAR_LIMIT` 这类未来诊断码在类型、README、ADR 和测试全部落地前，不得被 README 示例、浏览器 UI 或任务验收引用。若未来需要这些 code，任务必须先新增诊断码表、触发阈值、成功结果携带规则、JSON 序列化测试和 UI 展示约束，再进入实现。

#### 2026-07-24 六次强化：Issue 到浏览器交付的补丁规格

本轮继续把方案从“详细方向”推进为“补丁规格”。后续任务不得只写“支持某语法”“提升浏览器体验”或“补充错误提示”；每个条目都必须落成一组可以直接进入实现、测试和发布验收的字段。字段缺失时，任务必须退回文档或 ADR，不能进入源码阶段。

| 固化对象 | 必须写成的合同 | 必须落到的技术细节 | 必须验收的浏览器结果 |
| --- | --- | --- | --- |
| API 入口 | 在 `dice()`、`roll()`、`rollProgram()`、`syntax`、`features`、`env` 或 `resolver` 中明确唯一入口 | 配置字段名、默认值、是否修改调用方对象、旧 API 投影规则、`RollResult` 形态 | 浏览器侧能用同一入口处理成功、失败和回放；默认模式不接受未开启语法 |
| Parser 边界 | 在默认模式下必须先结构化拒绝，再定义启用后的成功语义 | token 名、scanner 白名单、grammar 产生式、parser 表生成命令、`range` 来源、近邻反例 | textarea 高亮必须指向原始 token；未启用能力不得退化为普通 parse message |
| AST 与求值 | 节点必须说明消费 scalar 还是 tuple，是否重新求值左侧，是否消耗随机数或变量快照 | 节点类名、子节点顺序、`RollValue` 输入输出、`EvaluationContext` 预算字段、随机调用编号 | `JSON.stringify(result)` 成功；UI 能根据 trace 还原掷骰、选择、候选和循环过程 |
| 错误模型 | 每条用户可触达失败必须抛稳定 `OneDiceError.code` | `meta.range`、`meta.feature`、`meta.actual`、`meta.limit`、`meta.operator`、`meta.hint` 的触发条件 | UI 不解析完整 message；错误对象可被结构化展示并能映射到输入片段 |
| Trace/Diagnostic | 成功结果必须声明 `raw.kind`、`trace.kind`、子 trace 顺序和 diagnostic code | `SYNTAX_NORMALIZED` 的 `original/normalized/feature/range`；未来 diagnostic 的 severity、阈值和 README 示例 | 浏览器只消费 `raw/trace/diagnostics`；不得依赖 `DiceNode#toString()` 或内部类实例 |
| 发布与回滚 | 影响入口、类型、feature flag 或包字段时必须跑浏览器和 pack 验收 | ESM/CJS/types、`sideEffects`、`files` 白名单、Node-only 字符串扫描、`.tgz` 残留检查 | npm 包只包含受控产物；关闭 feature flag 后恢复结构化拒绝而非语义漂移 |

每个 issue 的任务拆分必须同时包含成功合同与拒绝合同。成功合同回答“显式启用后应当产生什么结构化结果”；拒绝合同回答“默认模式或非法输入下必须如何失败”。二者不得拆成互不关联的 PR，因为浏览器集成需要在功能未启用、参数错误、预算耗尽和兼容归一化四种状态下保持同一套展示数据。

| Issue | 成功合同必须包含 | 拒绝合同必须包含 | 代码落点必须包含 | 验收命令必须包含 |
| --- | --- | --- | --- | --- |
| #11 `d` 表达式形式化 | `2d20k1`、`d20`、`2d20p1`、`7a5m6k4` 的槽位归一化、缺省值、互斥矩阵、`raw/trace` 字段 | `1d`、`d0`、`2d6a5k1`、`2d6k1p1`、未知尾缀和越界参数的稳定错误码与 `meta.range` | `src/ast/dice/d.ts`、`src/errors.ts`、`src/trace.ts`、README 槽位表、issue 测试 | `npm.cmd test -- test/issues/issue-011-d-notation.test.ts test/v1/runtime-errors.test.ts` |
| #3 V2 草案 | 每个能力族独立 `features.<name>`、专属 AST、专属 `raw.kind/trace.kind` 和预算共享 | 未开启 flag 时 `$`、`;`、`[]`、`kh/kl/dh/dl`、`min/max`、`tp/sp/lp`、FVTT-only token 的整体拒绝 | `src/config.ts`、`utils/grammar.yaml`、`src/parser/*`、`src/ast/*`、ADR-004 到 ADR-009 | 对应 `test/v1/<feature>.test.ts`、`test/v1/parser-errors.test.ts`、`test/v1/json-serialization.test.ts`、`npm.cmd run typecheck` |
| #10 COC 奖惩骰 | 十位 `00..90`、个位 `0..9`、`00+0=>100`、所有候选、最终选中候选和随机调用序号 | 非法奖惩数量、预算不足、随机源越界必须区分；失败不得留下半成品候选 trace | `src/ast/dice/p.ts`、`src/trace.ts`、README 百分骰说明、固定随机 helper | `npm.cmd test -- test/issues/issue-010-percentile-bonus-penalty.test.ts test/v1/roll-trace.test.ts` |
| #9 `d` 上限与预算 | `1d10000`、`10000d1` 合法；旧 `maxRollCount` 映射到 `maxRandomCalls` 或等价预算字段 | `10001d1`、`1d10001` 是语义错误；低预算下的 `10000d1` 是预算错误，二者不得共用错误码 | `src/config.ts`、`src/evaluation/context.ts`、`src/ast/dice/d.ts`、预算测试 | `npm.cmd test -- test/issues/issue-009-d-limits.test.ts test/v1/evaluation-context.test.ts` |
| #5 `diro` 生态 | 静态 fixture 记录外部实现、版本、表达式、配置、随机序列、结果、错误或 trace 差异 | 不得引入 Rust/WASM、native addon、二进制资源、Node-only 构建步骤或异步初始化 | `docs/upstream-onedice-issues.md`、兼容表；触发对照时新增 `test/compat/*` 静态数据 | `npm.cmd run test:browser`、`npm.cmd pack --dry-run`、Node-only 与 pack 白名单审计 |

拆 PR 时必须把“文件落点”写到补丁级别。`README.md` 只能承载公开语法、示例和迁移说明；`docs/decisions/*.md` 只能承载不可轻易回滚的架构决策；`docs/upstream-onedice-issues.md` 只能承载上游状态与执行口径；`src/config.ts` 承载 feature flag 与预算默认值；`src/parser/*` 承载 token、grammar 和兼容 adapter；`src/ast/*` 承载节点语义；`src/evaluation/*` 承载预算、随机源、变量和投影；`src/errors.ts` 与 `src/trace.ts` 承载浏览器可消费的公开结构。

任务验收必须同时证明“有结果”和“没有越界副作用”：新语法成功时要断言 `value/raw/trace/diagnostics`；默认拒绝时要断言 `code/meta/range`；预算失败时要断言随机源未继续调用；兼容模式归一化时要断言调用方 `features` 对象没有被修改；发布验收时要断言 bundle 不含 `fs/path/os/crypto`、`process.`、`Buffer`、`.wasm`、native addon、临时 `.tgz` 或测试目录。

### 本轮强化口径

本轮修订把方案从“改进方向”硬化为“可执行工程合同”。后续任何实现任务都应当能直接回答以下问题，否则不得进入代码阶段：

| 检查项 | 必须回答 | 不满足时的处理 |
| --- | --- | --- |
| 来源 | 对应哪个上游 issue、ADR 或本仓库浏览器目标 | 补充 `docs/upstream-onedice-issues.md` 或新增 ADR |
| 默认行为 | `syntax: 'onedice'` 且未启用 feature flag 时如何处理 | 补默认拒绝测试，错误必须是 `PARSE_UNSUPPORTED_SYNTAX` 或更具体错误码 |
| 启用入口 | 调用方通过 `dice()`、`roll()`、`rollProgram()`、`syntax`、`features`、`env`、`resolver` 中哪个入口启用 | 先补 API 设计，不得把能力偷偷塞进默认 parser |
| 解析路径 | 新 token、grammar 产生式、adapter 或 scanner 的边界在哪里 | 写清是否修改 `utils/grammar.yaml`，是否需要同步生成 `grammar.json/table.json` |
| 求值路径 | 节点消费 scalar 还是 tuple，是否消耗随机数、求值步数、循环预算或变量快照 | 先补 `RollValue`/`EvaluationContext` 合同，不得在 AST 节点内绕过预算 |
| 错误合同 | 每条失败路径的 `OneDiceError.code` 和 `meta` 字段 | 错误测试只断言 `code/meta`，不得依赖完整 message |
| trace/diagnostic | `trace.kind`、`range`、子 trace、随机调用顺序、是否产生 `SYNTAX_NORMALIZED` | `JSON.stringify(result)` 必须成功，浏览器 UI 必须能高亮原始输入 |
| 验收命令 | 至少哪些单元测试、typecheck、build、browser smoke、pack dry-run 必须通过 | 影响浏览器入口、类型或包内容时必须跑 `npm.cmd run test:browser` 与 `npm.cmd pack --dry-run` |

“支持某语法”“优化提示”“后续完善”这类表述不得作为任务标题或验收标准。任务标题应当改成“在某入口下实现某行为，并在默认模式下拒绝某输入”；任务正文应当写明受影响文件、成功输入、失败输入、错误码、trace 字段和验收命令。

### 从 Issue 到实现的强制数据流

任何来自上游 issue 的能力都必须按以下路径落地。该路径用于避免“先写代码、后补解释”的漂移，也用于让浏览器调用方在任意阶段都能获得稳定失败信息。

```text
上游 issue / ADR
  -> 本仓库执行口径
  -> 默认拒绝合同
  -> feature flag 或 syntax mode
  -> lexer / scanner 识别边界
  -> parser grammar 或兼容 adapter
  -> AST 节点与 RollValue 消费规则
  -> EvaluationContext 预算、随机源、变量快照
  -> OneDiceError.code/meta 或 RollDiagnostic
  -> RollTrace / raw JSON-safe 输出
  -> README 示例、issue 测试、浏览器 smoke、pack 审计
```

每一层都必须保留可审计证据：

| 层级 | 必须产物 | 文件落点 | 最小验收 |
| --- | --- | --- | --- |
| 来源层 | issue 编号、状态、执行口径 | `docs/upstream-onedice-issues.md`、本方案 | 开放 issue 必须写明默认拒绝；关闭 issue 必须写明已接受规则 |
| 设计层 | ADR 或本方案技术合同 | `docs/decisions/*.md` | 影响公开 API、优先级、变量、FVTT、预算或包输出时必须有 ADR |
| 配置层 | `syntax` 或 `features` 入口 | `src/config.ts`、`README.md` | 默认值必须保持保守；调用方传入对象不得被修改 |
| 词法层 | token 识别和 `range` | `src/parser/lexer.ts`、兼容 scanner | 未来语法必须整体识别，默认拒绝必须指向原始 token |
| 语法层 | grammar 产生式或 adapter 合同 | `utils/grammar.yaml`、`src/parser/*` | 修改 grammar 后必须同步生成文件；兼容 adapter 不得污染默认模式 |
| AST 层 | 节点类型、`toString()` 兼容、源码范围 | `src/ast/*` | 新节点必须有专属测试，不得塞进 `SimpleNode` 或 generic fallback |
| 求值层 | `RollValue`、预算、变量、随机序号 | `src/evaluation/*` | 随机调用、求值步数、循环预算必须统一由 `EvaluationContext` 管理 |
| 错误层 | 稳定 `OneDiceError.code/meta` | `src/errors.ts`、错误测试 | 用户可触达失败不得抛普通 `Error`；测试不得依赖完整 message |
| Trace 层 | `raw/trace/diagnostics` JSON-safe 合同 | `src/trace.ts`、trace 测试 | `JSON.stringify(result)` 必须成功，且 range 必须能映射回原始输入 |
| 浏览器层 | 构建、导出、无 Node-only 依赖、包内容 | `package.json`、`tsup.config.ts`、`test/browser/*` | `test:browser` 必须执行 bundle；pack 审计不得发布源码、测试或临时包 |

某项能力缺少任一层证据时，必须停留在文档/ADR/测试准备阶段。实现 PR 不得用“后续补文档”“后续补 trace”“后续再看浏览器打包”作为合并条件。

### 2026-07-24 执行级技术细化

本节把前述合同进一步展开为能够直接创建 issue、拆 PR、写测试和验收浏览器包的执行说明。后续维护者不得只引用上游讨论标题或一句能力摘要；每个任务必须写清“入口、启用条件、默认拒绝、实现文件、错误形态、trace 形态、浏览器验收、回滚边界”八项内容。

#### 软性措辞改写规则

方案正文中的实施条款必须使用“应当/必须/不得/待 ADR 决定”。如果上游标题或原文带有软性口吻，本仓库执行口径必须在同段转换为硬性合同：

| 上游或草稿口径 | 本仓库执行口径 | 必须补齐的技术信息 |
| --- | --- | --- |
| 普通 `d` 表达式形式化方向 | README、错误码、互斥矩阵和浏览器高亮应当同步固化 | 槽位表、默认值、互斥关系、`DNode` 校验顺序、`meta.range` |
| OneDice V2 总草案 | V2 应当拆成独立 feature flag 和 ADR，不得变成总开关 | flag 名称、默认拒绝 token、启用入口、AST 节点、预算和 trace |
| COC 奖惩骰规则 | 百分骰候选生成必须按上游关闭规则执行 | 十位/个位取值、`00+0=>100` 映射、候选选择、随机调用序号 |
| `d` 左右值上限 | `10000` 必须是语义边界，运行预算必须另行控制 | 参数上限、预算字段、旧配置映射、语义错误与预算错误区分 |
| Rust 生态实现 | `diro` 应当只作为 fixture 或行为对照来源 | 静态样例格式、差异登记方式、禁止 WASM/Rust 运行时依赖 |

后续如果发现正文中仍有“优化、完善、考虑、支持、兼容”等概括性口吻，必须按下列模板重写为执行条款：

```text
在 <API/feature/syntax> 入口下，应当对 <成功输入> 产生 <raw/trace/value/diagnostic>；
在默认 <syntax/features> 下，必须拒绝 <失败输入>；
失败时必须抛 <OneDiceError.code>，并填充 <meta 字段>；
浏览器 UI 必须能通过 <range/trace/diagnostic> 展示 <高亮/候选/预算提示>；
验收必须运行 <测试文件>、<typecheck/build/browser/pack 命令>。
```

#### API 与配置细节

公开入口必须保持分层，避免把 #3 的状态语义、FVTT 兼容或未来语法塞进默认 `dice()`：

| 入口 | 当前职责 | 显式启用后应当提供的能力 | 必须拒绝的输入 | 验收重点 |
| --- | --- | --- | --- | --- |
| `dice(input, config)` | 旧 API，返回 `[number, DiceNode]`，维持标量投影 | V1 表达式和显式开启后仍可投影为数字的无状态能力 | 默认拒绝 `$`、`;`、`@path`、FVTT 池、tuple 字面量和未启用 V2 token | 不得改变返回形态；新增错误必须仍可被旧调用方捕获 |
| `roll(input, config)` | 浏览器推荐入口，返回 `value/raw/trace/diagnostics` | V1、显式 feature flag、兼容模式的结构化结果 | 默认拒绝未开启 feature；不得静默归一化未来语法 | `JSON.stringify(result)`、`trace.range`、diagnostic 稳定 |
| `rollProgram(input, config)` | 多语句和变量专用入口 | `$0e(...)`、`$tNamee(...)`、statement 顺序、变量快照 | `dice()`/普通 `roll()` 不得共享该状态语义 | statement range、变量覆盖、预算共享、最终值来自最后语句 |
| `syntax: 'fvtt-compatible'` | Foundry/FVTT 输入兼容层 | `@path` resolver、FVTT dice pool 归一化、受控 FVTT 子集 | 默认 `onedice` 不得接受 FVTT-only token；未实现 Foundry 能力必须结构化拒绝 | `SYNTAX_NORMALIZED`、resolver context、无运行时 Foundry 依赖 |
| `features` | 单项能力开关 | tuple、selection、clamp、slice、projection、conditionals、loop、FATE alias、FVTT `cs` | 未开启时对应 token 必须整体拒绝并带 `meta.feature` | 调用方传入对象不得被修改；默认值必须保守 |
| `env/resolver/random` | 浏览器宿主注入层 | 环境变量、FVTT path、确定性随机数 | 不得读取 Node 文件系统、全局 Foundry 对象或异步资源 | resolver 失败包裹、随机调用序号、同步预算可控 |

#### 解析与求值落点

每个语法能力都必须在源码中有明确落点，不得用字符串预处理绕过 parser，也不得把多个能力塞进同一个 generic 节点：

| 层级 | 应当使用的文件或模块 | 具体技术要求 |
| --- | --- | --- |
| 保留 token 识别 | `src/parser/lexer.ts`、FVTT scanner | 未来语法必须作为整体 token 识别；默认拒绝时 `range` 指向原始 token，而不是错误传播后的末尾 |
| grammar 变更 | `utils/grammar.yaml`、`src/parser/grammar.json`、`src/parser/table.json` | 修改产生式后必须同步生成 JSON 表；PR 必须说明新增优先级和结合性是否影响旧表达式 |
| 兼容归一化 | `src/parser/fvtt-normalize.ts`、相关 diagnostic | 兼容 adapter 必须只在本次 parse 内启用临时能力，不得修改调用方 `features` 对象 |
| AST 节点 | `src/ast/*`、`src/ast/dice/*.ts` | 新能力必须有专属节点或专属 dice 节点路径；节点应当保留 `range`、`toString()` 兼容和 raw 输出规则 |
| 求值上下文 | `src/evaluation/context.ts`、`src/evaluation/value.ts` | 随机源、预算、变量表、循环深度和 feature 状态必须通过同一个 `EvaluationContext` 传递 |
| 错误模型 | `src/errors.ts` | 用户可触达失败必须抛 `OneDiceError`；`meta` 应当面向浏览器 UI，而不是只服务测试断言 |
| trace 模型 | `src/trace.ts` | trace 必须 JSON-safe，必须给出 `kind`、子 trace 顺序和足以重放求值过程的关键字段 |

#### 错误码与 `meta` 字段细节

错误合同必须面向浏览器调用方设计。测试不得只断言 message；message 允许调整，`code/meta/range` 才是稳定接口。

| 失败类别 | 必须使用的错误形态 | `meta` 必须包含 | 浏览器展示要求 |
| --- | --- | --- | --- |
| 未启用语法 | `PARSE_UNSUPPORTED_SYNTAX` | `feature`、`range`；存在用户可操作修复路径时必须补 `hint` | 高亮未启用 token，提示需要的 `features` 或 `syntax` |
| 骰子参数越界 | `DICE_INVALID_DICE_COUNT`、`DICE_INVALID_FACE_COUNT`、`DICE_INVALID_KEEP_COUNT` 等 | `operator`、`actual`、`limit`、`range` | 区分骰数、面数、保留数和奖惩数，不得只显示“表达式错误” |
| modifier 冲突 | `DICE_INCOMPATIBLE_MODIFIERS` 或 `DICE_POOL_MODIFIER_EXCLUSIVE` | `modifier`、`conflictWith`、`range`、`hint` | 高亮冲突 modifier 片段，说明 `a` 与 `k/q/p/b` 的互斥关系 |
| 运行预算耗尽 | `EVALUATION_BUDGET_EXCEEDED` | `budgetKind`、`actual`、`limit`、`range` | 提示减少骰数/循环次数或显式提高预算，不得冻结同步 UI |
| 变量缺失或非法 | `VARIABLE_NOT_FOUND`、`VARIABLE_INVALID_VALUE`、`VARIABLE_RESOLVER_FAILED` | `variable`、`actual`、`range`、resolver 失败摘要 | 对 `{env}` 与 `@path` 分别高亮原始输入片段；resolver 异常不得泄露不可序列化对象 |
| 暂缓能力 | `PARSE_UNSUPPORTED_SYNTAX` | `feature`、`range`、`hint='待 ADR 决定'` 或等价说明 | 明确这是保留能力，不得误报成普通 parser 崩溃 |

#### Trace 与 raw 细节

浏览器 UI 应当只消费结构化结果。`toString()` 只能作为人工调试输出，不能作为 UI 状态来源。

| 能力 | `raw` 应当暴露 | `trace` 应当暴露 | 必须覆盖的序列化场景 |
| --- | --- | --- | --- |
| 普通 `d` | 原始投掷项、标量投影、保留/丢弃关系 | `randomCall`、原始 index、`selected/dropped`、modifier 投影 | `JSON.stringify(roll('4d6k3'))` 成功，UI 可按 index 或结果排序 |
| 百分骰 `p/b` | 最终百分值和候选来源 | `onesRandomCall`、`baseTensRandomCall`、`extraTensRandomCalls`、`candidates[].selected` | `00+0=>100`、多奖励、多惩罚可重放 |
| tuple 系列 | tuple item、source、projection | selection/slice/projection 的 source indexes 与 result indexes | tuple literal、骰子隐式 tuple、旧 API 投影均可序列化 |
| program/变量 | statement 列表、最终值、变量快照 | statement range、变量写入/读取 trace、共享预算 | 变量覆盖、缺失变量、最后语句为结果 |
| FVTT 兼容 | 归一化后的内部表达式和原始输入关系 | `SYNTAX_NORMALIZED` diagnostic、resolver trace、拒绝 trace | pool、`@path`、未实现 Foundry 能力拒绝均可序列化 |

#### Issue 拆解到文件和验收

每个上游 issue 的执行任务必须至少覆盖下列文件和验收点。若某列缺失，任务不得进入实现：

| Issue | 应当改动或核验的文件 | 应当固定的数据结构 | 应当锁定的控制流 | 必须提交的验收证据 |
| --- | --- | --- | --- | --- |
| #11 `d` 表达式形式化 | `README.md`、`src/ast/dice/d.ts`、`src/errors.ts`、`src/trace.ts`、`test/issues/issue-011-d-notation.test.ts` | `DNode` 归一化结构、modifier 互斥矩阵、dice trace item | 参数解析先于随机调用；冲突 modifier 在求值前失败 | 成功/失败样例、错误 `code/meta`、textarea range、高亮示例 |
| #10 COC 奖惩骰 | `src/ast/dice/p.ts`、`src/trace.ts`、`test/issues/issue-010-percentile-bonus-penalty.test.ts`、README 百分骰小节 | 百分骰候选、十位/个位随机调用、候选 selection | 生成所有候选后按最终百分值选取；不按裸十位排序 | 固定随机序列、候选 trace、`00+0=>100`、多奖惩边界 |
| #9 `d` 上限与预算 | `src/ast/dice/d.ts`、`src/evaluation/context.ts`、`src/config.ts`、`test/issues/issue-009-d-limits.test.ts` | `maxRandomCalls`、兼容 `maxRollCount`、预算错误 meta | 语义上限校验与运行预算校验分离；预算检查先于随机消耗 | `1d10000`/`10000d1` 合法、`10001d1` 参数错误、低预算随机错误 |
| #3 V2 草案 | `docs/decisions/*.md`、`utils/grammar.yaml`、`src/config.ts`、`src/ast/*`、`test/v1/*` | `RollFeatureFlags`、`RollValue`、feature-specific raw/trace | 默认拒绝 -> 显式启用 -> 专属求值 -> JSON-safe 输出 | 每个 flag 的默认拒绝、启用成功、非法输入、预算和序列化测试 |
| #5 `diro` 生态 | `docs/upstream-onedice-issues.md`、`docs/decisions/*`；触发跨实现对照时必须新增 `test/compat/*` | 静态 fixture、行为差异表、来源版本 | 只读对照数据；不得引入运行时 bridge 或 WASM 初始化 | 无 Node-only/Rust/WASM 依赖、pack 审计、差异必须有 ADR 或说明 |

#### 浏览器工程验收细节

浏览器目标必须落到包内容、构建输出、Node-only 扫描、同步预算、UI 数据、随机复现、兼容隔离、回滚边界、类型导出、框架接入、异常边界和发布回归十二个层面：

1. **包内容**：`npm.cmd pack --dry-run` 必须证明发布包只包含必要的 `dist`、类型声明、README、license 和 package 元数据；不得包含测试、临时 `.tgz`、生成脚本或源码私有草稿。
2. **构建输出**：ESM、CJS 和 types 必须同时可用；browser smoke 必须实际 import 构建产物，而不是只检查 TypeScript 能编译。
3. **Node-only 扫描**：浏览器 bundle 不得包含 `fs`、`path`、`os`、`crypto`、`process.`、`Buffer` 或动态加载 Node 模块的路径。
4. **同步预算**：所有可能放大求值成本的能力必须经过 `EvaluationContext` 预算；预算失败必须是结构化错误，不能依赖宿主页面超时。
5. **UI 高亮**：错误和 trace 的 `range` 必须使用原始输入坐标；兼容归一化或 `{env}` 展开必须标明子 trace 坐标来源，避免 UI 高亮错位。
6. **随机可复现**：测试和浏览器 demo 必须能注入随机源；trace 应当包含随机调用序号，使 UI 能够重放候选、保留/丢弃和循环行为。
7. **兼容隔离**：FVTT、program、tuple 和未来 V2 能力必须通过 `syntax` 或 `features` 显式启用；默认 `onedice` 模式不得因为兼容逻辑发生行为漂移。
8. **回滚边界**：每个 feature flag 应当能独立关闭；关闭后 parser 必须回到结构化拒绝，而不是落回普通 parse error。
9. **类型导出**：`dist/index.d.ts` 必须导出 `dice()`、`roll()`、`rollProgram()`、`RollResult`、`RollValue`、`RollTrace`、`RollDiagnostic`、`OneDiceError` 和配置类型；新增公开字段不得只存在于源码类型中。
10. **框架接入**：README 必须给出纯 TypeScript、Vite、React、Vue 四类最小接入片段；示例应当展示成功结果、`OneDiceError` 捕获、`diagnostics` 展示和确定性随机源注入。
11. **异常边界**：浏览器宿主应当能把同步调用包装成 `{ ok: true } | { ok: false }` 结果；公开错误不得携带函数、DOM 对象、宿主异常实例或无法 `structuredClone` 的字段。
12. **发布回归**：每次影响入口、类型、trace、diagnostic、feature flag 或构建配置的改动，都必须同时执行 `test:browser`、包内容审计和入口字段断言，避免 npm 包与本地源码行为不一致。

## Issue 到工程合同映射

每个上游 issue 都应当被展开为“接口入口、解析边界、求值语义、错误合同、trace/diagnostic、文档、测试、浏览器验收”八类产物。不得只记录 issue 摘要，也不得把开放讨论直接变成默认语法。

| Issue | 应当固化的工程问题 | 接口与配置 | 解析与 AST | 求值、错误与 trace | 验收产物 |
| --- | --- | --- | --- | --- | --- |
| #11 表达式形式化 | 普通 `d` 语法必须从压缩口诀变成可验证合同 | `dice()` 与 `roll()` 均保持 V1 输入；README 应当把 `[骰数]d[面数]`、骰池参数、选取线、奖惩数拆成独立槽位 | `DNode` 应当明确 `a/k/q/p/b` 的互斥矩阵；lexer/parser 应当把缺失骰数、缺失面数、互斥 modifier 和未知尾缀分成不同失败路径 | 非法组合必须抛稳定 `OneDiceError.code`，`meta` 至少包含 `operator`、`modifier`、`range`、`hint`；trace 应当显示原始投掷、保留/丢弃项、奖惩候选值 | `test/issues/issue-011-d-notation.test.ts`、README 语法表、浏览器错误展示示例 |
| #3 V2 草案 | V2 必须拆成可独立开关的能力族 | `Config.features` 应当为 tuple、clamp、program、conditionals、loop、FVTT 等能力提供显式入口；`dice()` 默认不得获得有状态语义 | 每个能力应当有独立 token、grammar 产生式或兼容 adapter；未启用时应当整体拒绝并填充 `meta.feature` | 所有新节点必须消费同一个 `RollValue` 与 `EvaluationContext`；不得绕过预算、变量快照、range 合成和 JSON-safe trace | ADR-004 到 ADR-009、默认拒绝矩阵、每个 feature 的启用成功测试、README feature flag 示例 |
| #10 奖惩骰 | COC 百分骰候选值选择必须符合上游已关闭规则 | `p/b` 继续由 V1 表达式入口使用，不新增浏览器专用 API | `PNode` 应当只负责解析奖惩数量，候选生成应当放入可测试纯函数或等价稳定路径 | 十位骰按 `00..90`，个位按 `0..9`；`00+0` 必须映射为 `100`；奖励选择最小候选，惩罚选择最大候选；trace 必须保留基础十位、个位、候选十位和最终候选 | 固定随机序列覆盖 `00+0=>100`、多奖励、多惩罚、边界候选；README 写明 COC 语义 |
| #9 `d` 上限 | `10000` 必须是骰数和面数的合法边界，同时浏览器不得被大输入拖死 | `Config.maxRandomCalls` 应当控制实际随机调用预算；旧 `maxRollCount` 应当继续映射到新预算名 | `DNode` 参数校验应当允许 `1d10000` 与 `10000d1`，拒绝 `10001d1`、`1d10001` 和非正整数 | 超过语义上限应当抛骰子参数错误；超过运行预算应当抛 `EVALUATION_BUDGET_EXCEEDED`，`meta.budgetKind='randomCalls'` | `test/issues/issue-009-d-limits.test.ts`、预算回归测试、README 边界和浏览器性能说明 |
| #5 Rust `diro` | Rust 生态只能作为行为参照，不得成为浏览器包依赖 | 不新增 WASM/Rust 初始化 API；浏览器入口不得加载二进制资源 | 仅在 fixtures 或文档中记录可对照行为；核心 parser 不得为了 Rust 实现改变 OneDice 语义 | 跨实现差异应当进入兼容表或 ADR，不得用运行时分支兼容；trace/error 合同仍以本仓库 TypeScript 实现为准 | `docs/upstream-onedice-issues.md` 记录来源；如引入对照样例，应当是静态 fixture 而不是构建依赖 |

上述映射是拆任务时的最低粒度。若某个 issue 只剩一句“实现某能力”，该任务不得进入实现队列；维护者必须先补齐受影响 API、默认拒绝行为、成功示例、失败示例、trace 形状和浏览器验收命令。

### Issue 任务必须展开到的技术合同

以下条目把上表从“方向”进一步展开为可直接拆 issue、写测试和评审 PR 的合同。任何任务缺少其中一类信息，都只能进入调研或 ADR，不得进入实现。

#### #11 `d` 表达式形式化

- **接口入口**：`dice()` 必须继续返回 `[number, DiceNode]`；`roll()` 必须返回同一输入的 `value/raw/trace/diagnostics`；新增错误码不得改变旧调用方捕获异常的方式。
- **解析边界**：lexer/parser 必须把 `d` 左值、右值、`a`、`k/q`、`p/b`、未知尾缀和输入结束分别定位；`2d20k1p1`、`2d20a8k1`、`1d`、`d0` 不得落入同一个泛化 parse error。
- **求值语义**：缺省骰数、缺省面数、保留/丢弃数量、奖惩骰数量和骰池阈值必须先归一化到内部结构，再消耗随机数；预算失败必须发生在第一次随机调用前。
- **错误合同**：`DICE_INVALID_DICE_COUNT`、`DICE_INVALID_FACE_COUNT`、`DICE_INVALID_KEEP_COUNT`、`DICE_INCOMPATIBLE_MODIFIERS`、`DICE_POOL_MODIFIER_EXCLUSIVE` 必须带 `range` 和面向 UI 的 `hint`。
- **trace/diagnostic**：普通 `d` trace 必须保留原始投掷顺序、`randomCall`、`selected/dropped`、modifier 类型和最终投影；文档化改动不得产生 non-fatal diagnostic，只有兼容归一化才进入 `diagnostics`。
- **文档与测试**：README 必须包含槽位表、互斥矩阵、成功示例、失败示例和浏览器错误捕获示例；`test/issues/issue-011-d-notation.test.ts` 必须锁定成功路径和结构化失败路径。
- **ADR 记录**：普通 `d` 的槽位、默认值、互斥矩阵、错误 `meta` 和浏览器 raw/trace 展示合同已经固化在 `docs/decisions/0010-d-expression-contract.md`。
- **浏览器验收**：错误 `meta.range` 必须能直接映射到 textarea selection；非法 modifier 的高亮范围必须指向冲突片段，不能只指向整条表达式。

#### #10 COC 奖惩骰规则

- **接口入口**：`p/b` 继续作为 V1 表达式能力存在，不新增浏览器专用 API，也不得要求调用方开启 feature flag。
- **解析边界**：`PNode` 只负责识别奖惩数量和模式；数量非法必须抛参数错误，不得进入随机流程后再失败。
- **求值语义**：十位候选必须按 `00,10,...,90` 生成，个位必须按 `0..9` 生成；`00+0` 必须映射为 `100`；奖励骰选择最终百分值最小的候选，惩罚骰选择最终百分值最大的候选。
- **错误合同**：奖惩数量非整数、负数或超过预算时必须抛 `OneDiceError`；`meta` 必须写明 `operator`、`actual`、`limit` 或 `budgetKind`。
- **trace/diagnostic**：trace 必须记录基础十位、个位、追加十位、所有候选百分值、被选中的候选和随机调用序号；奖惩骰不应产生 diagnostic，因为它是原生 V1 语义。
- **文档与测试**：确定性随机序列必须覆盖 `00+0=>100`、单奖励、单惩罚、多奖励、多惩罚和边界候选；README 必须说明不得只按十位做 `min/max`。
- **浏览器验收**：UI 必须能够根据 trace 展示候选列表，而不是解析 `DiceNode#toString()`。

#### #9 `d` 左右值上限与预算

- **接口入口**：旧 `maxRollCount` 必须继续可用；新预算字段应当以 `maxRandomCalls`、`maxEvaluationSteps`、`maxLoopIterations`、`maxLoopDepth` 为核心。
- **解析边界**：`1d10000`、`10000d1` 必须合法；`10001d1`、`1d10001`、`0d6`、`1d0` 必须在参数校验阶段失败，并给出语义上限错误。
- **求值语义**：语义上限与运行预算必须分离；`10000d1` 在默认预算下应当合法，降低 `maxRandomCalls` 时必须抛预算错误，而不是参数错误。
- **错误合同**：超过语义上限必须使用骰子参数错误；超过运行预算必须使用 `EVALUATION_BUDGET_EXCEEDED`，`meta.budgetKind='randomCalls'`。
- **trace/diagnostic**：预算失败不得留下部分成功的公开 trace；若未来加入 near-limit 诊断，必须先定义 diagnostic code、阈值和 README 展示方式。
- **文档与测试**：测试必须同时覆盖语义边界、预算边界和旧 `maxRollCount` 映射；README 必须解释“面数上限”和“随机调用预算”不是同一个概念。
- **浏览器验收**：大表达式失败时 UI 应当能提示减少骰数或提高预算，不得让同步求值卡死页面。

#### #3 V2 草案

- **接口入口**：V2 能力必须通过 `Config.features`、`rollProgram()` 或 `syntax: 'fvtt-compatible'` 进入；`dice()` 默认不得获得变量、多语句、循环或 FVTT 运行时语义。
- **解析边界**：未来 token 必须先作为整体 token 被识别并结构化拒绝；启用后才能进入专属 grammar 产生式、scanner 或兼容 adapter。
- **求值语义**：所有 V2 节点必须消费 `RollValue`，共享 `EvaluationContext`，并遵守随机调用、求值步数、循环次数和循环深度预算。
- **错误合同**：未启用能力必须抛 `PARSE_UNSUPPORTED_SYNTAX` 并带 `meta.feature`；启用后的参数错误必须使用能力专属错误码，不得回退到普通 parser message。
- **trace/diagnostic**：tuple、clamp、projection、slice、program、conditionals、loop、FVTT pool、FVTT success counting 都必须有专属 trace 或 diagnostic；generic trace 只能作为兜底。
- **文档与测试**：每个 feature flag 必须同时有默认拒绝测试、启用成功测试、非法输入测试、预算测试和 JSON 序列化测试。
- **浏览器验收**：影响公开类型、包入口、trace 或 diagnostic 的 V2 改动必须运行 `npm.cmd run test:browser` 和 `npm.cmd pack --dry-run`。

#### #5 Rust `diro` 生态参考

- **接口入口**：Rust/diro 只能作为文档或静态 fixture 来源，不得新增 WASM 初始化、Rust bridge、异步加载器或 Node-only 构建入口。
- **解析边界**：TypeScript parser 的 OneDice 语义必须由本仓库 grammar、ADR 和测试决定；不得为了适配某个外部实现而在运行时切换语法分支。
- **求值语义**：跨实现对照只能验证公开表达式的结果、错误或 trace 差异；差异必须进入兼容表或 ADR，再决定是否调整本仓库语义。
- **错误合同**：外部实现差异不得产生新的隐式 fallback；如果本仓库拒绝某输入，仍必须按 `OneDiceError.code/meta` 暴露。
- **trace/diagnostic**：compat fixture 不得要求浏览器包暴露 Rust 内部 trace；本仓库 trace 合同仍以 TypeScript AST 与 `RollValue` 为准。
- **文档与测试**：如引入对照样例，应当放在 `docs/` 或 `test/compat/` 的静态数据中，并记录来源、版本、表达式和预期差异。
- **浏览器验收**：pack dry-run 和 Vite smoke 必须证明发布包没有二进制资源、WASM 文件、Rust wrapper 或 Node-only polyfill。

## 文档口径与执行边界

本方案应当被当作后续实现、评审和发布的工作说明，而不是“想法池”。其中来自上游 issue 的内容应当按以下规则落地：

- **已关闭 issue** 应当被视为已接受规则，必须优先固化成确定性测试，再修正本仓库行为。
- **仍开放 issue** 应当被视为设计输入，必须先拆成 ADR、测试向量和 feature flag，再进入解析器实现。
- **浏览器使用** 应当是本仓库的主约束：任何语法扩展都必须评估并记录包体积、同步求值阻塞、错误提示可展示性、可复现随机数和移动端输入体验影响。
- **旧 API 兼容** 应当贯穿全部阶段：`dice()` 的返回形态不得被 V2 设计破坏，新的结构化能力应当通过增量 API 暴露。
- **文档、测试、实现** 应当成组推进：每个功能 PR 必须包含行为说明、确定性测试、失败用例和浏览器侧调用示例。

## 规范词

本方案是执行方案，不是想法清单。后续拆任务、写 PR、评审实现时应当按以下词义理解：

- **必须**：不满足则不能进入下一阶段，或不能合并相关改动。
- **应当**：默认执行方向；除非有明确反证或更高优先级约束，否则不应偏离。
- **触发条件**：当前阶段不强制执行；一旦任务满足文档写明的条件，就必须按对应合同交付。
- **不得**：会破坏兼容性、可维护性或浏览器目标，应当避免。

### 执行粒度要求

方案中的每一项能力都应当被拆成可直接进入 issue、PR 或测试文件的任务。任何只描述“提升体验”“补齐能力”“调整逻辑”的笼统表述，都必须在落地前补齐以下五个要素：

| 要素 | 必须写清的内容 | 不合格写法 | 合格写法 |
| --- | --- | --- | --- |
| 输入 | 表达式、配置、随机序列、环境变量 | “支持奖惩骰” | `roll('b1', { random: sequenceRandom([3,8,2]) })` |
| 输出 | `value`、`raw`、`trace`、`diagnostics` 或错误码 | “返回正确结果” | `value=23`，`trace.candidates=[83,23]` |
| 实现落点 | 需要修改的模块和公共类型 | “改 parser” | `utils/grammar.yaml`、`src/parser/*`、`src/ast/dice/d.ts` |
| 失败路径 | 非法输入如何失败 | “处理异常情况” | 抛 `DICE_INCOMPATIBLE_MODIFIERS` 并带 `meta.hint` |
| 验收 | 可运行的命令和断言 | “测试通过” | `npm.cmd test`，断言 `OneDiceError.code` |

后续文档和 PR 描述应当优先使用“必须/应当/不得”，不得把必做事项写成软性口吻。如果某个方向确实未定，应当使用“待 ADR 决定”，并写清阻塞它的具体问题、备选方案和不能提前实现的原因。

本轮修订后，方案正文不得再使用软性措辞作为任务口径。凡是已经来自上游关闭 issue、已创建 ADR、本仓库浏览器目标或公开 API 兼容约束的内容，都应当写成“必须/应当/不得”。如果某个内容仍无法写成执行要求，文档必须同时写明：

- **不明确点**：到底是语义未定、优先级未定、兼容范围未定，还是实现路径未定。
- **阻塞证据**：对应上游 issue、ADR 缺口、测试缺口或当前源码限制。
- **下一步产物**：应当补的 ADR、测试矩阵、feature flag、parser 失败合同或 README 示例。
- **暂缓边界**：在明确前 parser 应当如何拒绝输入，错误码和 `meta.feature` 应当如何暴露给浏览器 UI。

### 软性措辞替换规则

文档维护时必须把软性表述改写成可执行要求，不能只做同义词替换。改写规则如下：

| 原始口径 | 应当改写为 | 需要补充的技术细节 |
| --- | --- | --- |
| “支持某语法” | “应当在某 feature flag 下支持该语法” | flag 名称、默认拒绝错误、grammar 产生式、AST 节点、trace kind |
| “优化错误提示” | “应当抛指定 `OneDiceError.code` 并填充指定 `meta` 字段” | `range`、`actual`、`expected`、`feature`、`hint` |
| “兼容 FVTT” | “应当新增显式 `syntax: 'fvtt-compatible'` 模式” | 默认模式拒绝合同、兼容模式 resolver、归一化 diagnostic |
| “提升浏览器体验” | “应当满足浏览器工程验收矩阵” | ESM/CJS/types、无 Node-only 依赖、预算、JSON-safe trace |
| “后续考虑” | “待 ADR 决定，当前 parser 应当拒绝” | ADR 编号或缺口、阻塞问题、临时错误码和 `meta.feature` |

每次更新本方案后都必须执行一次措辞检查，检查对象应当覆盖所有软性口吻词。若命中项是引用上游原文，应当在同段写明“本仓库执行口径”；若命中项是本方案任务描述，必须改成“应当/必须/不得”并补齐验收条件。

### 强制化改写审计

本方案中的任务描述不得停留在“可以、考虑、优化、完善、笼统支持、后续”等软性措辞。维护者在拆 issue、写 PR 或更新本文档时，必须按下表把软性表达改写成硬性执行合同：

| 软性表达 | 必须改写为 | 必须展开的技术细节 | 验收证据 |
| --- | --- | --- | --- |
| “实现 X”但未写约束 | “应当实现 X”或“待 ADR 决定，当前不得实现 X” | X 的 feature flag、默认拒绝错误码、启用入口、受影响 API | 对应测试文件、ADR 或 README 小节 |
| “可以支持 X” | “在满足前置条件后应当支持 X” | 前置条件、parser 入口、AST 节点、`RollValue` 投影规则 | 默认拒绝测试 + 启用成功测试 |
| “考虑兼容 X” | “应当通过显式模式兼容 X” | `syntax` 取值、兼容 adapter、归一化 diagnostic、默认模式拒绝合同 | `syntax: 'onedice'` 与兼容模式成对测试 |
| “优化错误提示” | “必须抛稳定 `OneDiceError.code` 并填充 `meta`” | `range`、`actual`、`expected`、`operator`、`feature`、`hint` | 错误测试不得断言完整 message，只断言 code/meta |
| “提升浏览器体验” | “必须满足浏览器验收矩阵” | ESM/CJS/types、无 Node-only 依赖、预算、JSON-safe trace、textarea range | `npm.cmd run test:browser`、`npm.cmd pack --dry-run` |
| “后续完善” | “应当进入指定里程碑或暂缓列表” | 里程碑编号、阻塞 ADR、当前 parser 拒绝行为、临时 `meta.feature` | 里程碑表、拒绝测试、未实现能力清单 |

如果某句话无法被改写为“应当/必须/不得”，说明它还不是工程任务。此时文档必须把它降级为“待 ADR 决定”，并补齐四项信息：未定语义、阻塞证据、候选方案、当前拒绝策略。不得把不明确内容留在实施章节中，也不得让实现者凭偏好提前写代码。

### 概括性内容展开规则

任何概括性任务都必须展开到“接口、解析、求值、错误、trace、文档、测试、浏览器验收”八个层面。缺少任一层时，该任务只能进入调研或 ADR，不得进入实现。

| 层面 | 必须写清 | OneDice 示例 |
| --- | --- | --- |
| 接口 | 调用方通过哪个 API 或配置启用能力 | `roll(input, { features: { tupleOperators: true } })` |
| 解析 | lexer token、grammar 产生式、默认拒绝路径 | `kh` 作为整体 token；未启用时抛 `PARSE_UNSUPPORTED_SYNTAX` |
| 求值 | 节点如何消费 `RollValue`，是否消耗随机数或预算 | `TupleSelectionNode` 读取左侧 tuple，不重新求值左侧表达式 |
| 错误 | 非法输入对应的稳定错误码和 `meta` | `DICE_INVALID_KEEP_COUNT`，包含 `operator/count/inputLength/range` |
| trace | `trace.kind`、子 trace、range 和随机调用顺序 | `tuple-selection` 保留 `selectedIndexes`、`droppedIndexes` |
| 诊断 | 是否需要 non-fatal diagnostic | FVTT 归一化必须产生 `SYNTAX_NORMALIZED` |
| 文档 | README 是否要给成功、失败、兼容边界示例 | FVTT 示例必须与默认 OneDice 示例分开 |
| 验收 | 必跑命令和最小断言 | `npm.cmd test`、`npm.cmd run typecheck`、影响浏览器时跑 browser smoke |

展开后的任务应当能直接转成测试文件名、PR 标题和实现文件列表。例如“兼容 FVTT 池”不得只写成一句话；它必须拆成 `M10a` 默认拒绝、`M10b` 池 lexer、`M10c` adapter、`M10d` resolver、`M10e` 浏览器文档与 smoke，每一步都要有独立通过/失败标准。

### 实施级技术展开清单

为了让方案能够直接指导后续开发，来自 issue 的每个能力都必须继续展开为“文件落点 + 数据结构 + 控制流 + 验收证据”。下列清单是拆任务和评审 PR 时的最低技术颗粒度；缺少任一项时，任务不得进入实现。

| Issue / 能力 | 应当改动或核验的文件 | 应当固定的数据结构 | 应当锁定的控制流 | 应当提交的验收证据 |
| --- | --- | --- | --- | --- |
| #11 `d` 表达式形式化 | `README.md`、`src/ast/dice/d.ts`、`src/errors.ts`、`test/issues/issue-011-d-notation.test.ts` | `DNode` 内部参数必须拆成骰数、面数、骰池、选取线、奖惩骰和源码 range；错误 `meta` 必须带 `operator/modifier/range/hint` | parser 只生成 AST；参数归一化、互斥校验、预算检查和 trace 组装必须按固定顺序执行 | README 槽位表、互斥矩阵、成功/失败示例；测试覆盖缺省值、非法面数、非法骰数、互斥 modifier、浏览器 range |
| #9 `d` 上限与预算 | `src/config.ts`、`src/evaluation/context.ts`、`src/ast/dice/*.ts`、`test/issues/issue-009-d-limits.test.ts` | `EvaluationBudget.maxRandomCalls` 是实际随机调用预算；旧 `maxRollCount` 必须映射到该预算；语义上限仍为 `10000` | 参数上限校验必须与运行预算校验分离；随机调用只能通过预算随机源进入；预算失败不得留下部分公开 trace | `1d10000`、`10000d1` 成功；`10001d1`、`1d10001` 语义失败；低预算抛 `EVALUATION_BUDGET_EXCEEDED` 且 `budgetKind='randomCalls'` |
| #10 COC 奖惩骰 | `src/ast/dice/p.ts`、`src/trace.ts`、`test/issues/issue-010-percentile-bonus-penalty.test.ts`、README 百分骰说明 | 百分骰候选必须记录基础十位、个位、追加十位、候选值、选中候选和随机调用序号 | 先投基础十位和个位，再投追加十位；`00+0` 必须映射为 `100`；奖励选最终值最小候选，惩罚选最终值最大候选 | 固定随机序列覆盖 `00+0=>100`、单奖励、单惩罚、多奖励、多惩罚、边界候选；trace 不得要求 UI 解析 `toString()` |
| #3 元组与 V2 运算符 | `utils/grammar.yaml`、`src/parser/*`、`src/ast/tuple*.ts`、`src/ast/clamp.ts`、`src/evaluation/value.ts`、相关 ADR | `RollValue` 必须表达 scalar、literal tuple、dice-roll tuple、operator tuple、projection；每个节点必须有专属 trace kind | 未开 feature 时 lexer 必须整体识别并结构化拒绝；开启后 parser 才能进入对应 AST；左侧表达式不得被 tuple operator 二次求值 | 每个 feature 同时具备默认拒绝、启用成功、非法输入、JSON-safe trace 和 README feature flag 覆盖测试 |
| #3 program / 变量 / 条件 / 循环 | `src/program.ts`、`src/ast/variable.ts`、`src/ast/conditionals.ts`、`src/ast/loop.ts`、`src/evaluation/context.ts` | program statement、变量快照、局部 `i`、循环边界、求值步数和循环深度必须进入 `EvaluationContext` | `rollProgram()` 内部开启 program 语义；普通 `dice()` / `roll()` 必须继续拒绝 `$`、`;`；三目只求值被选分支；循环体每轮恢复外层变量表 | statement range、变量覆盖、缺失变量、三目短路、循环预算、循环深度和变量不泄漏测试 |
| #3 / FVTT 兼容 | `src/parser/fvtt-normalize.ts`、`src/parser/fvtt-success-count.ts`、`src/ast/success-count.ts`、`src/evaluation/context.ts`、ADR-006、ADR-009 | `SYNTAX_NORMALIZED` diagnostic 必须记录原始片段、归一化片段、feature、range；resolver context 必须记录 path、range、syntax、originalInput | `syntax: 'fvtt-compatible'` 只能启用已实现 adapter；默认模式必须拒绝 FVTT 池、`@path`、FVTT-only modifier；兼容模式不得访问 `window.game` 或异步宿主对象 | 默认模式/兼容模式成对测试；Vite smoke 执行 FVTT pool、`@path`、带目标值 `cs`、未实现 Foundry 能力拒绝路径 |
| #5 Rust `diro` 生态 | `docs/upstream-onedice-issues.md`、`docs/decisions/*`、`test/compat/` 或文档附录 | 跨实现 fixture 只能记录表达式、输入配置、预期值、错误码或 trace 差异；不得引入 Rust 内部结构 | 浏览器核心包不得新增 WASM 初始化、二进制加载、Node-only 构建步骤或运行时语言桥接 | pack 审计不得包含 `.wasm`、native addon、Rust wrapper；行为差异必须进入兼容表或 ADR 后再影响语义 |

每个条目拆成 PR 时，都必须把“成功路径”和“拒绝路径”作为同一任务的两面处理。只实现成功表达式而没有默认拒绝、错误码、range 和预算测试，视为未完成。

#### 技术合同字段要求

单项任务的正文必须包含以下字段，且字段内容必须足够让另一名维护者在不阅读 issue 原文的情况下实现和验收：

| 字段 | 必须写清的内容 | 不得省略的细节 |
| --- | --- | --- |
| 来源 | 上游 issue 编号、ADR 编号、本地浏览器目标或兼容性风险 | issue 当前状态、关闭/开放口径、是否允许默认启用 |
| 启用入口 | `dice()`、`roll()`、`rollProgram()`、`syntax`、`features`、`env`、`resolver` 中的具体入口 | 默认模式的失败行为和开启后的成功行为必须成对出现 |
| 语法边界 | lexer token、兼容 scanner、grammar 产生式、优先级和歧义处理 | 是否修改 `utils/grammar.yaml`，是否需要重新生成 parser 表 |
| AST 边界 | 新节点类名、子节点顺序、`range` 合成、`toString()` 兼容 | 不得把新语义塞进 `SimpleNode`、字符串预处理或匿名 fallback |
| 求值边界 | `RollValue` 输入输出、投影模式、随机调用、预算消耗、变量快照 | 是否会重新求值左侧表达式、是否共享 `EvaluationContext` |
| 错误边界 | 每条失败路径的 `OneDiceError.code`、`meta`、`range`、`hint` | 测试必须断言 `code/meta`，不得只断言 message |
| trace 边界 | `trace.kind`、子 trace 顺序、随机调用序号、selected/dropped/success indexes | `raw/trace/diagnostics` 必须 JSON-safe，不得包含函数或循环引用 |
| 文档边界 | README 示例、ADR 链接、暂缓能力清单、浏览器 UI 捕获路径 | 成功示例、失败示例和兼容边界必须同时存在 |
| 验收边界 | 单元测试、typecheck、browser smoke、build、pack dry-run | 影响公开类型、包入口、trace 或 diagnostic 时必须运行浏览器验收 |

#### 浏览器侧数据合同

浏览器 UI 应当只消费结构化数据，不得解析错误字符串或 `DiceNode#toString()`。公开结果和异常必须满足：

```ts
type BrowserRollOutcome =
  | {
      ok: true
      input: string
      value: number
      raw: RollValue
      trace: RollTrace
      diagnostics: RollDiagnostic[]
    }
  | {
      ok: false
      input: string
      code: OneDiceErrorCode
      message: string
      meta: OneDiceErrorMeta
    }
```

UI 高亮逻辑应当只依赖 `meta.range` 或 `trace.range`。如果某个错误暂时无法给出精确 range，任务必须写明原因、最小可用范围和后续补齐条件；不得让浏览器只能展示整条表达式错误。

#### 测试命名和断言粒度

测试文件和断言必须反映语义，不得只反映表达式文本：

| 语义 | 测试命名应当表达 | 必须断言 |
| --- | --- | --- |
| 缺省 `d` 槽位 | `uses implicit dice and face defaults` | `value`、`raw.source`、`trace.range` |
| modifier 互斥 | `rejects pool modifier combined with keep modifier` | `DICE_POOL_MODIFIER_EXCLUSIVE`、冲突 modifier range、hint |
| 预算耗尽 | `stops before exceeding random-call budget` | `EVALUATION_BUDGET_EXCEEDED`、`budgetKind='randomCalls'`、无部分 trace 泄漏 |
| COC 百分骰边界 | `maps zero tens and zero ones to one hundred` | `value=100`、候选 trace、随机调用序号 |
| FVTT 归一化 | `normalizes fvtt dice pool only in compatibility mode` | `SYNTAX_NORMALIZED`、默认模式拒绝、兼容模式成功 |
| 未实现 Foundry 能力 | `rejects runtime bindings without resolver side effects` | `PARSE_UNSUPPORTED_SYNTAX`、具体 `meta.feature`、resolver 未被调用 |

任何新增能力都应当至少包含一个近邻反例，证明新 token 不会破坏旧语法。例如实现 `df` 时必须同时覆盖 `4df`、`4f` 和 `1dfoo`；实现 `kh` 时必须同时覆盖 `2d20kh1` 和旧 `2d20k1`。

#### 预算、错误与 trace 硬性字段矩阵

预算、错误与 trace 是浏览器调用方最容易依赖的公开合同，任务拆分时必须把三者写在同一张验收表里，不得只写“结果正确”。任何影响随机数、循环、变量、tuple 或 FVTT adapter 的改动，都必须按下表补齐字段。

| 能力范围 | 预算字段 | 失败错误码与 `meta` | trace / raw 必填字段 | 浏览器验收 |
| --- | --- | --- | --- | --- |
| 普通 `d` | `maxRandomCalls` 控制随机调用；语义上限 `10000` 不等于预算 | 参数越界使用 `DICE_INVALID_DICE_COUNT` 或 `DICE_INVALID_FACE_COUNT`，预算耗尽使用 `EVALUATION_BUDGET_EXCEEDED` 与 `budgetKind='randomCalls'` | `raw.kind='tuple'` 或等价 dice-roll 结构；trace 保留投掷顺序、每项 `randomCall`、`selected/dropped` | `1d10000`、`10000d1` 成功；低预算失败且页面不会同步卡死 |
| `a/c/f/p` 等骰子节点 | 所有随机调用都必须经同一个 `EvaluationContext`；旧 `maxRollCount` 只能作为兼容入口 | 语义错误必须使用节点专属错误码；预算错误不得继续使用语义错误码伪装 | trace 必须保留节点类型、输入 range、随机调用序号和公开投影值 | 固定随机序列下 `value/raw/trace` 稳定，且多个节点的 `randomCall` 全局连续 |
| tuple 与 V2 operator | `maxEvaluationSteps` 约束复杂求值；tuple operator 不得重复求值左侧 | 未启用时 `PARSE_UNSUPPORTED_SYNTAX` + `meta.feature`；启用后参数错用专属错误码 | `raw.kind='tuple'`、`source`、`items`、`projection`；trace 使用 `tuple-*` 或具体 operator kind | 默认拒绝和启用成功成对测试；`JSON.stringify(result)` 必须成功 |
| program / variable / conditionals | statement 共享预算；三目未选分支不得消耗预算；循环受深度和次数控制 | 缺失变量使用 `VARIABLE_NOT_FOUND`；循环边界错使用 loop 专属错误码；预算错统一 `EVALUATION_BUDGET_EXCEEDED` | statement range、变量快照、`selectedBranch`、loop `iterations`、局部 `i` | `rollProgram()` 成功；普通 `dice()` / `roll()` 继续拒绝 `$` 与 `;` |
| FVTT adapter | adapter 不得访问网络、异步宿主状态或 Foundry runtime；resolver 必须同步 | 默认模式拒绝 FVTT 语法；resolver 缺失/非数值/抛错分别使用稳定变量错误码 | `SYNTAX_NORMALIZED` diagnostic 记录 `original`、`normalized`、`feature`、`range`；trace 复用核心节点 | 默认模式、兼容模式、未实现 Foundry 能力三套路径必须成对测试 |
| 发布包与浏览器 smoke | 包入口不得引入运行预算之外的全局副作用 | 发现 Node-only 依赖、WASM、native addon 或临时包内容时视为发布失败 | smoke 输出必须覆盖成功结果、错误对象和 diagnostics 序列化 | `npm.cmd run test:browser` 与 `npm.cmd pack --dry-run` 必须通过 |

验收用例必须同时断言“没有发生不该发生的事”：未选三目分支不得投骰，FVTT runtime binding 不得调用 resolver，tuple operator 不得二次求值左侧，pack dry-run 不得包含源码、测试、临时 tarball 或二进制运行时。

### 任务说明模板

从本方案拆出的 issue 或 PR 描述必须按以下模板填写。缺失字段必须在实现前补齐，不能让实现者从上下文中猜测。

```markdown
## 目标
应当实现或固化的单一行为，必须写明对应上游 issue 或 ADR。

## 启用入口
- API：`dice()`、`roll()`、`rollProgram()` 或兼容 adapter。
- 配置：`syntax`、`features`、`env`、`resolver`、预算字段。
- 默认模式：未开启能力时必须抛出的错误码和 `meta.feature`。

## 解析合同
- lexer token 或兼容 scanner 规则。
- grammar 产生式或不得修改 grammar 的理由。
- AST 节点名称、源码 `range` 合成规则、与旧 token 的歧义处理。

## 求值合同
- 节点输入的 `RollValue` 形态：scalar、tuple、dice-roll tuple 或 operator tuple。
- 是否消耗随机数、求值步数、循环预算或变量快照。
- 旧 `dice()` 数值投影规则和 `roll().raw` 结构。

## 错误与诊断
- 所有失败路径的 `OneDiceError.code`。
- `meta` 字段：`range`、`actual`、`expected`、`operator`、`feature`、`hint`。
- 是否产生 `RollDiagnostic`，以及 diagnostic 是否影响数值结果。

## Trace
- `trace.kind`、必填字段、子 trace 排列顺序。
- 随机调用序号、selected/dropped/success/failure indexes。
- `JSON.stringify(result)` 必须成功。

## 验收
- 单元测试文件和最小断言。
- README 或 docs 示例。
- 影响浏览器时必须运行 `npm.cmd run test:browser` 和 `npm.cmd pack --dry-run`。
```

## 总体目标

本仓库应当从一个“能解析部分 OneDice 表达式的 TypeScript 小库”，演进为一个适合浏览器应用嵌入的 OneDice 核心：

1. **V1 行为应当可验证**：所有当前支持的语法都应当有确定性测试，尤其是上游已关闭议题 #9、#10。
2. **浏览器集成应当顺手**：包应当提供 ESM 入口、类型声明、可复现随机数配置、结构化错误和 UI 友好的结果追踪。
3. **V2 扩展应当分层推进**：不得把 #3 的所有讨论一次性塞进语法；应当先建设元组值模型，再逐步实现元组运算符、变量、多语句和 FVTT 兼容。
4. **标准兼容应当优先于炫技**：关闭的上游决议应当优先实现；开放的上游讨论应当先写设计说明和测试，再进入实现。
5. **旧 API 应当稳定**：`dice(input, config): [number, DiceNode]` 必须继续可用，新能力应当通过增量 API 暴露。

### 浏览器目标形态

面向浏览器时，本仓库应当支持三类调用场景：

| 场景 | 调用方需要 | 本仓库应当提供 |
| --- | --- | --- |
| 普通网页/React/Vue 应用 | 直接 import、体积小、类型清晰 | ESM 输出、`.d.ts`、无 Node-only 依赖、可 tree-shake |
| 掷骰 UI/聊天机器人前端 | 展示每个骰子的过程和错误提示 | `roll()`、结构化 trace、稳定错误码、错误 `hint` |
| 回放/测试/分享链接 | 相同输入得到可复现结果 | 可注入 `random`、序列化 trace、显式求值预算 |

浏览器核心不得默认依赖文件系统、Node 全局对象、WASM 或运行时动态加载。若未来需要 Worker、WASM 或 Rust 版本，应当作为独立适配层和独立 ADR 处理。

### 浏览器工程验收口径

浏览器目标必须落到包、运行时、错误和 UI 数据四层，不得停留在“能在浏览器 import”的概括描述：

| 层 | 必须交付 | 技术细节 | 验收方式 |
| --- | --- | --- | --- |
| 包入口 | ESM、CJS、`.d.ts` 和 `exports` | `exports.import`、`exports.require`、`types` 必须指向构建产物；`files` 必须排除测试和源码生成脚本 | `npm.cmd pack --dry-run` 审计 tarball 文件列表 |
| 运行时 | 无 Node-only 依赖 | 浏览器入口不得直接引用 `fs`、`path`、`process`、`Buffer`、`crypto`；不得在顶层读取环境变量或注册全局状态 | Vite/browser fixture 真实打包并运行 |
| 随机源 | 可复现且可审计 | 所有随机数必须通过 `EvaluationContext.random.nextInt()`；trace 必须记录连续 `randomCall` 序号 | 固定 `sequenceRandom()` 后断言 `value`、`raw`、`trace` 完全稳定 |
| 预算 | 防止 UI 卡死 | `maxRandomCalls`、`maxEvaluationSteps`、`maxLoopIterations`、`maxLoopDepth` 必须在进入高成本操作前检查 | 超限必须抛 `EVALUATION_BUDGET_EXCEEDED`，并带 `budgetKind` |
| 错误 | 可直接展示 | 用户可触达错误必须是 `OneDiceError`；`meta.range` 必须可映射到 textarea selection | parser/runtime 错误测试断言 `code`、`range`、`hint` |
| trace | 可序列化 | `raw`、`trace`、`diagnostics` 不得包含类实例、函数、循环引用或非稳定字段 | `JSON.stringify(result)` 必须成功 |
| 移动端输入 | 默认语法稳定 | `$`、`@`、`{}`、`;` 等易冲突符号必须由模式/feature flag 隔离 | 默认模式拒绝测试和兼容模式接受测试成对存在 |

浏览器接入示例必须覆盖成功、失败和回放三条路径：成功路径读取 `result.value/raw/trace`；失败路径按 `OneDiceError.code` 分支；回放路径传入同一随机序列并断言 trace 一致。README 中不得只展示 `console.log(dice('1d6'))` 这种旧 API 示例。

### 非目标

第一阶段不得把 OneDice V2 做成“通用脚本语言”。本仓库应当先成为稳定、可测、可嵌入的骰子表达式核心；图灵完备、复杂 Foundry 兼容、递归重骰、爆骰、成功计数和完整角色卡数据绑定都应当在 V1 基线、错误模型、预算模型、元组模型稳定之后再拆分推进。

## 当前状态判断

### 代码结构

当前源码结构较小，分层清晰：

```text
src/
  index.ts              当前公开入口，导出 dice()
  utils.ts              random/fill/sum 等工具
  parser/
    lexer.ts            词法分析
    parser.ts           语法表驱动解析
    grammar.json        生成后的语法定义
    table.json          生成后的分析表
  ast/
    index.ts            AST resolve 逻辑
    simple.ts           + - * / ^ 等二元运算
    unary.ts            一元 +/-
    bracket.ts          小括号节点
    interpolation.ts    {env} 插值
    number.ts           数字节点
    dice/
      d.ts              普通多面骰
      p.ts              奖惩骰
      a.ts              无限加骰池
      c.ts              双重十字加骰池
      f.ts              FATE/Fudge
utils/
  grammar.yaml          语法源文件
  generator.ts          语法表生成器
```

当前公开 API：

```ts
export function dice(input: string, config: Config = {}): [number, DiceNode]
```

当前 `Config` 已经具备三个对浏览器很重要的能力：

- `random?: (min: number, max: number) => number`
- `maxRollCount?: number`
- `maxRandomCalls?: number`

这意味着浏览器 UI、测试环境和回放系统都能够注入可复现随机数，不必依赖全局 `Math.random()`；同时应当通过 `maxRandomCalls` 显式控制运行时随机调用预算，并保留 `maxRollCount` 旧配置入口。

### 当前语法状态

默认公开语法应当被视为 V1 基线子集。以下能力在 `syntax: 'onedice'` 且未显式开启 feature flag 时必须保持稳定：

- 初等算术：`+`、`-`、`*`、`x`、`/`、`^`
- 小括号：`(...)`
- 数字和 `{env}` 插值
- 普通多面骰：`d`
- 选取线：`k`、`q`
- 奖惩骰：`p`、`b`
- 无限加骰池：`a`
- 双重十字加骰池：`c`
- FATE 骰：`f`

已经进入本地实现或阶段性验证的 V2 能力，不得被描述为默认语法。它们应当继续通过 feature flag 隔离，并在 README 中明确写出开启方式：

| 能力 | 当前状态 | 默认模式要求 | 开启入口 | 必须保留的兼容合同 |
| --- | --- | --- | --- | --- |
| 显式元组 `[]` | 已有本地实现和测试 | 未开启时 `[`、`]`、`,` 必须抛 `PARSE_UNSUPPORTED_SYNTAX` | `features.tupleLiterals` | `dice('[1,2,3]')` 默认不得静默变成合法输入 |
| `kh/kl/dh/dl` | 已有本地实现和测试 | 未开启时多字符 token 必须整体拒绝 | `features.tupleOperators` | V1 `2d20k1` 的 `DNode` modifier 语义不得改变 |
| `min/max` | 已有本地实现和测试 | 未开启时必须整体拒绝 | `features.clampOperators` | OneDice 语义必须保持 `5min6=6`、`7max6=6` |
| `tp` | 已有本地实现和测试 | 未开启时必须整体拒绝 | `features.tupleProjection` | `dice('3d100tp')` 必须仍返回 number，`roll().raw` 暴露 tuple |
| `sp` | 已有本地实现和测试 | 未开启时必须整体拒绝 | `features.tupleSlice` | 必须遵守 ADR-007 的 1 基索引和步进区间合同 |
| `rollProgram()` 多语句/变量 | M9a/M9b 已有本地实现和测试 | `dice()` / `roll()` 默认必须继续拒绝 `$` 和 `;` | `rollProgram()` 内部开启 `features.program` | `$0/$t` 变量必须保存完整 `RollValue`，旧 API 不得获得有状态语义 |
| 比较、布尔和三目 | M9c 已有本地实现和测试 | 未开启时 `>`、`<`、`=`、`&`、`|`、`?`、`:` 必须整体拒绝 | `features.conditionals` | 三目必须短路，未选分支不得消耗随机数、写变量或产生运行时错误 |
| `lp` 循环 | M9d 已有本地实现和测试 | 未开启时 `lp` 必须整体拒绝 | `features.loopOperator` | 循环必须遵守 ADR-008，局部 `i` 不得泄漏，预算超限必须抛 `EVALUATION_BUDGET_EXCEEDED` |
| `df` FATE alias | 已有本地实现和测试 | 未开启时 `df` 必须继续抛 `PARSE_UNSUPPORTED_SYNTAX` | `features.fateAlias` | 启用后必须归一化为 `f`，产生 `SYNTAX_NORMALIZED`，并复用 FATE trace 与预算 |
| FVTT `cs` 成功计数 | M10f 已有本地实现和测试 | 默认模式和未启用 flag 时必须拒绝 | `syntax: 'fvtt-compatible'` + `features.fvttSuccessCounting` | 必须遵守 ADR-009，只接受带目标值的 success counting 子集 |

仍未实现或仍待 ADR 固化的能力，应当在 lexer、兼容 scanner 或 parser 早期被识别为未来语法，并通过结构化错误拒绝。它们不得以普通 parse error、字符串预处理、隐式兼容或 fallback 数值进入默认语法：

| 未实现/暂缓能力 | 来源 | 默认模式应当如何拒绝 | 兼容/启用模式应当如何拒绝 | 后续进入实现前必须补齐 |
| --- | --- | --- | --- | --- |
| `!` 逻辑非或阶乘 | #3 同时出现控制运算和阶乘讨论，语义冲突 | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='factorialOrNotOperator'`，`range` 指向 `!` | 在 ADR 明确前仍必须拒绝，不得临时按 JS truthy/falsy 解释 | ADR：区分逻辑非、阶乘和 parser 优先级；测试：`!1`、`5!`、`(1=1)!` |
| `X?` 阶加/step-sum | #3 仅有简短提案 | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='stepSumOperator'` | 在 ADR 明确前必须拒绝，不能与三目 `? :` 冲突 | ADR：前缀/后缀位置、与三目 `?` 的词法歧义、trace 形态 |
| FVTT 爆骰 `x`/`xo`/`x>=N` | FVTT dice modifiers | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='fvttExplode'`，`operator` 指向 `x/xo` | `syntax: 'fvtt-compatible'` 也必须结构化拒绝，直到预算和递归边界固化 | ADR 或测试矩阵：最大爆骰次数、递归/非递归、比较目标、预算 `budgetKind` |
| FVTT 重骰 `r`/`rr`/`r<2` | FVTT dice modifiers | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='fvttReroll'`，不得误报为 conditionals | 兼容模式必须结构化拒绝，不得把 `r` 当普通未知 token | ADR 或测试矩阵：单次/递归重骰、保留原值还是替换、预算和 trace |
| FVTT 无目标 `cs`、失败计数 `cf` | ADR-009 明确只接受带目标值 `cs` 子集 | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='fvttSuccessCounting'` 或 `fvttFailureCounting` | 未带目标值时必须拒绝；`cf` 在实现前必须拒绝 | ADR：默认目标值、成功/失败比较符、tuple 输入、trace indexes |
| FVTT roll mode、actor/item/UUID/Compendium 深绑定、副作用路径 | Foundry 运行时语义 | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='fvttRuntimeBinding'` | 兼容模式不得访问 `window.game`、actor、item、document collection 或异步数据源 | 独立适配层设计，不得进入浏览器核心包 |
| 多变量标记别名 `$0` 与 `@0` 同时默认启用 | #3 移动端输入争议 | 默认不得把两者视为等价 | 只有 `syntax` 或 `features.variableAliases` 明确开启时才能接受，并必须产生 warning diagnostic | ADR：符号占用、移动端输入、兼容迁移和 README 分流 |
| 非骰表达式 FVTT 池 `{attack,bonus}` | 与 OneDice `{env}` 插值冲突 | 不得仅因逗号破坏旧 env key 合同 | 只有兼容 grammar 明确支持非骰表达式池时才接受 | 解析策略：如何区分 env key、dice pool、普通 tuple；失败 range 合同 |

### 当前已补齐的基础能力

截至 2026-07-24，本地仓库已经补齐第一批浏览器化基础能力：

1. **测试与构建入口已经建立**
   - `package.json` 已经包含 `test`、`test:watch`、`typecheck`、`build`、`test:browser`。
   - `test/helpers/random.ts` 已经提供确定性随机数 helper。
   - `test/v1/` 已经覆盖算术、`d`、`p/b` 和初版 trace。
   - `test/issues/` 已经覆盖 #9、#10、#11 对应回归测试。

2. **浏览器包形态已经进入可验证状态**
   - `package.json` 已经指向 `dist/index.cjs`、`dist/index.mjs`、`dist/index.d.ts`。
   - `exports`、`module`、`types`、`files` 已经存在。
   - `tsup.config.ts` 与 `test/browser/vite-import.test.ts` 已经建立浏览器打包验证路径。

3. **V1 上游已关闭决议已经有实现入口**
   - #9 的 `d` 左右值上限与 `maxRollCount` 边界已经有测试。
   - #10 的 COC 奖惩骰边界已经有测试。
   - `/` 整数除法已经按 V1 标准修正为截断语义。

4. **结构化错误和 trace 已经有初版**
   - `src/errors.ts` 已经提供 `OneDiceError` 与关键 `DICE_*` 错误码。
   - `src/trace.ts` 已经提供 `roll()` 所需的初版 `RollResult`、`RollTrace`、`RollDiagnostic`。
   - 当前 trace 已覆盖 number、unary、binary、group、interpolation、dice、percentile、fate、pool 等 V1 主路径；generic fallback 只能作为兜底，不得继续承担关键路径。
   - `src/evaluation/value.ts` 已经提供 `RollValue` 与 `projectToNumber()` 初版，普通 `d` 掷骰已经能够在 `roll().raw` 中暴露骰子元组。
   - `src/evaluation/context.ts` 已经提供 `EvaluationContext` 初版，随机调用预算已经集中到预算随机源。

### 当前完成证据与剩余高风险队列

截至 2026-07-24，第一阶段不应再被描述为“trace 初版”或“错误模型初版”。当前工作树已经建立 `roll()`、`RollValue`、`EvaluationContext`、结构化错误、专属 trace、JSON-safe 序列化、显式 feature flag、FVTT 兼容子集和浏览器打包守卫。后续执行计划时必须把注意力放在“防回退”和“未实现能力隔离”上，而不是重复实现已经完成的主路径。

| 领域 | 当前已经完成的证据 | 后续仍必须守住的边界 | 验收入口 |
| --- | --- | --- | --- |
| Trace / raw | V1 arithmetic/group/number/dice/percentile/fate/pool/interpolation、tuple、selection、clamp、projection、slice、conditionals、loop、FVTT pool、FVTT `cs` 和 `rollProgram()` 已有专属 raw/trace 或公开结果序列化测试 | 新增节点不得回退到 `kind='generic'`；`range` 必须继续映射到原始输入或明确标注子表达式坐标来源；随机调用序号必须来自共享 `EvaluationContext` | `npm.cmd test -- test/v1/roll-trace.test.ts test/v1/json-serialization.test.ts` |
| 错误模型 | `OneDiceError` 已覆盖 parser、V1 dice、tuple、program、loop、FVTT resolver 和预算错误；README 错误表由测试锁定；普通运行时 `throw new Error` 已有防回退扫描 | 新增用户可触达失败必须先定义 `OneDiceError.code/meta`；测试不得断言完整 `message`；warning diagnostic 不得替代 fatal parser 拒绝 | `npm.cmd test -- test/v1/runtime-errors.test.ts test/issues/readme-error-codes.test.ts test/issues/no-plain-runtime-errors.test.ts` |
| Diagnostic | 当前公开 diagnostic 只应包含已实现的 `SYNTAX_NORMALIZED`，用于 `df` 和 FVTT dice pool 归一化；ADR-002、README 和本方案已同步该边界 | `FEATURE_FLAG_REQUIRED`、`COMPATIBILITY_PROJECTION`、`BUDGET_NEAR_LIMIT` 等未来 code 必须先补类型、README、ADR 和测试；UI 不得假设它们存在 | `npm.cmd test -- test/v1/fate-alias.test.ts test/v1/fvtt-compatibility.test.ts test/issues/docs-cross-links.test.ts` |
| V2 已实现能力 | `RollValue`、tuple literal、`kh/kl/dh/dl`、`min/max`、`tp`、`sp`、program 变量快照、conditionals、`lp`、`df` alias、FVTT pool、`@path` 和带目标值 `cs` 已经落到本地实现 | 这些能力仍必须通过 `features`、`syntax` 或 `rollProgram()` 显式启用；默认 `dice()` / `roll()` 不得扩大语法面；已完成 raw/trace/预算合同不得被 FVTT 兼容重定义 | `npm.cmd test -- test/v1/parser-errors.test.ts test/v1/*tuple*.test.ts test/v1/program.test.ts test/v1/loop-operator.test.ts test/v1/fvtt-compatibility.test.ts` |
| FVTT 暂缓能力 | 爆骰、重骰、无目标 `cs`、`cf`、非骰表达式池、Foundry actor/item/UUID/document lookup 已有结构化拒绝或暂缓说明 | 实现前必须补 ADR 或测试矩阵；兼容模式不得访问 `window.game`、localStorage、网络、文件系统或异步宿主状态；不得把未实现 Foundry 能力近似映射为 OneDice 行为 | `npm.cmd test -- test/v1/fvtt-compatibility.test.ts test/v1/parser-errors.test.ts` |
| 浏览器发布 | `tsup` build、Vite bundle 执行、Node-only 依赖扫描、CJS require、types 导出和 pack 白名单已经有测试 | 影响入口、类型、trace、diagnostic、feature flag 或包字段时必须重跑 browser smoke 和 pack dry-run；发布包不得包含 `src/`、`test/`、`docs/`、临时 tarball、WASM 或 native addon | `npm.cmd run test:browser`; `npm.cmd pack --dry-run` |

仍开放的工程队列应当只包含两类：第一类是已经实现能力的防回退守卫，例如 README/ADR/trace/error/package 合同；第二类是明确暂缓能力的 ADR 和默认拒绝矩阵，例如 FVTT 爆骰、重骰、无目标成功计数、失败计数和非骰表达式池。任何任务如果既不是防回退，也没有对应暂缓能力来源，就不得从本方案中拆出实现 PR。

### 剩余缺口必须拆成的任务合同

旧式的概括性缺口标题必须拆成下表中的可执行任务。每一行都应当有对应测试或文档证据，不能只作为口头待办存在。

| 任务 | 必须修改或检查 | 输入/场景 | 成功断言 | 失败断言 | 验收命令 |
| --- | --- | --- | --- | --- | --- |
| 嵌套 `{env}` range 合同 | `src/ast/interpolation.ts`、`src/trace.ts`、`test/v1/roll-trace.test.ts` | `roll('{attack}+1', { env: { attack: '2d6' } })` 或等价嵌套表达式 | 外层 interpolation trace 的 `range` 指向 `{attack}`；子表达式 trace 保留自己的局部 range；父 trace 记录可映射关系 | env 缺失必须抛 `VARIABLE_NOT_FOUND`，`meta.range` 指向变量引用，不得指向内部 fallback 字符串 | `npm.cmd test -- test/v1/roll-trace.test.ts` |
| JSON-safe trace 防回退 | `src/trace.ts`、所有新增 AST trace 测试 | tuple、slice、loop、FVTT pool、`rollProgram()` 结果 | `JSON.stringify(result)` 必须成功，且 `raw/trace/diagnostics` 不包含函数、类实例、循环引用 | 新增节点不得只返回 generic trace；缺少专属 trace 时必须补测试后再实现 | `npm.cmd test -- test/v1/json-serialization.test.ts` |
| 浏览器发布守卫 | `package.json`、`tsup.config.ts`、`test/browser/vite-import.test.ts`、`test/browser/package-contents.test.ts` | Vite fixture import `@onedice/core` 并执行 V1、V2 flag、FVTT 子集；`npm pack --dry-run --json` 审计实际发布文件 | `package.json.sideEffects=false`；bundle 真实执行 `dice()`、`rollProgram()`、`lp`、FVTT pool、`@path`、`df`、`cs` 和结构化拒绝路径；pack 文件只包含 `README.md`、`package.json` 和 `dist/` 产物 | browser bundle 不得依赖 `fs/path/process/Buffer/crypto/os` polyfill，不得出现 `process.` 或 `Buffer`；pack 不得包含 `src/`、`test/`、`docs/`、`node_modules/`、临时 tarball、WASM 或 native addon | `npm.cmd run test:browser`、`npm.cmd pack --dry-run` |
| README 错误码覆盖锁定 | `README.md`、`src/errors.ts`、`test/issues/readme-error-codes.test.ts` | 从 `OneDiceErrorCode` 提取公开错误码 | README 结构化错误表必须包含每个公开错误码，并说明浏览器 UI 如何使用 `code/meta` | 新增错误码后 README 缺项必须让测试失败；不得引用未公开临时代码 | `npm.cmd test -- test/issues/readme-error-codes.test.ts` |
| 普通 Error 防回退 | `src/**/*.ts`、`test/issues/no-plain-runtime-errors.test.ts` | 扫描源码中的 `throw new Error` | 用户可触达失败路径必须继续使用 `OneDiceError` 和稳定 `code/meta` | `src/` 新增普通 `throw new Error` 必须让测试失败；测试 helper 和 README 示例不属于源码运行时合同 | `npm.cmd test -- test/issues/no-plain-runtime-errors.test.ts` |
| 诊断码公开合同防漂移 | `src/trace.ts`、README、ADR-002、`test/v1/fate-alias.test.ts`、`test/v1/fvtt-compatibility.test.ts` | `roll('4df', { features: { fateAlias: true } })` 与 FVTT 池归一化 | `diagnostics` 只返回已公开 code；`SYNTAX_NORMALIZED` 必须包含 `range/feature/original/normalized`，且结果仍成功 | 未实现 warning diagnostic 不得出现在结果、README 示例或 UI 合同中；新增 diagnostic 必须同时补类型、README 和测试 | `npm.cmd test -- test/v1/fate-alias.test.ts test/v1/fvtt-compatibility.test.ts test/issues/docs-cross-links.test.ts` |
| 未来能力拒绝与 diagnostic 边界 | `src/parser/lexer.ts`、`src/errors.ts`、`test/v1/parser-errors.test.ts`、本方案 | 爆骰、重骰、无目标 `cs`、未启用 tuple/clamp/slice/loop/program token | 未启用或未实现能力必须抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature` 指向明确能力 | 不得用 non-fatal diagnostic 代替 fatal parser 拒绝；不得为了展示 warning 而让未实现语法成功求值 | `npm.cmd test -- test/v1/parser-errors.test.ts` |
| README feature flag 覆盖锁定 | `README.md`、`src/config.ts`、`docs/improvement-plan.md`、`test/issues/readme-feature-flags.test.ts` | 从 `RollFeatureFlags` 和 `DEFAULT_FEATURES` 提取公开 feature flag | 每个 flag 必须默认 `false`，并同时出现在 README 配置块、README 说明文字和方案 `RollFeatureFlags` 合同中 | 新增 flag 后 README 或方案缺项必须让测试失败；不得让未说明的 flag 进入公开 `Config.features` | `npm.cmd test -- test/issues/readme-feature-flags.test.ts` |
| `d` 语法文档与测试互锁 | `README.md`、`test/issues/issue-011-d-notation.test.ts` | `d`、`2d20k1`、`2d20q1`、`2d20a8`、非法互斥组合 | 文档槽位、互斥矩阵和测试表达式必须一致 | `k/q` 与 `p/b` 混用、`a` 与其他 modifier 混用必须抛专属错误码 | `npm.cmd test -- test/issues/issue-011-d-notation.test.ts` |
| FVTT 暂缓能力拒绝矩阵 | `src/parser/lexer.ts`、`test/v1/fvtt-compatibility.test.ts`、ADR-009 | 爆骰、重骰、无目标 `cs`、`cf`、roll mode、`@Actor[...]`、`@Item[...]`、`@UUID[...]`、`@Compendium[...]` | 默认模式和兼容模式均按具体 `meta.feature` 结构化拒绝；兼容模式不得调用 resolver | 未实现能力不得落入普通 parse error，不得访问宿主 Foundry runtime | `npm.cmd test -- test/v1/fvtt-compatibility.test.ts` |
| ADR 与方案链接一致性 | `docs/decisions/*.md`、`docs/upstream-onedice-issues.md`、`docs/improvement-plan.md` | README、issue 记录、方案、ADR 互相引用 | 每个已执行的重要能力都有 ADR 或方案条目；上游 issue 记录与方案互链 | 新增 ADR 未在 README/方案引用时应当被测试或人工审查发现 | `npm.cmd test -- test/issues/docs-cross-links.test.ts` |

上述任务的 PR 描述必须写清“本次完成哪一行、哪些行仍未做”。如果某个任务只补文档而不补测试，PR 必须说明该文档是否已经有现存测试锁定；没有测试锁定时，应当同时新增最小文档一致性测试。

## 上游 Issue 到本仓库任务的映射

### #11：掷骰表达式形式化

上游问题：

- `AdB(kq)C(pb)DaE` 这种描述压缩过度。
- 用户需要看参数表和附加说明才能理解约束关系。
- 上游提出把表达式拆成：

```text
[骰数]d[面数][[骰池参数]|[选取线参数][奖惩数参数]]

骰池参数：a[点数阈值]
选取线参数：(k|q)[选取个数]
奖惩数参数：(p|b)[奖惩个数]
```

本仓库应当执行：

- README 和后续文档不得继续只用 `AdB(kq)C(pb)DaE` 作为主说明。
- `d` 的文档应当按“槽位 + 互斥规则 + 缺省值 + 示例 + 错误案例”组织。
- 测试名称应当体现语义角色，而不是只写表达式本身。
- `DNode` 的运行时校验应当输出稳定错误码：
  - `DICE_INVALID_FACE_COUNT`
  - `DICE_INVALID_KEEP_COUNT`
  - `DICE_INCOMPATIBLE_MODIFIERS`
  - `DICE_POOL_MODIFIER_EXCLUSIVE`
- 浏览器 UI 应当能拿到“为什么错”和“如何修”的信息。

README 中 `d` 语法章节应当交付以下结构，不能只放一串压缩语法：

| 小节 | 必须说明 | 示例 |
| --- | --- | --- |
| 槽位 | `DiceCount`、`FaceCount`、`Modifier` 的位置和缺省值 | `d` 等价于 `1d100` 或按实现确认的默认百分骰 |
| modifier 类型 | `a`、`k/q`、`p/b` 的语义边界 | `2d20k1` 保留最大值，`b1` 表示奖励骰 |
| 互斥关系 | 哪些 modifier 不能组合 | `2d20a8k1` 必须失败 |
| 错误合同 | 错误码、`meta.range`、`meta.hint` | `DICE_POOL_MODIFIER_EXCLUSIVE` |
| UI 展示 | 浏览器如何高亮错误片段 | `range` 指向冲突 modifier，而不是整个表达式 |

`DNode` 校验应当拆成可测试的独立步骤：

1. **解析阶段**只负责把 token 组合为 `DNode`，不得在 parser 中隐式修正非法 modifier 顺序。
2. **归一化阶段**应当把缺省骰数、缺省面数和 modifier 数量写入内部结构，例如 `{ diceCount, faceCount, selection, bonusPenalty, pool }`。
3. **互斥校验阶段**必须先检查 `a` 是否独占，再检查 `k/q` 与 `p/b` 是否冲突，错误优先级必须稳定。
4. **预算校验阶段**必须在实际随机调用前执行，`diceCount` 超出预算时不得先掷出部分骰子。
5. **trace 组装阶段**必须保留原始投掷顺序，并用 `selected`、`dropped`、`modifier` 元数据表达选择结果。

错误 `meta` 应当至少包含：

| 错误码 | 必须包含的 `meta` | 浏览器 UI 用途 |
| --- | --- | --- |
| `DICE_INVALID_DICE_COUNT` | `diceCount`、`min`、`max`、`range`、`hint` | 标出左值并提示合法范围 |
| `DICE_INVALID_FACE_COUNT` | `faceCount`、`min`、`max`、`range`、`hint` | 标出右值并提示合法范围 |
| `DICE_INVALID_KEEP_COUNT` | `keepCount`、`diceCount`、`range`、`hint` | 标出 `k/q` 数量 |
| `DICE_INCOMPATIBLE_MODIFIERS` | `leftModifier`、`rightModifier`、`range`、`hint` | 解释 `k/q` 与 `p/b` 冲突 |
| `DICE_POOL_MODIFIER_EXCLUSIVE` | `poolModifier`、`conflictingModifier`、`range`、`hint` | 解释 `a` 不能和其他 modifier 混用 |

对应测试文件应当按语义命名，而不是按表达式命名：

```text
test/issues/issue-011-d-expression-formalization.test.ts
  - accepts implicit dice and face defaults
  - rejects pool modifier combined with keep modifier
  - rejects keep and bonus modifiers together
  - reports range for conflicting modifier
  - keeps V1 d expression API compatible
```

`d` 语法应当被正式描述为：

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

互斥规则应当明确：

| 组合 | 结果 | 原因 |
| --- | --- | --- |
| `d` | 合法 | 使用缺省骰数和面数 |
| `AdB` | 合法 | 普通多面骰 |
| `AdBkC` | 合法 | 选取最大 C 个 |
| `AdBqC` | 合法 | 选取最小 C 个 |
| `AdBpD` | 合法 | COC 惩罚骰模式 |
| `AdBbD` | 合法 | COC 奖励骰模式 |
| `AdBaE` | 合法 | 转为骰池计数 |
| `AdBkCpD` | 非法 | `k/q` 与 `p/b` 不得同时使用 |
| `AdBaEkC` | 非法 | `a` 骰池模式必须独占，不得再叠加选取或奖惩 modifier |
| `AdBqCpD` | 非法 | `q` 与 `p/b` 不得同时使用 |

### #10：奖惩骰规则

上游已关闭决议：

- 十位骰取值集合：`00, 10, 20, ..., 90`
- 个位骰取值集合：`0, 1, 2, ..., 9`
- 十位 `00` 且个位 `0` 时，结果为 `100`
- 奖惩骰替换十位并取较好或较差结果

本仓库应当执行：

- 必须先写确定性测试，再修改 `src/ast/dice/p.ts`。
- 测试应当精确控制随机数序列，而不是统计式测试。
- `PNode` 的 trace 应当保留：
  - 原始十位
  - 原始个位
  - 追加十位候选
  - 被选中的十位
  - 最终百分骰值
- `toString()` 应当仅作为旧式人工调试输出保留；浏览器 UI 必须读取结构化 trace，不得解析 `toString()`。

百分骰计算应当拆成纯函数，避免把 COC 规则散落在 `eval()` 内：

```ts
type PercentileDigit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

interface PercentileRollInput {
  ones: PercentileDigit
  baseTens: PercentileDigit
  extraTens: PercentileDigit[]
  mode: 'bonus' | 'penalty'
}

interface PercentileRollResult {
  value: number
  selectedTens: PercentileDigit
  candidates: PercentileDigit[]
}

function resolvePercentileRoll(input: PercentileRollInput): PercentileRollResult
```

值计算应当遵守：

```ts
function percentileValue(tens: number, ones: number): number {
  const value = tens * 10 + ones
  return value === 0 ? 100 : value
}
```

奖励骰应当选择使最终 `percentileValue()` 最小的十位候选；惩罚骰应当选择使最终 `percentileValue()` 最大的十位候选。不得仅按十位数字做 `min/max`，否则会忽略 `00 + 0 => 100` 的特殊映射。

必须覆盖的测试：

| 输入场景 | 随机序列语义 | 期望 |
| --- | --- | --- |
| 普通 `b0` 或内部基础百分骰 | tens=0, ones=0 | 100 |
| 奖励骰 | base tens=8, ones=3, extra=[2] | 23 |
| 惩罚骰 | base tens=2, ones=3, extra=[8] | 83 |
| 奖励骰边界 | base tens=0, ones=0, extra=[1] | 10 |
| 惩罚骰边界 | base tens=1, ones=0, extra=[0] | 100 |
| 多奖励骰 | base tens=7, ones=4, extra=[3,9,1] | 14 |
| 多惩罚骰 | base tens=7, ones=4, extra=[3,9,1] | 94 |

### #9：`d` 左右值上限增加到 10000

上游已关闭决议：

- `d` 的左值和右值上限应当支持到 `10000`。

本仓库应当执行：

- `maxRollCount` 应当解释为“单次表达式求值允许消耗的随机骰子数量上限”，而不是面数上限。
- `1d10000` 应当合法，因为只掷 1 个骰子。
- `10000d1` 应当合法，因为掷骰数量等于默认上限。
- `10001d1` 应当因骰数超过 `10000` 语义上限失败，不得通过调高旧 `maxRollCount` 绕过。
- 面数 `10000` 应当合法，但面数 `< 1` 或 `> 10000` 必须失败。
- 当前 `lp` 已经使用 `maxRandomCalls`、`maxEvaluationSteps`、`maxLoopIterations` 和 `maxLoopDepth` 预算模型；未来爆骰、递归重骰等高成本能力不得复用旧 `maxRollCount` 单字段语义。

应当引入上下文预算：

```ts
interface EvaluationBudget {
  maxRandomCalls: number
  randomCalls: number
  maxEvaluationSteps: number
  evaluationSteps: number
}
```

V1 阶段应当继续兼容 `maxRollCount`，但内部预算读取必须集中到预算对象，以便 V2 循环和重骰不会造成浏览器卡死。

### #3：OneDice V2 草案

上游 #3 内容非常大，不得作为一个单一功能处理。它应当被拆成互相依赖的设计主题：

1. 布尔、比较、三目运算
2. 多语句和寄存器
3. 元组值模型
4. 元组选择和丢弃
5. `min/max` 限制
6. `lp` 循环
7. `sp` 裁切
8. `tp` 弹射
9. `df` 等同 `f`
10. FVTT 兼容和移动端输入符号

执行顺序应当是：

```text
测试基线
  -> V1 关闭议题修正
  -> 浏览器包形态
  -> 结构化错误
  -> 元组内部模型
  -> kh/kl/dh/dl
  -> min/max
  -> tp/sp
  -> lp
  -> 多语句/寄存器
  -> FVTT 兼容模式
```

原因：

- `kh/kl/dh/dl`、`min/max`、`tp/sp/lp` 都依赖元组值模型。
- 多语句和寄存器依赖求值上下文。
- FVTT 兼容依赖明确的 OneDice 原生语义，否则会让语法歧义扩大。

### #3 的技术拆分原则

#3 不得被实现为一个“V2 总开关”。它应当被拆成以下工程层，每一层都必须有独立测试和回滚边界：

| 层 | 责任 | 应当先完成的产物 | 不得提前做的事 |
| --- | --- | --- | --- |
| 词法层 | 识别 `kh`、`kl`、`dh`、`dl`、`min`、`max`、`tp`、`sp`、`lp`、`df`、变量符号 | token 快照测试、歧义测试 | 不得只靠字符串预处理吞掉歧义 |
| 语法层 | 决定括号、元组、后缀/中缀运算符和优先级 | `grammar.yaml` 变更、parse tree 测试 | 不得手改生成后的 `table.json` |
| AST 层 | 为元组、选择、裁切、循环、变量建立独立节点 | 节点类型、`toString()` 兼容测试 | 不得把所有 V2 行为塞进 `SimpleNode` |
| 求值层 | 管理随机数、预算、变量、trace、diagnostics | `EvaluationContext`、`RollValue`、预算测试 | 不得继续让每个节点自行管理全局状态 |
| API 层 | 保留 `dice()`，新增结构化 `roll()`/`rollProgram()` | 类型导出、README 示例、浏览器 smoke test | 不得让旧 API 默认接受不兼容语法 |

每个 V2 能力进入实现前都必须写成“能力合同卡”。合同卡至少包含 feature flag、语法入口、AST 节点、消费模式、trace kind、默认拒绝错误和浏览器验收样例：

| 能力 | feature / mode | 语法入口 | AST / 求值落点 | trace kind | 默认拒绝合同 |
| --- | --- | --- | --- | --- | --- |
| 显式元组 | `features.tupleLiterals` | `[`、`,`、`]` | `TupleNode`、`RollValue.kind='tuple'` | `tuple` | `PARSE_UNSUPPORTED_SYNTAX`，`feature='tupleLiterals'` |
| keep/drop 元组 | `features.tupleOperators` | `kh/kl/dh/dl` | `TupleSelectionNode`，稳定排序和 tie-breaker | `tuple-selection` | `feature='tupleOperators'` |
| clamp | `features.clampOperators` | `min/max` | `ClampNode`，tuple 逐项或 scalar clamp | `clamp` | `feature='clampOperators'` |
| projection | `features.tupleProjection` | `tp` 后缀 | `TupleProjectionNode`，禁止二次求值 | `tuple-projection` | `feature='tupleProjection'` |
| slice | `features.tupleSlice` | `sp[...]` | `TupleSliceNode`，ADR-007 索引合同 | `tuple-slice` | `feature='tupleSlice'` |
| program | `rollProgram()` / `features.program` | `$`、`;`、赋值表达式 | statement scanner、变量 store | `program` / statement trace | 普通 `dice()` / `roll()` 必须拒绝 |
| conditionals | `features.conditionals` | `>`、`<`、`=`、`&`、`\|`、`? :` | `ComparisonNode`、`BooleanNode`、`ConditionalNode` | `comparison`、`boolean`、`conditional` | `feature='conditionals'` |
| loop | `features.loopOperator` | `Nlp[...]`、`[range]lp[...]` | `LoopNode`、循环预算、局部 `i` | `loop` | `feature='loopOperator'` |
| FVTT pool / `@path` | `syntax: 'fvtt-compatible'` | `{4d6,3d8}kh`、`@path` | 兼容 adapter、resolver、归一化 diagnostic | 复用 tuple trace + `SYNTAX_NORMALIZED` | 默认 `onedice` 必须拒绝 |

合同卡的验收样例必须同时包含三类输入：

1. **成功输入**：开启对应 feature 后返回稳定 `value/raw/trace`。
2. **默认拒绝输入**：未开启 feature 时抛 `PARSE_UNSUPPORTED_SYNTAX`，并断言 `meta.feature`。
3. **近邻反例**：看起来相似但属于旧语法或其他 feature 的表达式不得被误伤，例如 `2d20k1` 不得被 `kh` 词法识别破坏。

### #3 重点能力的落地细节

#### 寄存器与多语句

寄存器语法 `$0e(2d6);($0>10)?(2d8):($0)` 应当通过程序级 API 实现，而不是让单表达式 API 静默支持 `;`。原因是多语句会引入状态、执行顺序和诊断聚合，已经超出 `dice(input): [number, DiceNode]` 的语义边界。

实现时应当明确：

- `rollProgram()` 返回所有 statement 的 trace，而不是只返回最后一条。
- 每个 statement 应当共享同一个 `EvaluationContext` 和预算。
- 寄存器写入应当记录写入位置、变量名、原始 `RollValue` 和标量投影。
- 变量读取失败必须抛 `VARIABLE_NOT_FOUND`，并带上变量名和范围。
- `dice()` 不得默认接受 `;`，否则旧调用方会在无意中获得有状态语义。

#### 布尔、比较与三目运算

比较运算 `>`、`<`、`=` 应当返回数值布尔：满足为 `1`，不满足为 `0`。`&`、`|` 应当只消费标量投影，并按照“非零为真”的规则计算。三目运算应当只求值被选中的分支，避免未选分支消耗随机数。

必须覆盖的测试：

| 表达式 | 随机序列 | 期望 |
| --- | --- | --- |
| `3>2` | 无 | `1` |
| `2>3` | 无 | `0` |
| `(1d2=2)&(3d6>3)` | `[2,1,1,1]` | `0` |
| `(3d6>5)?(2d8):(3d6)` | 第一段触发 true | 只消耗 true 分支随机数 |
| `(3d6>18)?(2d8):(3d6)` | 第一段触发 false | 只消耗 false 分支随机数 |

#### 阶乘与阶加

`X!` 和 `X?` 应当被列为高风险后缀运算符，因为它们容易与 `!` 的逻辑非含义冲突，也会带来大数溢出和性能风险。实现前必须写 ADR 决定：

- `!` 是否只表示阶乘，还是在布尔上下文中表示非。
- `?` 是否只表示阶加，还是会与三目 `? :` 冲突。
- 超过 `Number.MAX_SAFE_INTEGER` 时应当抛错、截断，还是返回 `bigint`。
- 浏览器 UI 中是否需要显示溢出诊断。

在 ADR 完成前，解析器遇到裸 `!` 或 `?` 后缀应当抛 `PARSE_UNSUPPORTED_SYNTAX`，不得误解析为其他运算。

#### FVTT 与移动端符号

上游 #3 对 `$`、`[`、`]`、`@` 存在明确争议：一方关注移动端输入困难和 Android QQ `$` 触发礼物 UI，另一方担心同时支持多个标记会分化习惯并占用未来语法空间。因此本仓库应当采用隔离策略：

- 默认 `syntax: 'onedice'` 只启用 OneDice 原生符号。
- `syntax: 'fvtt-compatible'` 才启用 `{a,b,c}` 池和 `@path.to.data`。
- 移动端替代符号不得作为默认别名进入核心语法。
- 如果需要同时支持 `$0` 与 `@0`，必须通过 `features.variableAliases` 显式打开，并产生 `warning` 诊断。
- README 应当分别给出“标准 OneDice 输入”和“FVTT 兼容输入”，避免用户混用。

### #5：Rust `diro` 生态

该议题不应当触发本仓库引入 Rust 依赖。它应当作为交叉实现参考：

- 应当用 `diro` 的公开行为与本仓库测试向量互相对照，但不得复制其内部实现结构。
- 应当把跨语言一致性写成 fixture，而不是复制某个实现的内部结构。
- 浏览器核心不得依赖 WASM 或 Rust，除非未来有明确性能瓶颈和独立 ADR。

## 需求到工程任务矩阵

上游 issue 不应当直接变成“大功能”。每个 issue 必须先落到本仓库的测试、类型、模块和文档改动上：

| 上游来源 | 本仓库必须产物 | 类型/模块落点 | 必测表达式 | 必须失败的表达式 |
| --- | --- | --- | --- | --- |
| #9 `d` 上限 | V1 边界测试、预算语义说明、错误码 | `src/ast/dice/d.ts`、`src/evaluation/context.ts` | `1d10000`、`10000d1`、显式 `maxRandomCalls` 高于旧 `maxRollCount` | `10001d1`、`1d10001`、`1d0`、低 `maxRandomCalls` 预算 |
| #10 奖惩骰 | 纯函数化百分骰规则、候选 trace、边界测试 | `src/ast/dice/p.ts`、`src/trace.ts` | `b1`、`p1`、`00+0` | 奖惩数量为负、非整数数量 |
| #11 `d` 形式化 | 槽位文档、互斥矩阵、结构化错误 | `README.md`、`src/errors.ts`、`test/issues` | `2d20k1`、`2d20q1`、`2d20a8` | `2d20k1p1`、`2d20a8k1` |
| #3 元组/V2 | ADR、`RollValue`、`EvaluationContext`、feature flag | `src/evaluation/*`、`utils/grammar.yaml` | `[2,7,4]kh1`、`2d20tp` | 未开启 flag 的 FVTT/爆骰语法 |
| #3 多语句/变量 | `rollProgram()`、变量 store、statement trace | `src/evaluation/context.ts`、新 program parser | `$0e(2d6);$0` | 未定义变量、预算耗尽 |
| #3 FVTT 兼容 | 独立 `syntax` 模式、归一化诊断 | parser 入口、README 兼容章节 | `{4d6,3d8}kh`、`@path.to.data` | 默认模式下的 `{4d6,3d8}kh` |
| #5 生态参考 | 行为对照 fixture，不引入运行时依赖 | `test/compat/` 或文档附录 | 与 `diro` 一致的公开例子 | 复制 Rust/WASM 依赖到浏览器核心 |

矩阵中的“必须失败”表达式与“必测表达式”同等重要。任何 PR 如果只验证成功路径，没有验证错误码、预算或兼容模式隔离，都不得被视为完成。

### 默认模式的未来语法拒绝合同

在真正实现 V2/FVTT 语法前，解析器应当先建立“可识别但默认拒绝”的基线。原因是 `kh`、`min`、`tp`、`df` 等 token 与当前 V1 单字符语法存在重叠；如果 lexer 继续把它们拆成 `k`、`h`、`d`、`f` 等片段，浏览器 UI 会收到不可解释的普通 parse error，后续再兼容会更困难。

默认 `syntax: 'onedice'` 应当遵守以下规则：

- 已知未来 token 必须被稳定识别为一个整体，并抛 `PARSE_UNSUPPORTED_SYNTAX`。
- 错误 `meta` 必须包含 `operator`、`actual`、`range`、`feature` 和 `hint`。
- `hint` 应当告诉调用方该语法属于哪个未来能力，而不是只写“语法错误”。
- 旧 V1 合法表达式不得因为未来 token 识别而被误伤。
- FVTT 专属语法必须在默认模式下失败，不能被 `{env}` 插值或普通 tuple 规则吞掉。
- `{env}` 插值仍然应当按旧规则保留；例如 `{attack,bonus}` 只有在后接 FVTT/tuple 运算符时才应当被识别为 FVTT 池语法。

应当建立以下拒绝测试矩阵：

| 表达式 | 识别对象 | 默认错误码 | `meta.feature` | `meta.hint` 应当表达 |
| --- | --- | --- | --- | --- |
| `2d20kh1` | `kh` | `PARSE_UNSUPPORTED_SYNTAX` | `tupleOperators` | 元组保留最高值尚未在默认模式启用 |
| `2d20kl1` | `kl` | `PARSE_UNSUPPORTED_SYNTAX` | `tupleOperators` | 元组保留最低值尚未在默认模式启用 |
| `2d20dh1` | `dh` | `PARSE_UNSUPPORTED_SYNTAX` | `tupleOperators` | 元组丢弃最高值尚未在默认模式启用 |
| `2d20dl1` | `dl` | `PARSE_UNSUPPORTED_SYNTAX` | `tupleOperators` | 元组丢弃最低值尚未在默认模式启用 |
| `5min6` | `min` | `PARSE_UNSUPPORTED_SYNTAX` | `clampOperators` | 下限 clamp 尚未启用 |
| `7max6` | `max` | `PARSE_UNSUPPORTED_SYNTAX` | `clampOperators` | 上限 clamp 尚未启用 |
| `3d100tp` | `tp` | `PARSE_UNSUPPORTED_SYNTAX` | `tupleProjection` | tuple projection 需要显式开启 feature flag |
| `[1,2,3]sp[2]` | `sp` | `PARSE_UNSUPPORTED_SYNTAX` | `tupleSlice` | tuple slice 尚未启用 |
| `[1,3]lp[id6]` | `lp` | `PARSE_UNSUPPORTED_SYNTAX` | `loopOperator` | `lp` 已受预算模型约束，默认模式仍必须拒绝 |
| `4df` | `df` | `PARSE_UNSUPPORTED_SYNTAX` | `fateAlias` | 默认继续拒绝；启用 `features.fateAlias` 后归一化为 `4f` 并产生 `SYNTAX_NORMALIZED` |
| `$0e(2d6);$0` | `$`、`;` | `PARSE_UNSUPPORTED_SYNTAX` | `program` | 多语句和寄存器必须使用 program API |
| `(3d6>5)?2d8:1d4` | `>`、`? :` | `PARSE_UNSUPPORTED_SYNTAX` | `conditionals` | 比较和三目运算尚未启用 |
| `{4d6,3d8}kh` | FVTT 池 | `PARSE_UNSUPPORTED_SYNTAX` | `fvttCompatibility` | FVTT 池只能在兼容模式启用 |
| `@abilities.str.mod` | `@path` | `PARSE_UNSUPPORTED_SYNTAX` | `fvttCompatibility` | `@path` 变量只能在兼容模式启用 |

同一批测试必须覆盖反例，确保 V1 不回退：

| 表达式 | 应当继续工作或保持现有错误 | 原因 |
| --- | --- | --- |
| `2d20k1` | 合法 | V1 keep-highest 语法已经存在 |
| `2d20q1` | 合法 | V1 keep-lowest 语法已经存在 |
| `1d10000` | 合法 | #9 已接受面数上限 |
| `10000d1` | 合法 | #9 已接受骰数上限，受预算保护 |
| `{attack}+1` | 合法或按 env 缺失抛 `VARIABLE_NOT_FOUND` | 当前 `{env}` 插值不能被 FVTT 池规则污染 |
| `{attack,bonus}` | 合法或按 env 缺失抛 `VARIABLE_NOT_FOUND` | 逗号本身不能让旧 `{env}` key 被误判为 FVTT 池 |
| `1dfoo` | 明确 parse error | 不得误识别为 `1d` + `f` alias |

实现落点应当拆成三层：

1. **Lexer 层**：多字符未来 token 必须在单字符 token 前识别，token 必须保留 `raw` 和 `range`。
2. **Parser 层**：默认 grammar 不应当直接消费这些 token；遇到 token 时应当进入统一 unsupported 分支。
3. **配置层**：只有显式 `features` 或 `syntax` 打开后，parser 才能把 token 交给对应 AST 节点。

候选配置类型应当先写进类型设计，再进入实现：

```ts
interface FeatureFlags {
  tupleLiterals?: boolean
  tupleOperators?: boolean
  clampOperators?: boolean
  tupleProjection?: boolean
  tupleSlice?: boolean
  loopOperator?: boolean
  conditionals?: boolean
  program?: boolean
  fateAlias?: boolean
  fvttSuccessCounting?: boolean
  variableAliases?: boolean
}

interface RollConfig {
  syntax?: 'onedice' | 'fvtt-compatible'
  features?: FeatureFlags
}
```

`syntax: 'fvtt-compatible'` 应当只启用已经实现且有测试的兼容能力，不得一次性等同于“打开所有未来 feature”。如果兼容模式收到尚未实现的 Foundry/FVTT 特性，仍然必须抛 `PARSE_UNSUPPORTED_SYNTAX`，并在 `meta.feature` 中写明缺失能力。`df` 作为 `f` 的别名已经通过 `features.fateAlias` 实现；默认拒绝测试必须保留，启用路径必须验证 `4df` 与 `4f` 的数值、trace 和预算消耗一致，并产生 `SYNTAX_NORMALIZED` 诊断。

### 模块级技术落地清单

后续实现不应当把 parser、求值、trace、错误和浏览器包输出混在一个大改动中。每个技术主题都应当有明确文件边界：

| 主题 | 应当新增或修改 | 不得放入 |
| --- | --- | --- |
| 未来 token 拒绝 | `src/parser/lexer.ts`、parser 错误测试、`docs/improvement-plan.md` | 不得实现 V2 求值 |
| 显式元组 | `TupleNode`、`RollValue` tuple raw、tuple trace | 不得顺带实现 `lp` |
| 元组选择 | `TupleSelectionNode`、`kh/kl/dh/dl` 测试、selected/dropped trace | 不得改变 V1 `k/q` |
| clamp 运算 | `ClampNode`、`min/max` 测试、逐项 tuple clamp | 不得使用 `Math.min/max` 直觉反向实现 |
| program API | `rollProgram()`、statement parser、变量 store、statement trace | 不得让 `dice()` 默认接受 `;` |
| FVTT 兼容 | `syntax` 分支、FVTT 归一化诊断、独立 README 章节 | 不得污染默认 OneDice 语法 |

`RollValue` 的内部模型应当支撑“同一个节点同时有标量投影和结构化 raw”：

```ts
type RollValue = ScalarRollValue | TupleRollValue

interface ScalarRollValue {
  kind: 'scalar'
  value: number
  source?: 'literal' | 'arithmetic' | 'projection' | 'comparison'
}

interface TupleRollValue {
  kind: 'tuple'
  items: RollValueItem[]
  projection: 'sum' | 'last' | 'identity'
}

interface RollValueItem {
  value: RollValue
  index: number
  source?: 'tuple-literal' | 'dice-roll' | 'slice' | 'loop'
  selected?: boolean
  dropped?: boolean
  randomCall?: number
  range?: { start: number; end: number }
}
```

投影函数应当成为唯一出口：

```ts
function projectToNumber(
  value: RollValue,
  mode?: 'sum' | 'last' | 'identity',
  range?: SourceRange,
): number
```

不得让 `SimpleNode`、`DNode`、`TupleSelectionNode` 各自随意实现 tuple 到 number 的转换。所有标量消费节点必须调用 `projectToNumber()`，并在不能投影时抛稳定错误：

| 场景 | 错误码 | `meta` 必填 |
| --- | --- | --- |
| 空 tuple 用 `sum` 或 `last` 投影 | `TUPLE_EMPTY_PROJECTION` | `operator`、`range` |
| `identity` tuple 被旧 `dice()`、resolver 或标量消费方消费 | `TUPLE_CANNOT_PROJECT` | `operator`、`range`、`hint` |
| tuple item 不是可投影值 | `TUPLE_CANNOT_PROJECT` | `index`、`range`、`consumer` |

`EvaluationContext` 应当成为所有状态的唯一所有者：

```ts
interface EvaluationContext {
  random: BudgetedRandomSource
  budget: EvaluationBudget
  variables: Map<string, RollValue>
  diagnostics: RollDiagnostic[]
  syntax: 'onedice' | 'fvtt-compatible'
  features: Required<FeatureFlags>
}
```

任何递归求值都必须复用父上下文：

- `{env}` 插值求值必须消耗同一随机预算。
- `p/b` 内部候选十位不得绕过预算随机源。
- `a/c` 这类可能重复掷骰的节点必须在每次随机调用前检查预算。
- `lp` 实现和后续修改必须同时检查随机调用预算、求值步数预算、循环次数预算和循环深度预算。

### 浏览器 UI 集成细节

浏览器调用方应当只依赖稳定字段，不得解析字符串输出。方案落地时应当保证以下 UI 场景可直接实现：

| UI 场景 | 核心字段 | 技术要求 |
| --- | --- | --- |
| 输入框红线提示 | `OneDiceError.meta.range` | range 必须使用 UTF-16 字符偏移，和浏览器 input/textarea selection 一致 |
| 错误文案 | `error.code`、`error.meta.hint` | UI 不得依赖完整 `message` |
| 掷骰动画 | `trace.rolls[].randomCall`、`trace.rolls[].index` | 原始投掷顺序和随机调用顺序必须可复原 |
| 奖惩骰候选展示 | `trace.candidates`、`trace.selectedTens` | `00+0=>100` 必须能从候选中看出 |
| 分享/回放 | `input`、`config`、可序列化 `trace` | trace 不得包含函数、类实例或循环引用 |
| 大表达式保护 | `EVALUATION_BUDGET_EXCEEDED`、`meta.budgetKind`、`meta.actual`、`meta.limit` | 当前 UI 必须依赖 fatal 预算错误提示用户减少骰子数量、缩短循环或提高预算；near-limit warning 只有在诊断码、阈值、README 和测试全部落地后才能成为 UI 合同 |

`range` 坐标必须统一。默认表达式使用原始输入字符串坐标；`{env}` 内部表达式的 trace 应当以子表达式为坐标系，并在父 trace 中通过 interpolation 节点记录外层 range。这样 UI 能够同时高亮 `{attack}` 本身和展开后的 env 表达式。

### 单项任务必须写成工程合同

后续从本方案拆出的 issue 不应当只写“支持某语法”或“优化浏览器体验”。每个任务必须写成可实现、可测试、可回滚的工程合同，至少包含以下字段：

```md
## 背景
- 来源：上游 issue / ADR / 本地缺口
- 用户场景：浏览器 UI、回放、测试、兼容模式或旧 API

## 输入合同
- 表达式：
- 配置：
- 随机序列：
- 环境变量：

## 输出合同
- `dice()` 数值行为：
- `roll().value`：
- `roll().raw`：
- `roll().trace`：
- `roll().diagnostics`：

## 失败合同
- 非法输入：
- 错误码：
- `meta` 必填字段：
- UI 应当展示的提示：

## 实现范围
- 必须修改：
- 必须新增测试：
- 不得混入：

## 验收命令
- `npm.cmd test -- ...`
- `npm.cmd run typecheck`
- 如影响浏览器包：`npm.cmd run build`、`npm.cmd run test:browser`、`npm.cmd pack --dry-run`
```

示例任务应当写成：

```md
任务：实现 `2d20kh1` 的元组保留最高值

输入合同：
- `roll('2d20kh1', { random: sequenceRandom([7, 19]), features: { tupleOperators: true } })`

输出合同：
- `value = 19`
- `raw.kind = 'tuple'`
- `trace.kind = 'tuple-selection'`
- 第一颗骰子 `selected=false, dropped=true, randomCall=1`
- 第二颗骰子 `selected=true, dropped=false, randomCall=2`

失败合同：
- `2d20kh3` 必须抛 `DICE_INVALID_KEEP_COUNT`
- `meta.operator = 'kh'`
- `meta.actual = 3`
- `meta.limit = 2`

实现范围：
- 修改 `utils/grammar.yaml`、生成 parser 表、增加 `TupleSelectionNode`
- 不得改变旧 `2d20k1` 的语义
- 不得让默认 `dice()` 在未开启设计阶段时接受 FVTT 池语法
```

这种写法应当成为后续拆 issue 和写 PR 描述的最低标准。任何缺少失败合同或验收命令的任务，都应当先补全再进入实现。

拆分任务时还应当补齐以下工程字段，避免概括性描述进入实现：

| 字段 | 必须写清 | 示例 |
| --- | --- | --- |
| feature gate | 默认是否启用、通过哪个 `Config.features` 字段启用 | `features: { tupleLiterals: true }` 才接受 `[1,2,3]` |
| parser 合同 | lexer token、grammar 产生式、错误码和 range | `[` 在默认模式抛 `PARSE_UNSUPPORTED_SYNTAX`，启用后生成 tuple token |
| AST 合同 | 新节点名称、子节点顺序、`toString()` 输出 | `TupleNode.items` 按源码顺序保存，`toString()` 输出 `[a,b,c]` |
| value 合同 | `raw.kind`、投影方式、空值行为 | literal tuple 使用 `projection: 'last'`，空元组抛 `TUPLE_EMPTY_PROJECTION` |
| trace 合同 | `trace.kind`、子 trace、range、随机调用顺序 | `TupleTrace.items` 与 `TupleNode.items` 一一对应 |
| 兼容合同 | `dice()`、`roll()`、README 和旧语法是否受影响 | 默认 `dice('2d20k1')` 行为不变 |
| 回滚合同 | 关闭 feature flag 后应当恢复到哪个失败路径 | 关闭 `tupleOperators` 后 `kh` 继续抛 unsupported syntax |

## 目标 API 设计

### 兼容 API 必须保留

现有 API 必须保留：

```ts
import { dice } from '@onedice/core'

const [value, root] = dice('2d20k1')
```

兼容要求：

- 返回值仍为 `[number, DiceNode]`。
- `DiceNode#toString()` 仍可用于旧的过程展示。
- `Config.random` 仍可注入。
- `Config.maxRollCount` 仍可传入。

### 新 API 应当提供结构化结果

为了浏览器 UI，新 API 必须命名为 `roll()`。`evaluate()` 可在内部作为求值函数名使用，但不得作为第一阶段公开主入口，以免 API 同时出现两个含义接近的入口：

```ts
import { roll } from '@onedice/core'

const result = roll('2d20kh', {
  random: sequenceRandom([17, 4]),
  syntax: 'onedice',
  maxRandomCalls: 10000,
})
```

公开配置应当从旧 `Config` 平滑扩展为：

```ts
interface RollConfig {
  random?: (min: number, max: number) => number
  maxRollCount?: number
  maxRandomCalls?: number
  maxEvaluationSteps?: number
  maxLoopIterations?: number
  maxLoopDepth?: number
  syntax?: 'onedice' | 'fvtt-compatible'
  env?: Record<string, unknown>
  resolver?: (path: string, context: ResolverContext) => unknown
  features?: Partial<RollFeatureFlags>
}

interface RollFeatureFlags {
  tupleLiterals: boolean
  tupleOperators: boolean
  clampOperators: boolean
  tupleProjection: boolean
  tupleSlice: boolean
  loopOperator: boolean
  conditionals: boolean
  program: boolean
  fateAlias: boolean
  fvttSuccessCounting: boolean
  variableAliases: boolean
}
```

配置归一化必须满足：

- `maxRollCount` 应当继续作为旧配置名支持，并映射到 `maxRandomCalls`。
- `maxRandomCalls` 与 `maxRollCount` 同时传入时，`maxRandomCalls` 必须优先；若未来需要兼容性提醒，必须先定义公开 diagnostic code、README 表格和测试，不得引用未公开的临时代码。
- `syntax` 缺省值必须是 `'onedice'`。
- `features` 缺省必须全部关闭高风险 V2/FVTT 能力；`rollProgram()` 这类专用入口允许在内部开启所需能力，但不得把 program 语义泄漏到 `dice()` 或普通 `roll()`。
- `syntax: 'fvtt-compatible'` 只能启用已经实现、已有测试、已有 README 说明的兼容 adapter；尚未实现的 Foundry/FVTT 特性必须继续结构化拒绝。
- `resolver` 只能在 `syntax: 'fvtt-compatible'` 的 `@path` 解析中同步调用；返回 `undefined` 时才回退到 `env`，抛错时必须包裹为 `VARIABLE_RESOLVER_FAILED`。
- `random` 必须只通过 `RandomSource.nextInt()` 间接调用，以便预算计数和 trace 记录不被绕过。

返回结构必须是：

```ts
interface RollResult {
  value: number
  raw: RollValue
  root: DiceNode
  trace: RollTrace
  diagnostics: RollDiagnostic[]
}
```

字段语义：

- `value`：标量投影结果，供旧式数值消费使用。
- `raw`：保留标量或元组原始值，供 V2 运算和 UI 展示使用。
- `root`：AST 根节点，保留调试能力。
- `trace`：结构化掷骰过程，供浏览器展示“每个骰子出了什么、哪些被保留、哪些被丢弃”。
- `diagnostics`：非致命警告、兼容性提示、语法归一化说明。

`roll()` 的异常策略必须固定：

- 语法错误、非法 modifier、预算耗尽、变量缺失必须抛 `OneDiceError`。
- 非致命兼容转换必须进入 `diagnostics`，不得抛错。
- 同一输入在相同 `random` 序列和相同配置下必须产生相同 `value`、`raw` 和 `trace`。
- `roll()` 不得修改传入的 `env`、`features` 或其他配置对象。
- `trace`、`raw`、`diagnostics` 必须能被 `JSON.stringify()` 序列化。

### 浏览器接入技术合同

浏览器使用不是“打出 ESM 文件”即可完成。公开包必须满足以下技术合同：

| 主题 | 应当达到的行为 | 验收方式 |
| --- | --- | --- |
| 模块入口 | `exports.import` 指向 ESM，`exports.require` 指向 CJS，`types` 指向 `.d.ts` | `npm.cmd pack --dry-run` 与 Vite fixture |
| Tree-shaking | 顶层不得执行随机数、I/O、全局注册或环境探测副作用 | `package.json.sideEffects=false`，构建后检查入口 |
| Node 依赖 | 浏览器入口不得引用 `fs`、`path`、`process`、`Buffer`、`crypto` 等 Node-only 对象 | Vite smoke test 不得出现 polyfill |
| 同步阻塞 | 大骰数、循环和未来重骰必须受预算控制 | 预算耗尽测试断言 `EVALUATION_BUDGET_EXCEEDED` |
| 可复现性 | 所有随机数必须走注入的 `random` 或内部 `RandomSource` | trace 中 `randomCall` 从 1 连续递增 |
| UI 展示 | 错误和 trace 不依赖 `toString()` 解析 | 测试断言 `OneDiceError.code` 与 trace JSON |
| 移动端输入 | 默认语法不得引入多套等价符号 | 变量符号和 FVTT 兼容必须由 ADR 决定 |
| 包内容 | 发布包只包含运行时、类型和必要元数据 | `npm.cmd pack --dry-run` 内容审计 |

浏览器 smoke test 必须至少覆盖：

```ts
import { dice, roll, OneDiceError } from '@onedice/core'

const [legacyValue] = dice('1d6', { random: () => 4 })
const result = roll('2d20k1', { random: sequenceRandom([3, 18]) })

if (legacyValue !== 4) throw new Error('legacy dice() import failed')
if (result.value !== 18) throw new Error('roll() import failed')

try {
  roll('2d20k1p1')
} catch (error) {
  if (!(error instanceof OneDiceError)) throw error
  if (error.code !== 'DICE_INCOMPATIBLE_MODIFIERS') throw error
}
```

该测试应当运行在真实浏览器打包链路中，而不是仅在 Node 中直接 import 源码。若测试使用 Vite，fixture 应当依赖构建产物或本地包入口，避免只验证 TypeScript 源码路径。

### 值模型应当支持标量和元组

当前 `eval(): number` 不足以支持 V2。内部应当改造为：

```ts
type RollValue = ScalarValue | TupleValue

interface ScalarValue {
  kind: 'scalar'
  value: number
  source?: 'literal' | 'dice-sum' | 'projection' | 'operator'
}

interface TupleValue {
  kind: 'tuple'
  items: RollValue[]
  projection: 'sum' | 'last' | 'identity'
  source?: 'literal' | 'dice-rolls' | 'loop' | 'slice' | 'operator'
}
```

投影规则应当明确：

| 场景 | 标量投影 |
| --- | --- |
| 普通算术 | `number` |
| `2d20` 被普通算术消费 | 默认求和 |
| `2d20` 被 `kh/kl/dh/dl` 消费 | 使用骰子元组 |
| 顶层 `[a,b,c]` 进入旧 `dice()` | 返回最后一个元素的标量投影 |
| 顶层 `[a,b,c]` 进入新 `roll()` | `raw` 保留 tuple，`value` 使用兼容投影 |

投影函数必须集中实现：

```ts
function projectToNumber(value: RollValue, mode: 'sum' | 'last' | 'identity', range?: SourceRange): number
```

规则必须覆盖：

- `scalar` 直接返回 `value`。
- `tuple + sum` 返回所有子项的标量投影之和。
- `tuple + last` 返回最后一个子项的标量投影；空元组必须抛 `TUPLE_EMPTY_PROJECTION`。
- `tuple + identity` 不得被旧 `dice()`、resolver 或标量消费方消费；如必须消费，应当抛 `TUPLE_CANNOT_PROJECT`，并在调用方提供源码范围时保留 `meta.range`。
- 投影过程必须进入 trace，避免 UI 无法解释“为什么元组最后变成一个数字”。

为了降低风险，第一阶段不得删除 `eval()`。应当新增内部方法：

```ts
interface EvaluatableNode<TTrace = unknown> {
  eval(config: Config): number
  evaluate(context: EvaluationContext): EvaluationResult<TTrace>
}
```

旧 `eval()` 应当逐步变为：

```ts
eval(config: Config): number {
  return this.evaluate(createContext(config)).value
}
```

### 求值上下文应当集中管理状态

V2 的寄存器、变量、循环、预算都不应散落在各节点中。应当引入：

```ts
interface EvaluationContext {
  config: NormalizedConfig
  random: RandomSource
  budget: EvaluationBudget
  variables: VariableStore
  diagnostics: RollDiagnostic[]
}

interface RandomSource {
  nextInt(min: number, max: number): number
}

interface VariableStore {
  get(name: string): RollValue | undefined
  set(name: string, value: RollValue): void
}
```

好处：

- `lp` 循环必须共享同一套预算。
- `$0`、`$tA`、`@path` 必须统一走变量解析层。
- 浏览器 UI 必须能拿到完整诊断信息。
- 测试必须能注入确定性随机数和预置变量。

### 上下文复用规则

所有递归求值都必须复用同一个 `EvaluationContext`。这条规则是浏览器安全边界，不只是内部重构要求：

| 调用路径 | 当前/目标行为 | 必须共享的状态 | 必测断言 |
| --- | --- | --- | --- |
| `DNode` 调用 `dice(`${pb}${d}`)` 计算奖惩骰 | 子表达式必须继承父上下文 | `budget.randomCalls`、`diagnostics` | `2d20b1` 的 6 次随机调用不得被拆成多个预算 |
| `DNode` 将 `a` 骰池桥接为 `ANode` 表达式 | 桥接调用必须继承父上下文 | 预算、随机序号、trace 子节点 | 超出 `maxRollCount` 必须在整体表达式层失败 |
| `InterpolationNode` 求值 `{env}` 内容 | 插值表达式必须继承父上下文 | 预算、变量、diagnostics | `{attack}+1` 中的 `1d6` 随机调用应当计入外层预算 |
| `rollProgram()` 多语句 | 所有 statement 必须共享上下文 | 变量 store、预算、statement diagnostics | 第一条语句设置的变量可被后续语句读取 |
| `lp` 循环 | 每次循环体必须共享上下文并扣减步数 | 循环深度、循环次数、求值步数、随机预算 | 预算耗尽抛 `EVALUATION_BUDGET_EXCEEDED` |

`dice()` 实现应当遵守：

```ts
const normalized = getConfig(config)
const context = getEvaluationContext(config) ?? createEvaluationContext(normalized)
const value = root.eval(attachEvaluationContext(normalized, context))
```

不得在已经带有 `__context` 的配置对象上无条件创建新上下文。否则 `maxRollCount` 会在递归调用中被重置，浏览器端面对奖惩骰、插值或循环时会失去预算保护。

### 实施模块落点

后续实现应当按模块边界拆分，避免把求值、trace、错误和语法扩展混在同一个文件中：

| 模块 | 目标文件 | 职责 | 第一批必须补齐 |
| --- | --- | --- | --- |
| 公开 API | `src/index.ts` | 导出 `dice()`、`roll()`、后续 `rollProgram()` 和公共类型 | `roll()` 返回 `raw`，并保持 `dice()` 兼容 |
| 错误模型 | `src/errors.ts` | 定义 `OneDiceError`、错误码、meta 类型、类型守卫 | 增加 parser/tuple/config 错误码 |
| trace | `src/trace.ts` | 把已求值 AST 转成 JSON-safe trace | 覆盖所有 V1 节点，移除关键路径 generic fallback |
| 求值上下文 | `src/evaluation/context.ts` | 管理随机源、预算、变量、diagnostics | 新增 `createEvaluationContext()` 和预算扣减函数 |
| 值模型 | `src/evaluation/value.ts` | 定义 `RollValue`、投影函数、tuple helper | 新增 `projectToNumber()` 和空元组错误 |
| 语法源 | `utils/grammar.yaml` | 唯一语法源文件 | 新增 token 前必须先写 ADR 和 parse 测试 |
| AST 节点 | `src/ast/**/*.ts` | 解析节点和求值节点 | 分阶段增加 `evaluate(context)`，保留 `eval(config)` 桥接 |
| 浏览器验证 | `test/browser/` | 打包与运行时 smoke test | 覆盖 ESM import、类型导出和 Node polyfill 缺失 |

目录演进应当采用增量方式：

```text
src/
  evaluation/
    context.ts
    random.ts
    value.ts
    budget.ts
  trace.ts
  errors.ts
```

新增目录不得改变现有导入者对 `src/index.ts` 的使用方式。内部文件重排必须通过 barrel export 或兼容导出保护现有测试。

## 错误与诊断模型

### 必须提供稳定错误码

浏览器调用方不得依赖中文或英文错误字符串来判断类型。错误应当有稳定 `code`：

```ts
class OneDiceError extends Error {
  name = 'OneDiceError'

  constructor(
    public code: OneDiceErrorCode,
    message: string,
    public meta: OneDiceErrorMeta = {},
  ) {
    super(message)
  }
}
```

错误码应当以 `src/errors.ts` 的公开联合类型为准。当前已经覆盖 V1、program、tuple、loop、FVTT resolver 和预算错误：

```ts
type OneDiceErrorCode =
  | 'PARSE_UNEXPECTED_TOKEN'
  | 'PARSE_UNEXPECTED_END'
  | 'PARSE_UNSUPPORTED_SYNTAX'
  | 'PROGRAM_EMPTY_STATEMENT'
  | 'DICE_INVALID_FACE_COUNT'
  | 'DICE_INVALID_DICE_COUNT'
  | 'DICE_INVALID_KEEP_COUNT'
  | 'DICE_INCOMPATIBLE_MODIFIERS'
  | 'DICE_POOL_MODIFIER_EXCLUSIVE'
  | 'DICE_TOO_MANY_ROLLS'
  | 'PERCENTILE_INVALID_BONUS_PENALTY_COUNT'
  | 'EVALUATION_BUDGET_EXCEEDED'
  | 'VARIABLE_NOT_FOUND'
  | 'VARIABLE_INVALID_VALUE'
  | 'VARIABLE_RESOLVER_FAILED'
  | 'VARIABLE_READONLY'
  | 'TUPLE_REQUIRED'
  | 'TUPLE_EMPTY_PROJECTION'
  | 'TUPLE_CANNOT_PROJECT'
  | 'TUPLE_INVALID_SLICE_INDEX'
  | 'TUPLE_INVALID_SLICE_STEP'
  | 'TUPLE_INVALID_SLICE_ARITY'
  | 'TUPLE_SLICE_OUT_OF_RANGE'
  | 'TUPLE_INVALID_SLICE_RANGE'
  | 'LOOP_INVALID_BOUNDS_ARITY'
  | 'LOOP_INVALID_BOUND'
  | 'LOOP_INVALID_STEP'
  | 'LOOP_INVALID_RANGE'
```

`meta` 应当包含：

```ts
interface OneDiceErrorMeta {
  input?: string
  range?: { start: number; end: number }
  operator?: string
  feature?: string
  featureEnabled?: boolean
  syntax?: string
  expected?: string[] | number[]
  actual?: unknown
  limit?: number
  received?: unknown
  index?: number
  start?: number
  end?: number
  step?: number
  budgetKind?: string
  variable?: string
  availableVariables?: string[]
  hint?: string
}
```

错误码必须有稳定语义和浏览器 UI 行为：

| code | 触发条件 | `meta` 必须包含 | UI 应当展示 |
| --- | --- | --- | --- |
| `PARSE_UNEXPECTED_TOKEN` | lexer/parser 遇到当前位置不允许的 token | `range`、`actual`、`expected` | 高亮非法 token，并列出可输入内容 |
| `PARSE_UNEXPECTED_END` | 表达式提前结束 | `range`、`expected` | 高亮末尾，提示缺少右操作数或右括号 |
| `PARSE_UNSUPPORTED_SYNTAX` | 输入了已知但未启用的 V2/FVTT 语法 | `operator`、`hint` | 提示该语法需要开启对应模式或尚未实现 |
| `PROGRAM_EMPTY_STATEMENT` | `rollProgram()` 遇到空语句或尾随分号 | `range`、`actual` | 高亮空 statement，提示删除多余分号 |
| `DICE_INVALID_FACE_COUNT` | `d` 右侧面数小于 1、超过 10000 或非整数 | `operator`、`actual`、必要时 `limit` | 提示面数必须是 1 到 10000 之间的整数 |
| `DICE_INVALID_DICE_COUNT` | `d` 左侧骰数小于 1、超过 10000 或非整数 | `operator`、`actual`、必要时 `limit` | 提示骰数必须是 1 到 10000 之间的整数 |
| `DICE_INVALID_KEEP_COUNT` | `k/q/kh/kl/dh/dl` 数量小于 1 或超过可供选择项 | `operator`、`actual`、`limit` | 提示可供选择范围 |
| `DICE_INCOMPATIBLE_MODIFIERS` | `k/q` 与 `p/b` 混用 | `operator`、`actual` | 提示选取线和奖惩骰只能二选一 |
| `DICE_POOL_MODIFIER_EXCLUSIVE` | `a` 与其他 `d` modifier 混用 | `operator`、`actual` | 提示骰池模式必须独占 |
| `DICE_TOO_MANY_ROLLS` | 随机调用超出预算 | `limit`、`actual` | 提示降低骰数或提高预算 |
| `PERCENTILE_INVALID_BONUS_PENALTY_COUNT` | COC 奖励/惩罚骰数量非法 | `operator`、`actual` | 提示奖惩骰数量必须是非负整数 |
| `EVALUATION_BUDGET_EXCEEDED` | 求值步数、随机调用、循环次数或循环深度超限 | `budgetKind`、`actual`、`limit` | 提示减少表达式复杂度或提高对应预算 |
| `VARIABLE_NOT_FOUND` | 读取未定义变量 | `actual`、`range` | 提示变量需要先赋值 |
| `VARIABLE_INVALID_VALUE` | 变量、插值或 resolver 返回非有限数字 | `variable` 或 `actual`、`range` | 提示变量值必须是有限数字 |
| `VARIABLE_RESOLVER_FAILED` | FVTT resolver 抛出普通异常 | `variable`、`actual`、`range` | 提示宿主 resolver 失败，并展示原始异常摘要 |
| `VARIABLE_READONLY` | 写入只读变量，例如循环局部 `i` | `variable`、`range` | 提示该变量由运算符维护，不能赋值 |
| `TUPLE_REQUIRED` | tuple-only 运算收到标量输入 | `operator`、`range` | 提示先生成 tuple 或改用支持标量的语法 |
| `TUPLE_EMPTY_PROJECTION` | 空元组被投影成数字 | `operator`、`range` | 提示空元组没有可投影元素 |
| `TUPLE_CANNOT_PROJECT` | `identity` 元组被旧 API、resolver 或标量消费方消费 | `operator`、`range` | 提示使用 `roll()` 读取 `raw` |
| `TUPLE_INVALID_SLICE_INDEX` | `sp` 索引不是正整数 | `index`、`received` | 提示索引使用 1 基正整数 |
| `TUPLE_INVALID_SLICE_STEP` | `sp` 步长小于等于 0 | `step` | 提示步长必须是正整数 |
| `TUPLE_INVALID_SLICE_ARITY` | `sp` 参数数量不是 1、2 或 3 | `actual`、`expected` | 提示合法裁切形态 |
| `TUPLE_SLICE_OUT_OF_RANGE` | `sp` 索引超过 tuple 长度 | `index`、`limit` | 提示当前 tuple 长度和合法范围 |
| `TUPLE_INVALID_SLICE_RANGE` | `sp` 起始索引大于结束索引 | `start`、`end` | 提示调整裁切区间顺序 |
| `LOOP_INVALID_BOUNDS_ARITY` | `lp` 边界 tuple 参数数量不是 1、2 或 3 | `actual`、`expected` | 提示 `Nlp[body]`、`[start,end]lp[body]` 或 `[left,step,end]lp[body]` |
| `LOOP_INVALID_BOUND` | `lp` 边界值不是整数 | `index`、`received` | 提示所有循环边界必须是整数 |
| `LOOP_INVALID_STEP` | `lp` 步长小于等于 0 | `step` | 提示使用正整数步长 |
| `LOOP_INVALID_RANGE` | `lp` 起始值大于结束值 | `start`、`end`、`step` | 提示边界必须至少产生一轮循环 |

错误消息文本应当是面向人的英文或中文，但测试不得断言完整 `message`。测试必须断言 `code` 和关键 `meta` 字段，避免未来调整提示语导致测试脆弱。

### 运行时 Error 收敛清单

普通 `Error` 不得继续作为浏览器可见错误的主要出口。运行时错误应当按以下顺序收敛：

| 节点 | 需要收敛的错误 | 应当使用的错误码 | `meta` 必填字段 | 必测场景 |
| --- | --- | --- | --- | --- |
| `DNode` | 骰数小于 1、骰数超过 10000、面数小于 1、面数超过 10000、保留数量越界、modifier 混用 | `DICE_INVALID_DICE_COUNT`、`DICE_INVALID_FACE_COUNT`、`DICE_INVALID_KEEP_COUNT`、`DICE_INCOMPATIBLE_MODIFIERS`、`DICE_POOL_MODIFIER_EXCLUSIVE` | `operator`、`actual`、必要时 `limit` | `0d6`、`10001d1`、`1d0`、`1d10001`、`2d20k3`、`2d20k1p1`、`2d20a8k1` |
| `PNode` | 奖惩数量为负或非整数、预算耗尽 | `PERCENTILE_INVALID_BONUS_PENALTY_COUNT`、`DICE_TOO_MANY_ROLLS` | `operator`、`actual`、必要时 `limit` | `p-1`、`b-1`、预算小于候选十位数量 |
| `ANode` | 骰数缺失、面数小于 2、阈值小于 1、预算耗尽 | `DICE_INVALID_DICE_COUNT`、`DICE_INVALID_FACE_COUNT`、`DICE_INVALID_KEEP_COUNT`、`DICE_TOO_MANY_ROLLS` | `operator`、`actual`、`limit` | `a` 参数缺失、`1a1`、无限加骰预算耗尽 |
| `CNode` | 骰数缺失、面数小于 2、目标数量小于 1、预算耗尽 | `DICE_INVALID_DICE_COUNT`、`DICE_INVALID_FACE_COUNT`、`DICE_INVALID_KEEP_COUNT`、`DICE_TOO_MANY_ROLLS` | `operator`、`actual`、`limit` | `c` 参数缺失、`1c1`、双十字预算耗尽 |
| `FNode` | FATE 骰数量小于 1、预算耗尽 | `DICE_INVALID_DICE_COUNT`、`DICE_TOO_MANY_ROLLS` | `operator`、`actual`、`limit` | `0f`、预算小于 FATE 骰数量 |
| `InterpolationNode` | `{env}` 缺失或 env 表达式非法 | `VARIABLE_NOT_FOUND` 或透传 parser/evaluation 错误 | `actual`、`range`、`hint` | `{attack}` 缺失、`{attack}` 内部表达式预算耗尽 |
| `SimpleNode` / `UnaryNode` | 未知运算符 | `PARSE_UNSUPPORTED_SYNTAX` 或内部不可达错误 | `operator` | parser 不应产生未知运算符；测试应覆盖防御分支 |

迁移规则：

- 每次替换普通 `Error` 时，必须同时新增或更新失败测试。
- 测试必须使用 `toThrow(OneDiceError)` 或捕获后断言 `error.code`，不得只检查 `message`。
- `meta.hint` 应当面向 UI，写成用户能采取的修复动作，例如“减少骰子数量或提高 maxRandomCalls”。
- 对旧 API `dice()`，错误类型也必须是 `OneDiceError`，不得只在 `roll()` 中结构化。
- 如果某个错误只能由内部 bug 触发，应当保留为内部 invariant，并在注释中说明 parser 正常情况下不会产生该节点状态。

### 诊断应当区分 fatal 和 non-fatal

错误会中断求值；诊断必须随成功结果继续返回：

```ts
interface RollDiagnostic {
  code: string
  severity: 'info' | 'warning'
  message: string
  range?: { start: number; end: number }
  feature?: string
  original?: string
  normalized?: string
}
```

诊断码必须稳定，并且必须按“类型字段 -> 产生位置 -> README 展示 -> 测试断言”的顺序公开。当前已经实现并公开使用的第一阶段诊断码只有下列条目：

| code | severity | 产生位置 | 必须包含的字段 | 浏览器 UI 应当如何使用 |
| --- | --- | --- | --- | --- |
| `SYNTAX_NORMALIZED` | `info` | `features.fateAlias` 下的 `df` 归一化，或 `syntax: 'fvtt-compatible'` 下的 FVTT 池归一化 | `range`、`feature`、`original`、`normalized`、`message` | 展示“输入被兼容改写”的非阻塞提示，并用 `range` 高亮原始片段；不得把它当作错误 |

以下诊断码属于后续扩展方向，只有在 `src/trace.ts`、README、ADR 和测试同时定义后才能进入公开合同。当前实现不得返回这些 code，README 示例不得读取这些 code，浏览器 UI 不得把它们写成已存在分支：

| code | severity | 应当先定义的技术合同 | 不得提前做的事 |
| --- | --- | --- | --- |
| `FEATURE_FLAG_REQUIRED` | `warning` | 与 `PARSE_UNSUPPORTED_SYNTAX` 的边界、是否 fatal、`meta.feature` 与 diagnostic `feature` 的关系、默认模式 UI 文案 | 不得把未开启 feature 的 fatal parse error 静默降级为成功结果 |
| `COMPATIBILITY_PROJECTION` | `info` | `dice()` 标量投影触发条件、`raw.projection` 对照、旧 API 是否需要提示、测试是否覆盖 tuple/project/slice | 不得让旧 `dice()` 调用方因为 info diagnostic 改变返回形态 |
| `BUDGET_NEAR_LIMIT` | `warning` | 阈值公式、预算类型、是否按随机调用/求值步数/循环次数分别触发、是否允许同一次结果多条 warning、README 展示方式 | 不得在未实现阈值和测试前让 UI 依赖 near-limit 提醒 |

示例：

- 使用 FVTT 兼容模式时，把 `{4d6,3d8}kh` 归一化为内部元组，必须产生 `SYNTAX_NORMALIZED` 诊断。
- 用户输入 `df`，内部解析为 `f`，必须产生 `SYNTAX_NORMALIZED` 诊断。
- 用户输入未来暂不支持的爆骰，应当抛 `PARSE_UNSUPPORTED_SYNTAX`，不得偷偷忽略。
- 用户输入超大表达式时，当前必须依赖 `EVALUATION_BUDGET_EXCEEDED` 中断求值；near-limit warning 不得作为当前验收条件。

## 语法与解析器改造方案

### 当前生成式应当保守演进

当前语法由 `utils/grammar.yaml` 生成 `src/parser/grammar.json` 和 `src/parser/table.json`。后续任何语法改动必须满足：

- 先改 `utils/grammar.yaml`。
- 再运行生成器更新生成文件。
- 生成文件必须和源语法一起提交。
- 每个新增 operator 必须有 parse 测试和 eval 测试。
- 不得手工编辑 `table.json`。

### 语法阶段拆分

语法应当按阶段引入：

#### 阶段 G1：V1 修正

只处理当前已有语法：

- `d` modifier 互斥校验
- `p/b` 百分骰修正
- `df` alias 已通过 `features.fateAlias` 实现；后续只允许补漏测试和文档，不得改为默认语法

`df` 已采用 lexer 归一化方案实现。后续维护必须保持单一路径，不得再新增第二套 parser 或 AST 解释：

1. lexer 在 `features.fateAlias` 开启时把 `df` token 归一化为 `f`。
2. `EvaluationContext.diagnostics` 必须记录 `SYNTAX_NORMALIZED`，包含 `range`、`feature='fateAlias'`、`original='df'` 和 `normalized='f'`。

由于 `d` 与 `f` 都是现有 token，`df` 必须继续由 lexer 整体识别并受 `features.fateAlias` 控制，避免把 `1dfoo` 误拆成 `1d` + `f`。

`df` 的测试必须至少覆盖：

| 表达式 | 期望 |
| --- | --- |
| `4df` | 与 `4f` 数值、trace 骰数一致 |
| `df` | 使用 `f` 的缺省骰数和面数 |
| `1dfoo` | 不得被误识别为 `1d` 后接 `f` |
| `2d6f` | 抛 `PARSE_UNEXPECTED_TOKEN` 或明确的 unsupported syntax |

#### 阶段 G2：元组字面量

应当新增 `TupleNode`，不要复用 `BracketNode`。小括号和元组必须分离：

```text
ParenthesizedExpression = "(" Expression ")"
TupleExpression = "[" Expression ("," Expression)* "]"
```

AST：

```ts
class TupleNode implements DiceNode<TupleTrace> {
  constructor(public items: DiceNode[]) {}
}
```

`TupleNode` 的旧标量投影应当返回最后一个元素的标量值；新 `raw` 应当保留所有元素。

G2 的落地必须按以下顺序执行，不能只改 parser：

1. **lexer**：`[`、`]`、`,` 在默认 `features.tupleLiterals=false` 时必须继续抛 `PARSE_UNSUPPORTED_SYNTAX`；启用后才作为 token 进入 parser。错误 `meta` 必须包含 `feature='tupleLiterals'`、`operator='['` 或具体符号、`featureEnabled=false`。
2. **grammar**：应当在 `utils/grammar.yaml` 中新增 tuple 产生式，再运行生成器更新 `src/parser/grammar.json` 和 `src/parser/table.json`。不得手改生成文件。
3. **AST resolve**：应当新增 `TupleNode` 并在 `src/ast/index.ts` 中只处理明确的 tuple 产生式。逗号列表应当保持源码顺序，不得在 resolve 阶段求值或排序。
4. **求值**：`TupleNode.evaluate(context)` 应当顺序求值每个子节点，共享同一个 `EvaluationContext`，并把每个子结果保存为 `RollValue` item。
5. **旧 API 投影**：`dice('[1,2,3]', { features: { tupleLiterals: true } })` 应当返回最后一项的标量值 `3`，不得返回数组或改变旧 API 返回类型。
6. **新 API raw**：`roll('[1,2,3]', ...)` 应当返回 `raw.kind='tuple'`、`raw.source='literal'`、`raw.projection='last'`、`raw.items.length=3`。
7. **trace**：`trace.kind='tuple'`，`trace.items` 必须保留每个元素的子 trace，`range` 必须覆盖完整 `[1,2,3]`。

G2 必测矩阵：

| 表达式 | 配置 | 期望 |
| --- | --- | --- |
| `[1,2,3]` | 默认 | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='tupleLiterals'` |
| `[1,2,3]` | `tupleLiterals=true` | `dice()` 返回 `3`，`roll().raw.items=[1,2,3]` |
| `[]` | `tupleLiterals=true` | 抛 `TUPLE_EMPTY_PROJECTION` 或 parser 明确拒绝空元组，二者必须先写入 ADR |
| `[1,2d6,3]` | 固定随机数 | 第二项必须消耗随机预算，并在 trace 中保留 `randomCall` |
| `[1,(2+3),4]` | `tupleLiterals=true` | 小括号只影响第二项，不得被误当作 tuple |
| `[1,2,]` | `tupleLiterals=true` | 抛 `PARSE_UNEXPECTED_TOKEN`，`meta.range` 指向尾随逗号或右括号 |

#### 阶段 G3：后缀/中缀元组运算符

`kh/kl/dh/dl/tp` 更适合作为后缀或低右结合运算：

```text
TupleOpExpression =
  Primary TupleOperator [Count]
```

`min/max/sp/lp` 更像中缀运算：

```text
ClampExpression = Expression ("min" | "max") Expression
SliceExpression = Expression "sp" SliceSpec
LoopExpression = LoopSpec "lp" TupleExpression
```

优先级必须写入文档和测试。初始应当采用上游 #3 描述：

- `kh/kl/dh/dl` 优先级应当高于普通加减乘除。
- `2d20kl` 应当操作 `2d20` 的骰子元组，而不是操作最终和。
- 如果实现上无法直接表达“介于 `^` 与 `d` 之间”，应当通过 AST 的 `tupleHint` 或 `consumeTuple()` 机制实现，而不是扭曲普通算术优先级。

#### 阶段 G4：多语句

多语句不得混入默认表达式解析器。应当新增 API：

```ts
rollProgram('$0e(2d6);($0>10)?(2d8):($0)')
```

默认 `dice()` 不应当自动接受 `;`，除非进入显式兼容模式。

## 测试方案

### 测试工具

仓库应当引入 Vitest：

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "build": "tsup src/index.ts --format esm,cjs --dts"
  }
}
```

若 M0 尚未引入 `tsup`，构建脚本应当临时使用 `tsc`；进入浏览器 ESM 阶段时必须补上 dual output。

### 随机数测试工具

必须提供测试用随机源：

```ts
export function sequenceRandom(values: number[]) {
  let index = 0

  return (min: number, max: number) => {
    if (index >= values.length) {
      throw new Error(`random sequence exhausted at ${index}`)
    }

    const value = values[index++]
    if (value < min || value > max) {
      throw new Error(`random value ${value} outside [${min}, ${max}]`)
    }

    return value
  }
}
```

该工具应当检查范围，避免测试误把 `0` 传给 `d20` 这种非法随机值。

### 测试目录结构

测试应当按语义组织：

```text
test/
  helpers/
    random.ts
  v1/
    arithmetic.test.ts
    dice-d.test.ts
    dice-pb.test.ts
    dice-a.test.ts
    dice-c.test.ts
    dice-f.test.ts
    interpolation.test.ts
  issues/
    issue-009-d-limits.test.ts
    issue-010-percentile-bonus-penalty.test.ts
    issue-011-d-notation.test.ts
  browser/
    vite-import.test.ts
  v2-design/
    tuple-projection.test.ts
```

### V1 必测用例

#### 算术

| 表达式 | 随机 | 期望 |
| --- | --- | --- |
| `1+2*3` | 无 | `7` |
| `(1+2)*3` | 无 | `9` |
| `2^3` | 无 | `8` |
| `-1+3` | 无 | `2` |
| `8/3` | 无 | `2` |
| `-8/3` | 无 | `-2` |
| `8/-3` | 无 | `-2` |

注意：上游文档写 `/` 只取整数部分；本仓库应当使用 `Math.trunc(left / right)` 语义，而不是 `Math.floor()` 或 JavaScript 原生浮点除法。测试必须覆盖正数、负数和除数为负的场景，用来锁定“向 0 截断”。

#### `d`

| 表达式 | 随机序列 | 期望 |
| --- | --- | --- |
| `2d6` | `[2,5]` | `7` |
| `2d6k1` | `[2,5]` | `5` |
| `2d6q1` | `[2,5]` | `2` |
| `d6` | `[4]` | `4` |
| `2d1` | `[1,1]` | `2` |
| `1d10000` | `[9999]` | `9999` |
| `10000d1` | `10000 个 1` | `10000` |
| `10001d1` / `1d10001` | 不应消耗随机 | 抛结构化语义上限错误，且 `meta.limit=10000` |

#### `p/b`

应当按 #10 的表格补齐，并额外验证 trace：

| 表达式 | 随机序列 | 期望 `value` | trace 必须包含 |
| --- | --- | --- | --- |
| `b0` | `[0,0]` | `100` | `candidates=[{tens:0,value:100}]` |
| `b1` | `[3,8,2]` | `23` | `baseTens=8`、`extraTens=[2]`、`selectedTens=2` |
| `p1` | `[3,2,8]` | `83` | `baseTens=2`、`extraTens=[8]`、`selectedTens=8` |
| `b1` | `[0,0,1]` | `10` | 候选值同时出现 `100` 和 `10` |
| `p1` | `[0,1,0]` | `100` | 惩罚骰按最终百分值选择 `00` |

测试不得只断言最终数值。浏览器需要解释“为什么奖励骰没有选择 00”，因此 `candidates`、`selectedTens` 和 `mode` 都必须断言。

#### `a/c/f`

应当覆盖：

- 无限加骰池停止条件。
- 双重十字最后一轮最大值。
- FATE 骰 `-1/0/1` 映射。
- `df` alias 若进入当前阶段，必须与 `f` 行为完全一致。

### 浏览器测试

浏览器阶段应当有两个层次：

1. **打包测试**
   - 使用 Vite 创建临时项目或 fixture。
   - `import { dice } from '../dist/index.mjs'`。
   - 执行一次确定性表达式。
   - 同时 import `roll`、`OneDiceError`、`projectToNumber`，保证 `.d.ts` 与 ESM 导出一致。
   - 断言页面或 bundle 运行结果包含 `result.raw.kind`，而不只是最终数值。

2. **运行时测试**
   - 在 `happy-dom` 或 Playwright 中运行一个最小页面。
   - 验证没有 `process`、`Buffer`、`fs` 等 Node-only 依赖。
   - 验证 `JSON.stringify(result.trace)` 不抛错。
   - 验证错误对象能够被浏览器 UI 按 `error.code` 分支处理。

浏览器测试不得访问真实网络，不得依赖用户本机浏览器登录态。fixture 应当使用本地 `dist/` 输出，确保测试覆盖的正是即将发布的包形态。

## 构建与发布方案

### 包输出

最终 `package.json` 应当达到：

```json
{
  "name": "@onedice/core",
  "version": "1.0.2-browser.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "files": [
    "dist"
  ],
  "sideEffects": false
}
```

如果保持 `"type": "commonjs"`，则应当确保 CJS/ESM 文件扩展明确，不依赖 Node 的默认推断。

### 构建工具

当前仓库应当采用 `tsup` 作为主构建路径。`tsc` 双配置只能作为退路，用于 `tsup` 因依赖或平台问题不可用时保持最小发布能力。

#### 路径 A：tsup

优点：

- dual ESM/CJS 配置成本低。
- `.d.ts` 生成方便。
- 适合库项目。

脚本：

```json
{
  "build": "tsup src/index.ts --format esm,cjs --dts --clean --sourcemap"
}
```

#### 路径 B：tsc 双配置

优点：

- 依赖更少。
- 更保守。

缺点：

- CJS/ESM 双输出配置更繁琐。
- 包装 JSON 和扩展名处理更容易出错。

鉴于本项目目标是浏览器使用，首选应当是 `tsup` 或 Rollup。不得为了少一个开发依赖而牺牲浏览器集成稳定性。

### 发布前检查

发布前必须通过：

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

`npm pack --dry-run` 应当确认只包含：

- `dist`
- `README.md`
- `LICENSE`（如果加入）
- `package.json`

不得发布 `src/parser/table.json` 以外的无关开发缓存；如果发布源码，应当明确原因。

### 发布字段验收

发布前必须逐项检查 `package.json` 字段，而不是只看构建成功：

| 字段 | 必须满足 |
| --- | --- |
| `main` | 指向 CJS 文件，文件必须存在且可 `require()` |
| `module` | 指向 ESM 文件，文件必须存在且可被 Vite 消费 |
| `types` | 指向 `.d.ts`，必须导出 `dice`、`roll`、错误类型和值模型类型 |
| `exports["."].import` | 与 `module` 保持一致 |
| `exports["."].require` | 与 `main` 保持一致 |
| `files` | 只包含发布产物；不得把 `test/`、`docs/`、`src/`、`node_modules/` 发出去 |
| `sideEffects` | 库保持纯函数入口时应当为 `false`；如果未来加入全局注册逻辑，必须先写 ADR |

浏览器目标发布不得隐式依赖 `process.env`、`Buffer`、`global`、`fs`、`path` 或动态 `require()`。如果构建产物中出现这些符号，必须在发布前解释来源并修复或隔离到 Node 专用入口。

## 结构化 Trace 设计

浏览器应用通常需要展示过程，而不仅是数字。Trace 应当成为新 API 的核心能力。

### 通用 Trace

```ts
interface RollTrace {
  kind: string
  expression: string
  range?: { start: number; end: number }
  value: number
  children?: RollTrace[]
}
```

通用 trace 必须满足：

- `kind` 必须是稳定枚举值，不得使用类名或构造函数名。
- `expression` 必须保存该节点对应的源文本片段，供 UI 展示。
- `range` 应当保存源表达式中的字符区间，供编辑器高亮；如果当前 parser 尚不能提供范围，应当在 ADR 中记录补齐路径。
- `children` 必须按实际求值顺序排列，不能按 AST 字段声明顺序随意排列。
- `value` 必须是该节点的标量投影结果；如果节点 `raw` 是 tuple，必须通过 `projection` 或子 trace 解释投影来源。

### 普通骰 Trace

```ts
interface DiceTrace extends RollTrace {
  kind: 'dice'
  operator: 'd'
  diceCount: number
  faceCount: number
  rolls: DiceRollTrace[]
  modifiers: DiceModifierTrace[]
}

interface DiceRollTrace {
  index: number
  value: number
  selected: boolean
  dropped: boolean
  randomCall: number
  source: 'base' | 'bonus' | 'penalty' | 'exploded' | 'rerolled'
}
```

普通骰 trace 的排序必须保留“结果展示顺序”和“求值消耗顺序”的关系：

- `index` 表示该骰子在原始投掷序列中的 0 基下标。
- `randomCall` 表示本次求值中第几次调用随机源。
- `rolls` 应当默认按原始投掷顺序保存；如为了 UI 展示按最终选择排序，必须保留 `index`，防止 UI 无法复原原始顺序。
- `selected` 与 `dropped` 不得同时为 `true`；普通未参与选择逻辑的骰子应当 `selected: true, dropped: false`。
- `modifiers` 必须记录 `k/q/a/p/b` 的解析结果、缺省数量和互斥判断。

### 奖惩骰 Trace

```ts
interface PercentileTrace extends RollTrace {
  kind: 'percentile'
  mode: 'bonus' | 'penalty'
  ones: number
  baseTens: number
  extraTens: number[]
  candidates: Array<{ tens: number; value: number }>
  selectedTens: number
  value: number
}
```

奖惩骰 trace 必须把“十位候选”和“最终百分值”分开：

- `baseTens`、`extraTens` 均使用 `0..9` 表示十位骰面，UI 可渲染为 `00, 10, ..., 90`。
- `ones` 使用 `0..9` 表示个位。
- `candidates` 必须包含基础十位和所有追加十位对应的最终百分值。
- `selectedTens` 必须是根据 `percentileValue(tens, ones)` 比较后的十位，而不是仅对十位数字取 `min/max`。
- `00 + 0 => 100` 必须在 `candidates` 中可见。

### 元组 Trace

```ts
interface TupleTrace extends RollTrace {
  kind: 'tuple'
  items: RollTrace[]
  projection: 'last' | 'sum' | 'identity'
  selected?: boolean[]
  dropped?: boolean[]
}
```

元组 trace 必须服务后续 `kh/kl/dh/dl/sp/tp/lp`：

- `items` 必须保留每个成员的 trace。
- `selected` 和 `dropped` 数组长度必须与 `items` 一致；没有选择语义时应当省略。
- `projection` 必须解释 `value` 如何从 `items` 得到。
- `tp` 必须把上一级节点的 tuple 原样暴露到 `raw`，不得重新求值。
- `sp` 必须在 trace 中保留原始索引和裁切后的索引，避免 UI 无法解释为什么某些项消失。

Trace 设计要求：

- 必须能序列化为 JSON。
- 不得包含循环引用。
- 不得要求浏览器 UI 解析 `toString()`。
- 旧 `toString()` 应当保留为人类调试辅助，但不得成为任何新 UI 的数据源。
- 不得在 trace 中保存 `DiceNode` 实例、函数、随机源或上下文对象。
- 必须为 trace 增加 JSON 序列化测试：`JSON.parse(JSON.stringify(result.trace))` 后仍保留关键字段。

## V2 元组与运算符方案

### 元组来源

元组应当来自三类表达式：

1. 显式元组：`[1,2,3]`
2. 骰子节点的内在结果：`2d20` 可暴露 `[roll1, roll2]`
3. 循环或投影节点：`lp`、`tp`、`sp`

### 元组消费协议

每个节点应当声明自己如何消费左值：

```ts
type ConsumptionMode = 'scalar' | 'tuple-preferred' | 'tuple-required'
```

示例：

| 运算符 | 消费模式 | 说明 |
| --- | --- | --- |
| `+` | scalar | 左右值投影为数字 |
| `d` | scalar | 左右值作为骰数/面数 |
| `kh` | tuple-preferred | 如果左侧有元组则用元组，否则包装成单元素元组 |
| `sp` | tuple-required | 左侧必须可转换为元组 |
| `tp` | tuple-preferred | 强制暴露上级节点元组 |

这样 `2d20 + 1` 与 `2d20kh1` 能够共存：

- `2d20 + 1` 使用 `2d20` 的标量和。
- `2d20kh1` 使用 `2d20` 的骰子元组。

### `kh/kl/dh/dl`

语义应当固定：

| 运算符 | 排序 | 动作 | 等价直觉 |
| --- | --- | --- | --- |
| `khN` | 降序 | 保留前 N 个 | 取最大 N 个 |
| `klN` | 升序 | 保留前 N 个 | 取最小 N 个 |
| `dhN` | 降序 | 丢弃前 N 个 | 丢弃最大 N 个 |
| `dlN` | 升序 | 丢弃前 N 个 | 丢弃最小 N 个 |

结果标量应当是保留项之和；`raw` 应当保留被选中和被丢弃的标记。

选择/丢弃运算符必须固定排序和并列规则，避免浏览器回放结果不稳定：

- 排序比较值必须使用每个 item 的标量投影。
- 值相等时必须按原始 tuple index 升序作为稳定 tie-breaker。
- `kh`/`kl` 的默认数量应当为 `1`。
- `dh`/`dl` 的默认数量应当为 `1`。
- 数量必须是整数，`0`、负数、非整数和超过 item 数量都必须抛稳定错误。
- `selected` 和 `dropped` 必须互斥；未被丢弃的 item 才能进入结果标量求和。
- `trace` 必须保存 `operator`、`count`、`inputLength`、`selectedIndexes`、`droppedIndexes`。

实现不得复用 V1 `k/q` 的内部排序副作用。V1 `2d20k1` 是普通 `DNode` modifier；V2 `2d20kh1` 是 tuple operator。两者即便得到相同数值，trace、raw 和错误码合同也必须分开。

示例：

```text
[2, 7, 4]kh1 = 7
[2, 7, 4]kl1 = 2
[2, 7, 4]dh1 = 2 + 4 = 6
[2, 7, 4]dl1 = 7 + 4 = 11
```

### `min/max`

OneDice 上游示例把 `min/max` 描述为“限制最大/最小”：

```text
5min6 = 6
7min6 = 7
5max6 = 5
7max6 = 6
```

因此命名虽然容易和 `Math.min/max` 直觉相反，实现时必须按标准语义：

- `AminB`：将 A 中低于 B 的值提升到 B。
- `AmaxB`：将 A 中高于 B 的值降低到 B。

对元组：

```text
[7,4]max5 = [5,4]
[2d6,10,8]min5 = 每项低于 5 则改为 5
```

实现时应当把 clamp 写成独立节点，而不是把字符串 `min/max` 映射到 `Math.min/Math.max`：

- `ClampNode.operator` 必须是 `'min' | 'max'`。
- 左右值都应当先求出 `RollValue`，再按 consumption mode 决定标量或逐项处理。
- 左侧为 tuple 时，右侧标量应当逐项应用；右侧为 tuple 时必须先由 ADR 决定是否 zip、广播或拒绝。
- trace 应当记录 `before`、`limit`、`after`，tuple 模式还应当记录每个 item 的 clamp 前后值。
- `min/max` 不得改变随机调用顺序；它只能消费已经求值的子表达式结果。
- 文档和测试必须同时覆盖与 `Math.min/max` 直觉相反的例子：`5min6=6`、`7max6=6`。

### `tp`

`tp` 应当是“强制使用元组结果”的后缀运算符。

示例：

```text
3d100      -> 标量为三个骰子之和
3d100tp    -> raw 为 [r1, r2, r3]
```

旧 `dice('3d100tp')` 如果必须返回 number，应当采用文档化投影。新 `roll()` 应当保留 tuple。

`tp` 的关键风险是二次求值。实现必须保证：

- `tp` 只能读取左侧节点已经产生的 `RollValue`，不得重新执行左侧表达式。
- `roll('3d100tp')` 的随机调用次数必须与 `roll('3d100')` 完全一致。
- `trace.kind='tuple-projection'` 应当记录 `sourceKind`、`sourceRange`、`items.length` 和 `projection='identity'` 或 ADR 确定的公开名称。
- 如果左侧没有 tuple raw，`tp` 应当按 ADR 决定包装单元素 tuple 或抛 `TUPLE_REQUIRED`；决定前必须通过 feature flag 拒绝。

### `sp`

`sp` 应当做元组裁切。ADR-007 已经把索引合同固化为 1 基索引、双参数闭区间、三参数 `[leftBoundary, step, end]` 和越界抛错；后续只能按该 ADR 补漏，不得重新引入 0 基索引、负索引或静默空结果。

`sp` 的行为合同必须保持：

| 表达式 | 期望 raw / value | 技术含义 |
| --- | --- | --- |
| `[1,2,3]sp[1]` | raw 为单元素 tuple `[1]`，旧 API value 为 `1` | 单索引不丢失 tuple raw |
| `[1,2,3,4,5]sp[2,4]` | raw `[2,3,4]`，value `9` | 双参数包含右边界 |
| `[1,2,3,4,5,6]sp[1,2,5]` | raw `[2,4]`，value `6` | 第一个参数是左边界，第二个参数是步长，结果从 `leftBoundary + step - 1` 对应项开始 |
| `2d6sp[1,2]` | raw 保留两颗骰子的原始顺序 | 普通骰子的隐式 tuple 可被裁切 |
| `5sp[1]` | `TUPLE_REQUIRED` | `sp` 左侧必须是 tuple，不做标量包装 |

`sp` 的错误合同必须稳定：

| 表达式 | 错误码 | `meta` 必填字段 |
| --- | --- | --- |
| `[1,2,3]sp[0]` | `TUPLE_INVALID_SLICE_INDEX` | `index=0`、`range` |
| `[1,2,3]sp[-1]` | `TUPLE_INVALID_SLICE_INDEX` | `index=-1`、`range` |
| `[1,2,3]sp[2,1]` | `TUPLE_INVALID_SLICE_RANGE` | `start=2`、`end=1` |
| `[1,2,3,4]sp[1,0,4]` | `TUPLE_INVALID_SLICE_STEP` | `step=0` |
| `[1,2,3]sp[4]` | `TUPLE_SLICE_OUT_OF_RANGE` | `index=4`、`limit=3` |
| `[1,2,3]sp[1,2,3,4]` | `TUPLE_INVALID_SLICE_ARITY` | `actual=4`、`expected=[1,2,3]` |

`sp` trace 必须能让 UI 解释“保留了哪些元素”：`sourceIndexes`、`resultIndexes`、`start`、`end`、`step`、`inputLength` 和 `arity` 都应当稳定暴露。

### `lp`

`lp` 是高风险运算符，因为它可能造成大量求值。当前实现必须继续受 `maxRandomCalls`、`maxEvaluationSteps`、`maxLoopIterations` 和 `maxLoopDepth` 共同约束。

循环标识应当支持：

| 左值 | 含义 |
| --- | --- |
| `X` | 从 1 到 X，步进 1 |
| `[X]` | 同 `X` |
| `[X,Y]` | 从 X 到 Y，步进 1 |
| `[X,Y,Z]` | 从 X 到 Z，步进 Y |

循环体必须是元组。循环变量 `i` 应当进入 `EvaluationContext.variables`，不得作为全局变量污染宿主应用。

`lp` 必须作为高风险能力隔离实现：

- 默认 `features.loopOperator=false` 时，lexer 必须把 `lp` 识别为未来语法并抛 `PARSE_UNSUPPORTED_SYNTAX`。
- 启用后必须同时检查 `maxEvaluationSteps`、`maxRandomCalls` 和 `maxLoopIterations`。
- 循环每次迭代必须创建子作用域，`i` 只在循环体内可见。
- 循环体每个元素的 trace 必须记录 `iteration`、`i`、`range` 和子表达式 trace。
- 预算耗尽必须抛 `EVALUATION_BUDGET_EXCEEDED`，`meta` 必须包含 `budgetKind`、`actual`、`limit`。
- 如果循环边界来自 tuple，必须在进入循环前一次性求值边界，不得每轮重新求值边界表达式。

必须有保护：

- 最大循环次数。
- 最大随机调用数。
- 最大求值步数。
- 嵌套循环深度。

## 变量、多语句与移动端输入

### 多语句

上游 #3 提到 `;` 分割多个语句，最终结果取最后一行。实现时应当新增程序层：

```ts
interface ProgramResult {
  value: number
  statements: RollResult[]
  variables: Record<string, RollValue>
}
```

API：

```ts
rollProgram('$0e(2d6);($0>10)?(2d8):($0)')
```

`dice()` 不应当默认接受 `;`，否则会扩大旧 API 的语法面并增加歧义。

### 变量标记

变量标记必须通过设计决议确定。候选：

| 标记 | 来源 | 优点 | 风险 |
| --- | --- | --- | --- |
| `$0` | #3 讨论 | 与寄存器直觉一致 | Android QQ 中 `$` 可能触发礼物 UI |
| `$tA` | 上游标准文档 | 与临时变量章节一致 | 输入较长 |
| `@name` | FVTT/移动端讨论 | 移动端可能更易输入，FVTT 用户熟悉 | 与 OneDice 原语法可能产生新习惯分裂 |
| `{name}` | 当前 `env` 插值 | 已实现 | 与 FVTT 池 `{}` 冲突 |

执行规则：

- 默认 OneDice 模式应当只启用一种原生变量标记。
- FVTT 兼容模式应当启用 `@path`，默认 OneDice 模式不得启用。
- 不得同时默认支持 `$0` 和 `@0` 作为等价写法。
- 如需支持多个标记，必须通过 `syntax` 或 `features` 显式开启。

## FVTT 兼容模式

FVTT 兼容应当是“模式”或“适配层”，不得直接污染 OneDice 默认语法。

### API

```ts
roll('{4d6,3d8,2d10}kh', {
  syntax: 'fvtt-compatible',
  env: {
    'abilities.str.mod': '3',
  },
})
```

### 第一阶段兼容范围

应当只实现与 #3 直接相关且风险较低的能力：

- `{a,b,c}` 池/元组输入
- `@path.to.data` 变量查找
- `kh`、`kl`、`dh`、`dl`
- `min`、`max`

### 暂不实现范围

不得在第一阶段实现：

- 爆骰
- 递归重骰
- 成功/失败计数
- 复杂数学函数
- Foundry 特有 roll mode
- 与 Foundry actor/item 数据模型耦合的功能

这些能力必须在后续作为单独 feature flag 处理：

```ts
features: {
  // 名称必须在 ADR 中最终确认；不得复用已实现的 fvttSuccessCounting。
  fvttExplode: false,
  fvttReroll: false,
  fvttFailureCounting: false,
}
```

## 里程碑计划

### M0：项目卫生与测试基础

目标：所有后续改动都应当有可运行的测试和构建入口。

当前状态：完成证据已经建立。`package.json` 已提供 `test`、`typecheck`、`build` 和 `test:browser`；`package-lock.json` 已成为 npm 安装的锁定依据；`test/helpers/random.ts` 已提供确定性随机源；`test/v1` 与 `test/issues` 已成为行为回归入口。后续只能补充同级测试、脚本说明或 CI 验收，不得替换测试框架，也不得借 M0 名义引入语法能力。

必须完成：

- 添加 `test`、`typecheck`、`build` 脚本。
- 引入测试框架。
- 添加随机序列测试 helper。
- 添加最小算术测试。
- 添加最小 `d` 测试。
- 保证 `npm test` 能够在 CI/本机无浏览器交互环境运行。

不得完成：

- 不得在 M0 引入 V2 语法。
- 不得修改 `dice()` 返回类型。

验收：

```bash
npm install
npm run typecheck
npm test
```

验收证据必须包括：

- `package-lock.json` 与 `package.json` 一致。
- `npm test` 覆盖 `test/v1` 和 `test/issues`。
- 测试 helper 会校验随机数是否落在 `[min, max]` 内。
- CI 或本地命令不要求打开浏览器窗口。

### M1：V1 标准回归测试

目标：把当前 V1 行为和上游已关闭议题固化成测试。

当前状态：完成证据已经建立。#9、#10、普通 `d`、奖惩骰和算术路径已经由确定性测试覆盖，测试不得依赖真实 `Math.random()`。后续任何 V1 行为修正都必须先在同级测试文件中加入失败用例，再修改实现；新增错误测试必须断言 `OneDiceError.code/meta`，不得只断言 message。

必须完成：

- `issue-009-d-limits.test.ts`
- `issue-010-percentile-bonus-penalty.test.ts`
- `dice-d.test.ts`
- `dice-pb.test.ts`
- `arithmetic.test.ts`

验收：

- #9 和 #10 有明确测试。
- 如果测试暴露当前行为不符合上游，先提交测试或在 PR 描述中标明失败原因，再修实现。
- 每个 issue 测试文件必须在文件名和 `describe()` 中写明上游 issue 编号。
- 测试不得依赖 `Math.random()`。
- 错误测试必须断言 `OneDiceError.code`，不得只断言 message。

### M2：修正上游已关闭决议

目标：使实现符合 #9、#10。

当前状态：完成证据已经建立。#9 的 `10000` 语义上限、`maxRollCount` 兼容映射、显式 `maxRandomCalls` 运行预算、`maxRandomCalls` 优先于 `maxRollCount` 的配置规则、`p/f/a/c` 骰子族显式随机预算优先级、显式预算高于旧默认 `10000` 时不被旧预检查截断、#10 的 COC 百分骰候选规则、`00+0=>100` 和整数除法截断语义已经进入测试合同。后续改动必须保持语义上限与运行预算分离，并继续把百分骰候选生成、候选选择和 trace 字段作为可单独测试的稳定路径。

必须完成：

- 修正 `PNode` 百分骰计算。
- 明确 `maxRollCount`、`maxRandomCalls` 与 `d` 左右值关系；两者同时传入时 `maxRandomCalls` 必须优先。
- `/` 必须按上游“整数除法”处理，正负数结果应当使用 `Math.trunc(left / right)` 语义。

验收：

- #9/#10 测试全部通过。
- `test/issues/issue-009-d-limits.test.ts` 必须覆盖 `d`、`p/f/a/c` 的 `maxRandomCalls` 预算错误、`maxRandomCalls` 优先级和旧 `maxRollCount` 兼容路径。
- `test/v1/evaluation-context.test.ts` 必须直接锁定 `attachEvaluationContext()` 的兼容桥接：低显式 `maxRandomCalls` 保持旧 `maxRollCount` 预检查默认地板但实际预算仍按显式值执行；高显式 `maxRandomCalls` 必须抬高旧 `maxRollCount`，避免 `p/f/a/c` 被旧默认预检查截断。
- 旧表达式测试不回退。
- 变更记录说明奖惩骰边界行为。
- `8/3` 必须得到 `2`。
- `-8/3` 必须得到 `-2`，用于锁定 `Math.trunc` 而不是 `Math.floor`。
- `00 + 0 => 100` 必须同时出现在值测试和 trace 测试中。

### M3：`d` 形式化与错误码

目标：落实 #11。

当前状态：完成证据已经建立。`DICE_*` 运行时错误、parser 级 `PARSE_*` 错误、`OneDiceError.meta.range/expected/actual/hint/feature`、README 捕获示例和 `test/issues/readme-error-codes.test.ts` 已经把错误模型锁到浏览器可展示合同。后续新增语法必须同步补错误码、`meta` 字段、README 错误表和 UI 示例；用户可触达失败不得退回普通 `Error`，测试也不得依赖完整 `message`。

必须完成：

- README 中增加 `d` 形式化说明。
- 增加 `DICE_INCOMPATIBLE_MODIFIERS` 等错误码。
- 增加非法 modifier 组合测试。
- 浏览器调用示例展示如何捕获 `OneDiceError`。

验收：

- 用户不看上游标准文档也能理解 `d` 的参数槽位。
- 错误能被 UI 稳定识别。
- `DICE_INCOMPATIBLE_MODIFIERS` 必须覆盖 `2d20k1p1`、`2d20q1b1`。
- `DICE_POOL_MODIFIER_EXCLUSIVE` 必须覆盖 `2d20a8k1`、`2d20a8p1`。
- README 必须展示 `try/catch` 中读取 `error.code` 和 `error.meta.hint`。

### M4：浏览器包输出

目标：使包可直接用于现代前端项目。

当前状态：完成证据已经建立。dual ESM/CJS output、类型声明入口、`main/module/types/exports` 字段、`files` 白名单、`sideEffects=false`、Vite browser smoke test、bundle Node-only 依赖扫描、`test/browser/package-contents.test.ts` pack 内容审计、CJS require smoke（含 `rollProgram()`）、声明文件完整公共 API 导出检查（含 `RollValue`、`RollTrace`、`RollDiagnostic`、`Config`、`ProgramResult`）、README 纯 TypeScript/Vite/React/Vue 接入片段、`test/issues/readme-browser-examples.test.ts` 文档护栏、ADR-001 合同锁定和 pack dry-run 验证路径已经建立。后续新增公开 API、feature flag、trace 类型或 diagnostic code 时，必须同步确认构建产物、声明文件、browser fixture 和 package contents 没有漏导出，也不得重新引入 Node-only polyfill。

必须完成：

- dual ESM/CJS 构建。
- 类型声明输出。
- `exports` 字段。
- Vite smoke test。`test/browser/vite-import.test.ts` 必须真实执行构建产物，并扫描 bundle 中是否出现 `fs/path/os/crypto`、`process.` 或 `Buffer`。
- Pack 内容测试。`test/browser/package-contents.test.ts` 必须解析 `npm pack --dry-run --json` 的实际文件列表，并拒绝 `src/`、`test/`、`docs/`、`node_modules/`、临时 tarball、WASM 或 native addon 进入发布包。
- 包入口测试。`test/browser/package-contents.test.ts` 必须锁定 `package.json.main/module/types/exports` 指向 `dist/index.cjs`、`dist/index.mjs` 和 `dist/index.d.ts`，并验证 CJS 产物可 `require()` 调用 `dice()`、`roll()`、`rollProgram()`；声明文件必须导出 `dice()`、`roll()`、`rollProgram()`、`OneDiceError`、`Config`、`RollFeatureFlags`、`SyntaxMode`、`RollResult`、`RollValue`、`RollTrace`、`RollDiagnostic` 和 `ProgramResult`。
- README 必须保留纯 TypeScript、Vite、React、Vue 四类浏览器接入片段，并由 `test/issues/readme-browser-examples.test.ts` 锁定成功结果、`OneDiceError` 捕获、`diagnostics` 展示和确定性随机源注入。
- `package.json.sideEffects` 必须为 `false`，除非未来 ADR 明确引入顶层副作用。
- `test/issues/docs-cross-links.test.ts` 必须锁定 ADR-001 持续记录 `sideEffects=false`、Node-only 依赖扫描和 `test/browser/vite-import.test.ts` 验收路径。

验收：

- Vite 项目必须能够 `import { dice } from '@onedice/core'`。
- 打包不需要 Node polyfill，browser smoke 必须对 bundle 内容做显式扫描。
- `npm pack --dry-run` 内容干净。
- `dist/index.mjs` 必须能被浏览器打包器消费。
- `dist/index.cjs` 必须能被 CommonJS 调用方消费。
- `dist/index.d.ts` 必须导出 `dice()`、`roll()`、`rollProgram()`、`OneDiceError`、`Config`、`RollFeatureFlags`、`SyntaxMode`、`RollResult`、`RollValue`、`RollTrace`、`RollDiagnostic` 和 `ProgramResult`。
- `package.json.files` 必须避免发布 `test/`、`docs/`、`src/`、`node_modules/`、临时 tarball。

### M5：结构化结果与 Trace

目标：浏览器 UI 不再解析 `toString()`。

当前状态：完成证据已经建立。`roll()`、`RollResult`、`RollValue`、V1 主路径 trace、tuple/clamp/projection/slice/program/conditionals/loop trace、嵌套 `{env}` 父子 range 合同和 JSON-safe 序列化测试已经进入本地实现。`test/v1/json-serialization.test.ts` 已新增 supported public path 防回退矩阵，覆盖 number、unary、binary/group、普通 `d`、`p/b`、FATE、`a/c` pool、interpolation、tuple、selection、projection、slice、clamp、conditionals、loop、FVTT `@path`、FVTT pool、FVTT `cs` 和 `rollProgram()`，并断言序列化后的公开结果不得出现 `kind='generic'`。剩余工作必须集中在 FVTT 归一化 diagnostic、未来新增节点专属 trace 和 UI 可读字段补充；generic fallback 不得承担关键路径，也不得暴露 AST 节点、函数、`Map` 或循环引用。

必须完成：

- 新增 `roll()` API。
- 新增 `RollResult`、`RollTrace`、`RollDiagnostic` 类型。
- `dice()` 继续调用旧路径或桥接新路径。
- `DNode`、`PNode` 至少应当提供结构化 trace。
- 每个新增 AST 节点必须在 `src/trace.ts` 中有显式 `kind` 分支，只有临时开发阶段才能落到 generic trace。
- trace 的所有公开字段必须是 JSON-safe 字面量、数组或对象，不得暴露 AST 节点、`Map`、函数、类实例或上下文引用。
- 与随机数有关的 trace 必须保留全局 `randomCall` 序号；与源码定位有关的 trace 必须保留 `range`，且坐标使用原始输入的 UTF-16 偏移。

验收：

- 新 API 能展示普通骰和奖惩骰过程。
- 旧 API 无破坏。
- `RollResult` 必须包含 `raw`，哪怕 V1 阶段先只返回 scalar。
- `DNode` trace 必须包含骰子原始顺序、选择状态、modifier 列表和随机调用序号。
- `PNode` trace 必须包含 `candidates`，并展示 `00 + 0 => 100`。
- generic trace 必须逐步替换为节点专属 trace；`test/v1/json-serialization.test.ts` 必须覆盖所有已支持公开路径不落入 `kind='generic'`。
- trace 必须通过 JSON 序列化测试。

### M6：元组内部模型

目标：为 V2 运算符打基础。

必须完成：

- 引入 `RollValue`。
- `2d20` 内部保留骰子元组。
- 显式 `[a,b,c]` 元组语法如果进入本阶段，必须有投影规则测试。
- 文档写清楚旧 API 和新 API 的投影差异。
- 新增 `projectToNumber()`，集中处理 `sum`、`last`、`identity`。
- `EvaluationResult` 必须同时包含 `value`、`raw`、`trace`。
- 每个 AST 节点必须逐步实现 `evaluate(context)`，旧 `eval(config)` 只能作为桥接层。
- `DNode` 必须把每个骰子表示成 tuple item，并在普通算术中投影为 sum。

验收：

- `2d20 + 1` 使用标量和。
- `2d20` 的 `raw` 必须暴露两个骰子。
- 旧 `dice()` 返回仍是 number。
- `roll('2d20')` 的 `raw.kind` 必须能表达两个骰子的原始结果。
- `dice('2d20')` 与旧版本数值行为必须一致。
- 空元组投影必须抛 `TUPLE_EMPTY_PROJECTION`。

### M7：元组选择运算符

目标：实现最常用的 V2/FVTT 交集能力。

必须完成顺序：

1. `kh`
2. `kl`
3. `dh`
4. `dl`

每个运算符必须单独测试：

- 显式元组。
- 骰子隐式元组。
- 缺省数量。
- 指定数量。
- 越界数量。
- trace 中 selected/dropped 标记。
- 与普通 `k/q` 的兼容关系。
- 与 `2d20 + 1` 这种标量消费的互不干扰。

验收：

- `2d20kh1` 或最终确定语法能稳定工作。
- `[2,7,4]dl1` 等明确例子通过。
- 越界数量必须抛 `DICE_INVALID_KEEP_COUNT` 或后续专门的 `TUPLE_INVALID_SELECTION_COUNT`。
- 相同输入和随机序列必须稳定产生相同 selected/dropped trace。

### M8：`min/max`、`tp`、`sp`

目标：补齐上游 #3 中较核心的元组工具。

M8 不应当被做成一个大 PR。它应当拆成三个可独立验证、可独立回滚的子阶段：

| 子阶段 | 能力 | 状态口径 | 必须修改 | 必须测试 | 不得混入 |
| --- | --- | --- | --- | --- | --- |
| M8a | `min/max` clamp | 已完成后应当只补漏 | `utils/grammar.yaml`、`src/ast/clamp.ts`、trace 类型、README 示例 | `5min6=6`、`7max6=6`、`[7,4]max5=[5,4]`、`2d6min5` 随机预算不变 | `tp/sp/lp` |
| M8b | `tp` tuple projection | 已完成后应当只补漏 | grammar 后缀产生式、`TupleProjectionNode`、`roll().raw`、`trace.kind='tuple-projection'` | `3d100tp` 不二次掷骰、显式 tuple 保留 items、标量左值包装或拒绝策略 | `sp` 索引、循环、FVTT |
| M8c | `sp` tuple slice | 已完成后应当只补漏 | `TupleSliceNode`、索引解析、越界错误、slice trace | 单索引、区间、步长、越界、负索引、空结果 | `lp`、program、FVTT |

M8b 的 `tp` 技术合同必须写成以下形式：

```ts
interface TupleProjectionTrace {
  kind: 'tuple-projection'
  operator: 'tp'
  expression: string
  range?: SourceRange
  value: number
  projection: 'sum' | 'last' | 'identity'
  sourceKind: RollRawValue['kind']
  sourceRange?: SourceRange
  itemCount: number
  items: RollRawItem[]
  children: RollTrace[]
}
```

`tp` 实现必须满足：

- `tp` 是后缀运算符，优先级必须遵守 ADR-004，不得通过字符串替换预处理实现。
- 左侧表达式只能求值一次；实现应当读取左侧 `RollValue.raw` 或通过 `tupleValueFromNode(left, leftValue)` 取得 tuple，不得再次调用 `left.eval()` 或 `left.evaluate()`。
- `roll('3d100tp', { random: sequenceRandom([10,20,30]), features: { tupleProjection: true } })` 必须消耗 3 次随机数，`raw.items` 必须是 `[10,20,30]`，`trace.children[0]` 必须保留原始骰子 trace。
- 旧 `dice('3d100tp')` 必须仍返回 number；如果公开投影采用 sum，则结果为 `60`，并在 README 中写明旧 API 只返回标量投影。
- 未开启 `features.tupleProjection` 时，`tp` 必须抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='tupleProjection'`，不得被拆成普通标识符或未知 token。
- 左侧为标量时，ADR-004 已选择的策略必须被测试锁定；如果采用单元素包装，`roll('5tp')` 的 `raw.items` 必须只有一个 item；如果采用拒绝策略，错误码必须是 `TUPLE_REQUIRED`。

M8c 的 `sp` 已通过 ADR-007 固化索引规则。后续只允许按 ADR-007 补漏；如上游修订语义，必须新增 superseding ADR。ADR-007 已回答：

- 索引是否一律 1 基，`0` 是否非法。
- 单索引返回 scalar、单元素 tuple 还是保留 tuple raw 并由旧 API 投影。
- 双参数是否包含右边界，上游示例 `[2,5] => [2,3,4,5]` 必须被作为默认证据处理。
- 三参数到底是 `[start, step, end]` 还是 `[start, end, step]`，并解释 `[1,2,5] => [2,4]` 的来源。
- 负索引、反向区间、越界、空结果分别使用哪个错误码或返回合同。

`sp` 的错误合同已经按以下规则实现，后续补漏不得改变错误码含义：

| 场景 | 错误码 | `meta` 必填字段 |
| --- | --- | --- |
| 左侧不可转为 tuple | `TUPLE_REQUIRED` | `operator='sp'`、`range` |
| 索引不是整数 | `TUPLE_INVALID_SLICE_INDEX` | `index`、`received` |
| 索引越界且 ADR 决定抛错 | `TUPLE_SLICE_OUT_OF_RANGE` | `index`、`limit` |
| 步长为 0 | `TUPLE_INVALID_SLICE_STEP` | `step` |
| 参数个数不合法 | `TUPLE_INVALID_SLICE_ARITY` | `actual`、`expected` |

### M9：`lp`、多语句、寄存器

目标：实现表达式程序化能力，使调用方能够在浏览器中执行“多段掷骰 + 临时变量 + 条件选择 + 受预算约束循环”，同时保持旧 `dice()` 仍然是无状态单表达式 API。

M9 是从“表达式求值”进入“程序求值”的边界。它必须新增 API，不得让 `dice()` 默认接受 `;` 或变量写入语法。

M9 的运行时数据流必须固定为：

```text
program input
  -> scan statements with source ranges
  -> create one shared EvaluationContext
  -> evaluate statement[0]
  -> write diagnostics and optional variable snapshot
  -> evaluate statement[1..n] with same context
  -> return final statement scalar projection and full statement trace list
```

任何实现不得在 statement 之间重新创建随机源、预算对象或变量表。随机调用序号必须从第一条 statement 连续递增到最后一条 statement；如果第一条 statement 消耗 `randomCall=1..2`，第二条 statement 的第一颗骰子必须从 `randomCall=3` 开始。这样浏览器回放、多语句动画和调试日志才能按完整 program 顺序复原。

必须先固定公开类型：

```ts
interface ProgramVariableSnapshot {
  name: string
  range?: SourceRange
  raw: RollValue
  value: number
  assignedAtStatement: number
}

interface ProgramStatementTrace {
  index: number
  expression: string
  range: SourceRange
  result: RollResult
  assignedVariable?: ProgramVariableSnapshot
  diagnostics: RollDiagnostic[]
}

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

M9 不得一次性实现为一个巨大 PR。它应当拆成四个可独立验证的子阶段：

| 子阶段 | 能力边界 | 必须修改 | 必须测试 | 不得混入 |
| --- | --- | --- | --- | --- |
| M9a | `rollProgram()` 壳层和 statement range | `src/index.ts`、program parser、program 类型导出 | `rollProgram('1d6;2d6')`、空 statement、尾随 `;` | 变量、条件、`lp` |
| M9b | 寄存器赋值和读取 | `VariableAssignmentNode`、`VariableReferenceNode`、`EvaluationContext.variables` | `$0e(2d6);$0+1`、变量覆盖、变量缺失 | 三目惰性、循环 |
| M9c | 比较、布尔和三目 | grammar、AST、trace、错误码 | `3d6>10`、`0|1`、`condition?A:B` 随机调用数 | `lp`、FVTT |
| M9d | `lp` 循环 | `LoopNode`、循环子作用域、循环 trace、预算扩展 | 标量边界、tuple 边界、嵌套深度、预算耗尽 | 默认模式语法扩容 |

每个子阶段都必须同时提交默认拒绝测试和启用路径测试。例如 M9b 实现变量读取后，`rollProgram('$0e(2d6);$0')` 必须可用，但 `dice('$0')` 和 `roll('$0')` 在未启用 program feature 时仍必须抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='program'`。这条测试用于防止程序语法泄漏到旧 API。

实现顺序必须是：

1. **Program parser 壳层**：只负责按 `;` 切分 statement、保留 range、拒绝空 statement 或写出空 statement 合同。
2. **共享上下文**：所有 statement 必须共享同一个 `EvaluationContext`、随机预算和 diagnostics 数组。
3. **变量写入读取**：寄存器写入必须保存 `RollValue`，读取时再按消费方决定标量或 tuple；不得只存 number。
4. **比较与布尔运算**：比较结果必须是数值布尔 `1/0`，布尔运算必须按非零为真处理。
5. **三目运算**：只能求值被选中的分支，未选分支不得消耗随机数、不得写变量、不得产生 runtime diagnostic。
6. **`lp` 循环**：已经按最后阶段落地，并依赖已验证的预算、变量作用域和 tuple 模型；后续补漏不得绕过 ADR-008。

Program parser 不得使用简单 `input.split(';')`。它必须按字符扫描并维护括号深度、方括号深度和花括号深度，保证未来表达式中的 tuple、env 插值和 FVTT 池不会被错误切开。每个 statement 的 `range` 必须使用原始输入的 UTF-16 偏移，`statement.expression` 必须保留原始片段，诊断和错误高亮必须回到完整 program 输入坐标系。

Program scanner 必须遵守以下字符级规则：

| 字符/状态 | 扫描行为 | 失败合同 |
| --- | --- | --- |
| `(`、`)` | 维护圆括号深度 | 结束时深度非 0 时交给表达式 parser 抛 `PARSE_UNEXPECTED_END` 或 `PARSE_UNEXPECTED_TOKEN` |
| `[`、`]` | 维护 tuple 深度 | 未开启 tuple feature 时仍应保留 range，不能提前破坏错误位置 |
| `{`、`}` | 维护 env/FVTT 池深度 | 默认模式不得把 `{attack;bonus}` 按 `;` 切开 |
| `;` 且所有深度为 0 | 切分 statement | 空 statement 必须抛 `PROGRAM_EMPTY_STATEMENT` |
| 字符串末尾 | 收尾最后一条 statement | 末尾空 statement 必须按合同失败，不得静默忽略 |

scanner 输出的 statement 必须包含 `{ expression, range, index }`。`expression` 允许去掉首尾空白，但 `range` 必须指向原始输入中的非空表达式区间；如果保留空白用于错误高亮，则必须在类型注释中说明 `range` 是原始片段还是 trim 后片段。

空 statement 的合同必须明确：

| 输入 | 结果 |
| --- | --- |
| `''` | `PARSE_UNEXPECTED_END` 或专门的 `PROGRAM_EMPTY`，不得返回 `0` |
| `'1d6;'` | `PROGRAM_EMPTY_STATEMENT`，`meta.index=1`，`meta.range` 指向末尾空语句 |
| `'1d6;;2d6'` | `PROGRAM_EMPTY_STATEMENT`，`meta.index=1`，不得跳过空语句 |
| `';1d6'` | `PROGRAM_EMPTY_STATEMENT`，`meta.index=0` |

变量赋值不得被实现为字符串替换。赋值节点必须先求右侧表达式，保存完整 `RollValue`，再把标量投影写进 statement result。读取变量时必须返回保存的 `RollValue` 副本或只读视图，防止后续 tuple selection、slice、clamp 修改已保存值的 metadata。变量缺失必须抛 `VARIABLE_NOT_FOUND`，`meta` 必须包含 `variable`、`range`、`availableVariables`。

寄存器赋值和读取必须拆成独立合同：

| 能力 | 输入示例 | 必须行为 | 不得行为 |
| --- | --- | --- | --- |
| 数字寄存器写入 | `$0e(2d6)` | 先求 `2d6`，保存 `raw.kind='tuple'`、标量 `value=sum`、`assignedAtStatement` | 不得把 `$0` 替换成求值后的字符串 |
| 命名临时变量写入 | `$tTotale(2d6)` | 变量名必须完整保存为 `$tTotal`，大小写合同必须由 ADR 固定 | 不得把 `$tTotal` 和 `$ttotal` 随意归一 |
| 变量读取 | `$0+1` | 读取保存的 `RollValue`，由 `+` 通过 `projectToNumber()` 消费 | 不得只返回 number 导致 tuple metadata 丢失 |
| 覆盖写入 | `$0e(1);$0e(2);$0` | 最终变量快照 `assignedAtStatement=1`，旧值只保留在第一条 statement trace 中 | 不得把变量历史混入最终 `variables` |
| 缺失变量 | `$missing` | 抛 `VARIABLE_NOT_FOUND`，`availableVariables` 按当前变量表排序输出 | 不得返回 0、空 tuple 或普通 parse error |

变量快照必须是 JSON-safe 数据，不得暴露可变 `Map`、AST 节点或上下文对象。若内部需要保存更丰富的 `RollValue`，对外 `ProgramVariableSnapshot.raw` 必须是序列化后的 raw 值；读取变量时允许在内部重建只读 `RollValue`，但不得让调用方通过返回值修改上下文中的变量。

M9b 必须新增以下确定性测试：

| 测试 | 随机序列 | 断言 |
| --- | --- | --- |
| `$0e(2d6);$0+1` | `[2,5]` | 最终 `value=8`，`variables['$0'].value=7`，`raw.kind='tuple'` |
| `$0e(1);$0e(2);$0` | 无 | 最终 `value=2`，`assignedAtStatement=1` |
| `$tTotale(2d6);$tTotal` | `[3,4]` | 命名变量可读取，变量名完整保留 |
| `$0` | 无 | `VARIABLE_NOT_FOUND`，`availableVariables=[]`，range 指向 `$0` |
| `$0e(2d6);$0` | `[2,5]` | 读取结果的 `raw` 与最终 `variables['$0'].raw` 值相等但不是同一对象引用 |
| `dice('$0')` | 无 | 默认旧 API 抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='program'` |

比较和布尔运算的标量化规则必须只通过 `projectToNumber()` 完成：

| 运算 | 输入消费 | 输出 raw | trace 要求 |
| --- | --- | --- | --- |
| `>`、`<`、`=` | 左右两侧各投影一次 | scalar `1` 或 `0` | 记录 `leftValue`、`rightValue`、`operator`、`result` |
| `&`、`|` | 非零为真，返回 `1/0` | scalar `1` 或 `0` | 记录布尔化前后的值 |
| `?:` | 只投影 condition | 被选分支的 raw | 记录 `conditionValue`、`selectedBranch`，未选分支不得有 trace |

三目运算必须短路。`roll('0?(4d20):(1d4)', { random: sequenceRandom([3]) })` 必须只消耗一次随机数；`roll('1?(4d20):(1d4)')` 必须只执行 true 分支。未选分支里的变量缺失、预算耗尽或非法运行时行为不得发生，因为该分支没有被求值。

三目 trace 必须能解释“为什么没有执行另一个分支”。`ConditionalTrace` 应当包含 `conditionTrace`、`conditionValue`、`selectedBranch: 'consequent' | 'alternate'`、`selectedTrace`，不得包含未选分支的运行时 trace。为了帮助编辑器高亮，trace 允许包含未选分支的源码 `range`，但不得包含未选分支的骰子结果、变量写入或 diagnostics。

预算合同必须扩展为：

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

预算错误必须统一使用 `EVALUATION_BUDGET_EXCEEDED`。`meta.budgetKind` 只能使用稳定枚举值：`randomCalls`、`evaluationSteps`、`loopIterations`、`loopDepth`。浏览器 UI 需要根据 `budgetKind` 显示不同提示文案，因此错误文本允许调整，但枚举值不得随意改名。

M9d 当前实现和后续修改必须持续满足以下前置条件：

| 前置项 | 必须已经满足 | 验收证据 |
| --- | --- | --- |
| parser 隔离 | 默认模式能识别 `lp` 是保留未来语法 | `dice('3lp[1]')` 抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='loopOperator'` |
| tuple 模型 | 左值边界允许从 scalar 或 tuple raw 中读取 | `[3]`、`[2,5]`、`[1,2,5]` 都有稳定 `RollValue` 表示 |
| program 上下文 | 循环体能够访问共享 `EvaluationContext` | `rollProgram('$0e(1);3lp[$0+i]')` 不重新创建变量表 |
| conditionals | 循环体中的三目保持短路 | `3lp[i>1?1d6:0]` 只在后两轮消耗随机数 |
| 预算 | 随机、求值、循环次数、循环深度四类预算都有同一错误码 | 超限均抛 `EVALUATION_BUDGET_EXCEEDED`，仅 `meta.budgetKind` 不同 |

`lp` 的语法入口应当遵守 ADR-004 的后缀/中缀优先级合同。实现应当新增独立 parser production 和 AST 节点，不得通过字符串预处理完成：

```text
LoopExpression =
  LoopBounds "lp" TupleExpression

LoopBounds =
  ScalarExpression
  | TupleExpression
```

如果当前 grammar 层级无法无歧义表达 `LoopBounds "lp" TupleExpression`，必须先写 ADR-008 或更新 ADR-004，明确 `lp` 相对 `sp/tp/min/max/?:` 的绑定顺序。不得为了通过 parser 表生成而把 `lp` 临时塞进错误优先级层，导致 `1+3lp[...]`、`(1+3)lp[...]` 或 `[1,3]lp[...]tp` 的解释不稳定。

`lp` 的边界解析必须在进入循环前一次性完成：

| 左侧值 | 循环序列 | 说明 |
| --- | --- | --- |
| `3lp[...]` | `i=1,2,3` | 标量左值表示从 1 到 N |
| `[3]lp[...]` | `i=1,2,3` | 单元素 tuple 等同标量 |
| `[2,5]lp[...]` | `i=2,3,4,5` | 双元素 tuple 是闭区间 |
| `[1,2,5]lp[...]` | `i=3,5` | 三元素 tuple 必须遵守 ADR-008 的 `[leftBoundary, step, end]` 规则 |

三元素 `lp` 必须继续与 `sp` 的 `[leftBoundary, step, end]` 规则保持一致，不得凭实现方便改成 `[start, end, step]`。`lp` 边界必须是整数；非整数、步长为 0、方向与步长冲突、预计迭代次数超过预算，都必须在执行循环体前失败，避免半执行后留下变量状态。

边界归一化必须是纯函数，输入为已求值的 `RollValue`，输出为不可变 `LoopBounds`：

```ts
interface LoopBounds {
  start: number
  end: number
  step: number
  count: number
  source: 'scalar' | 'tuple'
}

function normalizeLoopBounds(value: RollValue, range?: SourceRange): LoopBounds
```

`normalizeLoopBounds()` 必须负责所有边界错误，不能把错误分散在 `LoopNode.evaluate()` 的循环过程中。它必须检查：

| 错误场景 | 错误码 | `meta` 必填字段 |
| --- | --- | --- |
| tuple 参数个数不是 1、2、3 | `LOOP_INVALID_BOUNDS_ARITY` | `actual`、`expected=[1,2,3]`、`range` |
| 边界不是整数 | `LOOP_INVALID_BOUND` | `position`、`received`、`range` |
| 步长为 0 | `LOOP_INVALID_STEP` | `step`、`range` |
| 方向与步长不一致 | `LOOP_INVALID_RANGE` | `start`、`end`、`step` |
| 预估迭代次数超过预算 | `EVALUATION_BUDGET_EXCEEDED` | `budgetKind='loopIterations'`、`actual`、`limit` |

`LoopNode.evaluate(context)` 的执行顺序必须固定为：

1. 以共享 `context` 求值左侧边界表达式，并把结果传给 `normalizeLoopBounds()`。
2. 在执行循环体前检查 `loopDepth + 1 <= maxLoopDepth` 和 `loopIterations + bounds.count <= maxLoopIterations`。
3. 为每次迭代创建变量子作用域，写入只读循环变量 `i`，并记录旧的同名变量是否存在。
4. 使用同一个随机源、预算和 diagnostics 求值循环体；不得为每轮创建新的 `EvaluationContext`。
5. 每轮结束后恢复外层变量表，保证 `i` 只在循环体内可见。
6. 把每轮循环体 raw 作为 tuple item 追加到 `LoopNode` 的 raw 结果中。
7. 循环结束后将 raw 标记为 `source='loop'`，旧 `dice()` 只按既定投影规则返回 number。

循环变量 `i` 必须是只读变量。循环体内读取 `i` 返回 scalar `RollValue`；当前阶段不得新增表达式级赋值或 `$ie(...)` 语法。只读保护必须落在 `EvaluationContext.variables` 存储层：任何未来赋值路径尝试覆盖只读 `i` 时，都必须抛 `VARIABLE_READONLY`，`meta.variable='i'`，并尽量保留赋值源码 `range`。如果 ADR-008 决定允许 shadowing，则必须把 shadowing 行为、trace 和恢复规则写入 superseding ADR 后才能实现。

`lp` trace 必须采用独立节点，不得伪装成 tuple literal trace：

```ts
interface LoopTrace {
  kind: 'loop'
  range?: SourceRange
  operator: 'lp'
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

`LoopTrace.iterations[index]` 必须按执行顺序排列，`index` 必须从 0 开始，`value` 必须是当轮 `i` 的实际数值。`body.range` 必须指向循环体中被重复执行的源码范围，而不是展开后的虚拟字符串范围。浏览器 UI 如果要展示“第 3 轮执行了哪段表达式”，应当能够直接用 `LoopTrace.range`、`boundsTrace.range` 和 `iterations[n].body.range` 高亮原始输入。

M9d 持续验收必须覆盖以下测试矩阵：

| 场景 | 输入 | 配置/随机序列 | 断言 |
| --- | --- | --- | --- |
| 默认拒绝 | `dice('3lp[1]')` | 默认配置 | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='loopOperator'` |
| 标量边界 | `roll('3lp[i]', { features: { loopOperator: true } })` | 无随机 | raw tuple 为 `[1,2,3]`，trace `itemCount=3` |
| 单元素 tuple 边界 | `roll('[3]lp[i]', flags)` | tuple literals + loop | 等同 `3lp[i]` |
| 双元素 tuple 边界 | `roll('[2,5]lp[i]', flags)` | tuple literals + loop | raw tuple 为 `[2,3,4,5]` |
| 三元素 tuple 边界 | `roll('[1,2,5]lp[i]', flags)` | tuple literals + loop | raw tuple 为 `[3,5]` |
| 随机预算共享 | `roll('3lp[1d6]', flags + random)` | `[2,4,6]` | 三轮 randomCall 为 `1,2,3` |
| 三目短路 | `roll('3lp[i>1?1d6:0]', flags + random)` | `[4,5]` | 只消耗两次随机数 |
| 变量作用域 | `rollProgram('3lp[i];i', flags)` | 无随机 | 第二 statement 抛 `VARIABLE_NOT_FOUND` |
| 循环次数预算 | `roll('100lp[i]', { maxLoopIterations: 10, flags })` | 无随机 | `EVALUATION_BUDGET_EXCEEDED`，`budgetKind='loopIterations'` |
| 循环深度预算 | `roll('2lp[2lp[i]]', { maxLoopDepth: 1, flags })` | 无随机 | `EVALUATION_BUDGET_EXCEEDED`，`budgetKind='loopDepth'` |

M9 验收必须覆盖：

- `rollProgram('1d6;2d6')` 的最终 `value` 来自最后一个 statement，但 `statements.length=2`。
- `$0e(2d6);$0+1` 或 ADR 确定的赋值语法必须能证明变量保存的是原始 `RollValue`。
- `condition ? 2d20 : 4d20` 必须只消耗被选分支的随机数。
- 嵌套 `lp` 达到深度上限时必须抛 `EVALUATION_BUDGET_EXCEEDED`，`meta.budgetKind='loopDepth'`。
- 循环变量 `i` 必须只在循环体子作用域可见；循环结束后读取 `i` 必须抛 `VARIABLE_NOT_FOUND`。
- `dice('1;2')` 默认必须继续抛 `PARSE_UNSUPPORTED_SYNTAX`，证明程序语法没有污染旧 API。

### M10：FVTT 兼容模式

目标：服务已有 FVTT 用户习惯，同时保持 OneDice 默认语法稳定。

M10 必须是显式兼容模式，而不是默认语法扩容。调用方必须通过 `syntax: 'fvtt-compatible'` 或独立适配 API 表达意图。

M10 的解析管线必须显式分层，不能用一次性正则替换完成：

```text
raw input
  -> lexer recognizes default OneDice tokens and FVTT-only reserved tokens
  -> syntax mode decides accept/reject/normalize
  -> parser builds native AST or normalized compatibility AST
  -> evaluator uses the same RollValue/EvaluationContext as default mode
  -> diagnostics records compatibility normalization
```

默认模式遇到 FVTT-only token 时必须在 lexer 或 parser 早期失败，并保留完整 `range`。兼容模式允许把 FVTT 输入归一化为内部 AST，但诊断中必须保留原始片段，不能让 UI 只能看到归一化后的表达式。所有兼容能力必须复用默认模式已经验证过的 AST 节点和 `RollValue` 规则；不得为 FVTT 单独复制一套 keep/drop、tuple projection 或预算逻辑。

M10 应当拆成以下实施序列，任何一步失败都不得继续向后合并：

| 步骤 | 必须修改 | 必须新增测试 | 完成标准 |
| --- | --- | --- | --- |
| M10a 默认拒绝加固 | `src/parser/lexer.ts`、parser 错误测试 | `{4d6,3d8}kh`、`@path`、`1d20cs>15` 默认拒绝 | `meta.feature` 能区分 `fvttCompatibility`、`fvttSuccessCounting` 等 |
| M10b FVTT 池 lexer/adapter scanner | 已通过 `src/parser/fvtt-normalize.ts` 实现兼容 scanner；lexer 仍负责默认拒绝 | `{4d6,3d8}`、`{attack}`、`{attack,bonus}` 边界已进入 `test/v1/fvtt-compatibility.test.ts` | 已完成：`{env}` 与 FVTT pool 不互相污染，非骰逗号 key 继续按 env 插值 |
| M10c FVTT pool adapter | 已通过 `src/parser/fvtt-normalize.ts` 在 `syntax: 'fvtt-compatible'` 下把骰池归一化到 `TupleNode`/`TupleSelectionNode` | `{4d6,3d8}kh` 与 `{4d6,3d8}kl` 已覆盖 | 已完成当前受控子集：产生 `SYNTAX_NORMALIZED`，trace 复用 tuple-selection；`kh/kl` 仍必须显式启用 `features.tupleOperators` |
| M10d `@path` resolver | 已在 `Config.resolver`、`EvaluationContext.currentInput` 和 `VariableReferenceNode` 中实现同步 resolver | resolver 命中、env 回退、缺失变量、resolver 抛错、`RollValue` 返回值已覆盖 | 已完成当前合同：缺失抛 `VARIABLE_NOT_FOUND`，resolver 普通异常包裹为 `VARIABLE_RESOLVER_FAILED` |
| M10e 浏览器文档与 smoke | README 已说明 FVTT dice pool、`@path` resolver/env、`cs` 成功计数和暂缓能力；browser fixture 已从“仅打包”升级为打包后执行 bundle | Vite import 后调用 FVTT 兼容成功路径和结构化拒绝路径 | 已完成当前浏览器合同：bundle 运行后可读取 value/raw/trace/diagnostics/error meta，并验证 `fvttPool` diagnostic、`success-count` trace、`SYNTAX_NORMALIZED` 和 `fvttRuntimeBinding` unsupported meta |
| M10f FVTT success-counting `cs` | `Config.features.fvttSuccessCounting`、兼容 adapter、`SuccessCountNode`、`RollTrace` 类型 | `4d6cs>4`、`3d6cs>=5`、`3d6cs1`、`1d20cs` 目标缺失拒绝 | 开启 flag 后返回 success 数量；默认模式和未开 flag 时仍结构化拒绝 |
| M10g FVTT 爆骰/重骰结构化拒绝 | `src/parser/lexer.ts` 保留 V1 `x` 乘法，同时识别骰子后的 `x/xo/X/r/rr` | `2x3` 成功；`1d6x6`、`1d6xo`、`1d6X6`、`1d6r<2`、`1d6r1`、`1d6rr1` 结构化拒绝 | 已完成当前拒绝合同：爆骰抛 `meta.feature='fvttExplode'`，重骰抛 `meta.feature='fvttReroll'`，且 `1d6r<2` 不得误报为 conditionals |
| M10h 暂缓运算符/失败计数结构化拒绝 | `src/parser/lexer.ts` 识别尚未实现但容易误报的 `!`、后缀 `?`、FVTT `cf` | `!1`、`5!`、`5?`、`1?2:3`、`1d6cf<3`、`1d6cf` | 已完成当前拒绝合同：`!` 抛 `meta.feature='factorialOrNotOperator'`，后缀 `?` 抛 `meta.feature='stepSumOperator'`，三目 `?` 仍抛 `conditionals`，`cf` 抛 `meta.feature='fvttFailureCounting'` 且不得误报为 conditionals |
| M10i Foundry success/failure 计数族暂缓拒绝 | `src/parser/lexer.ts` 在通用词法前识别骰子后的 `df/sf/ms/even/odd` | `1d6df1`、`1d6sf<3`、`1d6ms10`、`1d6even`、`1d6odd` 默认模式和兼容模式拒绝 | 已完成当前拒绝合同：`df` 保留 `4df` FATE alias 语义边界，骰后 `df` 抛 `fvttDeductFailures`，`sf` 抛 `fvttSubtractFailures`，`ms` 抛 `fvttMarginOfSuccess`，`even/odd` 抛 `fvttParityCounting` |
| M10j Foundry roll mode/runtime binding 结构化拒绝 | `src/parser/lexer.ts` 识别表达式开头的 Foundry chat roll mode 命令 | `/roll`、`/r`、`/publicroll`、`/pr`、`/gmroll`、`/gmr`、`/blindroll`、`/broll`、`/br`、`/selfroll`、`/sr` 默认模式和兼容模式拒绝 | 已完成当前拒绝合同：这些命令抛 `meta.feature='fvttRuntimeBinding'`，不得被当作除法或普通 parser 错误；核心包仍不得访问 Foundry chat、actor/item 或全局状态 |
| M10k 非骰 FVTT pool 边界结构化拒绝 | `src/parser/lexer.ts` 复用 `isFvttDicePool()` 区分骰池与非骰逗号池 | `{attack,bonus}` 继续按 env key；`{attack,bonus}kh` 默认模式和兼容模式拒绝 | 已完成当前拒绝合同：默认模式仍抛 `fvttCompatibility`；兼容模式下非骰池后接 tuple/FVTT 运算符时抛 `meta.feature='fvttNonDicePool'`，不得误提示“未开启 FVTT 兼容” |
| M10l 无目标 `cs` 结构化拒绝补齐 | `test/v1/parser-errors.test.ts`、`test/v1/fvtt-compatibility.test.ts`、`src/parser/fvtt-success-count.ts` | `1d20cs` 默认模式、兼容未开 flag、兼容已开 flag 三条路径 | 已完成当前拒绝合同：默认模式和兼容未开 flag 抛 `PARSE_UNSUPPORTED_SYNTAX` + `fvttSuccessCounting`；兼容已开 flag 抛目标缺失错误，range 指向输入末尾，仍不得采用 Foundry 默认目标语义 |
| M10m Foundry actor/item/UUID/Compendium 深绑定结构化拒绝 | `src/parser/lexer.ts` 在通用 `@path` 和 tuple `[` 扫描前识别 Foundry 文档绑定前缀 | `@Actor[abc123]`、`@Item[item123]`、`@UUID[Actor.abc123]`、`@Compendium[world.spells.fireball]` 默认模式和兼容模式拒绝；兼容模式下 resolver 不得被调用 | 已完成当前拒绝合同：`@Actor`、`@Item`、`@UUID`、`@Compendium` 归入 `meta.feature='fvttRuntimeBinding'`，range 只覆盖文档绑定前缀；小写 `@actor.path` 继续作为受控 resolver 路径，核心包仍不得访问 Foundry document、UUID resolver、Compendium、actor/item 或异步数据源 |

M10 的文件边界必须清晰：

- `src/parser/lexer.ts` 只负责识别和定位 token，不得在 lexer 中计算骰子结果。
- `src/parser/parser.ts` 或兼容 adapter 只负责把 FVTT 表面语法归一化到已有 AST，不得复制求值逻辑。
- `src/evaluation/context.ts` 只负责 resolver、预算、变量和 diagnostics 的共享状态，不得依赖浏览器全局对象。
- `src/trace.ts` 只负责把已有 AST/raw 转换为 JSON-safe trace，不得重新运行表达式。
- README 和测试必须展示默认 `onedice` 与 `fvtt-compatible` 的并列行为，不得只展示兼容成功路径。

兼容范围必须分层：

| 层 | 应当支持 | 默认模式要求 | 兼容模式要求 |
| --- | --- | --- | --- |
| 池/元组 | `{4d6,3d8}kh` | 必须拒绝，避免与 `{env}` 混淆 | 必须归一化为内部 tuple/pool AST |
| 变量 | `@abilities.str.mod` | 必须拒绝或识别为 FVTT 保留语法 | 必须从 `env` 或 resolver 读取 |
| keep/drop | `kh/kl/dh/dl` | 只能在 feature flag 或兼容模式下启用 | 应当复用 tuple operator，不得复制一套语义 |
| 未支持 Foundry 特性 | roll mode、actor/item 深绑定、UUID/Compendium 文档查找、复杂数据路径副作用 | 必须拒绝，且 `meta.feature` 必须给出比普通 `fvttCompatibility` 更具体的能力名 | 必须抛结构化 unsupported；不得调用 resolver，不得访问 `window.game`、document collection、actor/item 或异步数据源 |

FVTT 变量解析不得直接读取宿主对象任意路径。应当定义受控 resolver：

```ts
type VariableResolver = (path: string, context: {
  syntax: 'fvtt-compatible'
  range: SourceRange
  originalInput: string
}) => string | number | RollValue | undefined
```

resolver 必须是同步接口。浏览器核心不应当在求值过程中等待网络、IndexedDB 或宿主应用异步状态；如果调用方需要异步读取角色卡数据，应当在调用 `roll()` 前把数据准备到 `env` 或同步 resolver 中。核心包不得直接访问 `window`、`game`、`actor`、`localStorage` 或任意全局变量。

resolver 查找顺序必须稳定：

1. 如果调用方提供 `resolver`，先调用 resolver，并把 `path`、`range`、`originalInput` 传入。
2. resolver 返回 `undefined` 时，才回退到 `env[path]`。
3. `env[path]` 仍不存在时，抛 `VARIABLE_NOT_FOUND`。
4. resolver 抛出的非 `OneDiceError` 必须包裹为 `VARIABLE_RESOLVER_FAILED`，并在 `meta.variable` 和 `meta.range` 中保留上下文。

resolver 返回值必须被规范化为 `RollValue`：

| 返回值 | 规范化结果 | 错误合同 |
| --- | --- | --- |
| `number` | scalar `RollValue` | 非有限数抛 `VARIABLE_INVALID_VALUE` |
| `string` | 按当前语法作为表达式求值或按 ADR 决定只允许数字字符串 | 若解析失败，错误 range 必须指向变量引用而不是 resolver 内部字符串 |
| `RollValue` | 复制为只读 raw/value，并按 raw 自身的 `projection` 标量化 | 不得直接复用可变对象引用；`identity` 投影必须抛 `TUPLE_CANNOT_PROJECT`，range 指向原始 `@path` |
| `undefined` | 继续查 `env` 或报缺失 | 不得把缺失变量投影为 0 |

FVTT lexer 必须把 `{}` 池语法和 OneDice `{env}` 插值拆开处理：

| 输入 | 默认 `onedice` | `fvtt-compatible` |
| --- | --- | --- |
| `{attack}` | 继续按 env 插值处理 | 可按 env 插值处理，不得误判为池 |
| `{4d6,3d8}kh` | `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='fvttCompatibility'` | 归一化为 tuple + `kh` |
| `{4d6,3d8}` | `PARSE_UNSUPPORTED_SYNTAX` 或保持 env 缺失合同，必须由 lexer 规则固定 | 返回 tuple raw，旧 API 按投影规则返回 number |
| `{attack,bonus}` | 默认不得仅因逗号破坏旧 env key | 无后缀时继续按 env key；后接 tuple/FVTT 运算符时结构化拒绝为 `fvttNonDicePool` |
| `@abilities.str.mod` | 默认拒绝，`meta.feature='fvttCompatibility'` | 调用 resolver 或 `env` 路径读取 |

FVTT 归一化必须产生非致命诊断，而不是改写用户输入后假装它是原生 OneDice。诊断字段应当包含：

```ts
interface FvttNormalizationDiagnostic extends RollDiagnostic {
  code: 'SYNTAX_NORMALIZED'
  syntax: 'fvtt-compatible'
  from: string
  to: string
  range: SourceRange
  feature: 'fvttPool' | 'fvttVariable' | 'fateAlias'
}
```

兼容模式不得变成“全开 feature”。`syntax: 'fvtt-compatible'` 只能启用已经实现、已有测试、已有 README 说明的兼容能力；尚未实现的爆骰、重骰、无目标成功计数、失败计数、actor/item 深绑定、roll mode 必须继续抛 `PARSE_UNSUPPORTED_SYNTAX`。错误 `meta` 必须写清 `feature`，例如 `fvttExplode`、`fvttReroll`、`fvttSuccessCounting`，以便 UI 能提示“此语法来自 FVTT，但当前核心尚未支持”。

兼容模式的 feature 组合必须按白名单启用：

| FVTT 输入能力 | 需要的内部能力 | 默认 `onedice` | `fvtt-compatible` |
| --- | --- | --- | --- |
| `{4d6,3d8}kh` | tuple literal 或 FVTT pool adapter + tuple operator | 必须拒绝 | 仅当内部 tuple operator 已实现并有测试时接受 |
| `@abilities.str.mod` | variable resolver | 必须拒绝 | resolver/env 缺失时抛 `VARIABLE_NOT_FOUND` |
| `4df` | fate alias | 必须拒绝 | 启用 `features.fateAlias` 后归一化为 `4f`，并产生 `SYNTAX_NORMALIZED` |
| `1d20cs>15` | success counting | 必须拒绝 | 仅在 `features.fvttSuccessCounting` 启用且有目标值时接受 |
| `2d20kh` | tuple operator | 默认按 feature flag 决定 | 兼容模式不得绕过 tuple operator 的错误合同 |

#### M10f FVTT success-counting 合同

外部语法参考应当以 [Foundry VTT Dice Modifiers 文档](https://foundryvtt.com/article/dice-modifiers/) 为准；该文档把 `cs` 定义为 count successes，并列出 `cs={y}`、`cs>{y}`、`cs>={y}`、`cs<{y}`、`cs<={y}` 以及 `10d20cs20` 这类精确目标简写。本仓库不应当一次性实现 Foundry 的全部 success/failure 族；M10f 只覆盖 success count 的受控子集，`cf`、`df`、`sf`、`ms`、`even`、`odd`、无目标 `cs`、爆骰与重骰联动都应当继续进入暂缓列表或独立 ADR。

M10f 应当满足以下接口合同：

```ts
interface RollFeatureFlags {
  fvttSuccessCounting?: boolean
}

type SuccessCountComparator = '=' | '>' | '>=' | '<' | '<='

interface SuccessCountTrace {
  kind: 'success-count'
  range?: SourceRange
  operator: 'cs'
  comparator: SuccessCountComparator
  target: number
  inputLength: number
  successIndexes: number[]
  failureIndexes: number[]
  items: Array<{
    index: number
    value: number
    success: boolean
    counted: 0 | 1
  }>
  children: RollTrace[]
}
```

M10f 解析必须遵守以下边界：

- 默认 `syntax: 'onedice'` 遇到 `1d20cs>15` 必须抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='fvttSuccessCounting'`，`meta.range` 指向 `cs` operator。
- `syntax: 'fvtt-compatible'` 但未启用 `features.fvttSuccessCounting` 时，仍必须抛同一类结构化拒绝错误；兼容模式不得自动打开 success counting。
- 启用 flag 后，应当接受 `cs>{target}`、`cs>={target}`、`cs<{target}`、`cs<={target}`、`cs={target}` 和 `cs{target}`；`cs{target}` 必须归一化为 comparator `'='`。
- `1d20cs` 当前必须拒绝，不得按 Foundry 的“无目标按最大面成功”语义提前实现；错误应当表达“缺少目标数值”，并保留 `actual='$'` 或等价 parser/end-of-input meta。
- adapter 只应当在顶层安全位置切分 `cs`，不得匹配变量名、`{env}` key、字符串化 resolver 返回值、括号/中括号/大括号内部的非目标 operator。

M10f 求值必须遵守以下边界：

- 左侧表达式必须先求值一次，再从 `RollValue` 中读取 tuple 项；不得为了计数重新运行左侧表达式。
- 普通 `DNode` 的 raw dice-roll tuple 应当可被 success counting 消费；显式 tuple 与 operator tuple 也应当按相同 `RollValue` 规则消费。
- 目标表达式应当求值为有限数值；若目标结果不是有限数，必须抛 `VARIABLE_INVALID_VALUE` 或更具体的参数错误，并把 `range` 指向目标表达式。
- success counting 的 `roll().raw` 必须是 `{ kind: 'scalar', value: successCount, source: 'operator' }`，旧 `dice()` 必须返回 success 数量。
- 计数过程不得消耗额外随机数；随机调用顺序必须完全来自左侧和目标表达式自身。

M10f 错误、diagnostic 和测试必须成对覆盖：

| 场景 | 输入 | 配置 | 必须断言 |
| --- | --- | --- | --- |
| 默认拒绝 | `roll('1d20cs>15')` | 默认 | `PARSE_UNSUPPORTED_SYNTAX`，`feature='fvttSuccessCounting'` |
| 兼容未开 flag | `roll('1d20cs>15', { syntax: 'fvtt-compatible' })` | 未启用 flag | 同样结构化拒绝，不得静默当作普通 parse error |
| 大于目标 | `roll('4d6cs>4', flags + random)` | `[5,4,6,1]` | `value=2`，success indexes `[0,2]` |
| 大于等于目标 | `roll('3d6cs>=5', flags + random)` | 固定序列 | comparator `'>='`，成功数量稳定 |
| 精确目标 | `roll('3d6cs1', flags + random)` | 固定序列 | comparator `'='`，`cs1` 与 `cs=1` 合同一致 |
| 缺少目标 | `roll('1d20cs', flags)` | 启用 flag | 目标缺失错误，range 指向输入末尾 |
| 元组消费 | `roll('[1,6,2]cs>3', tuple + flags)` | tuple literal + success flag | 不重新求值 tuple，success indexes `[1]` |

M10f 不得通过扩张核心 grammar 表来破坏已有 V2 优先级。若 grammar 产生式会导致分析表膨胀或冲突，应当使用 FVTT 兼容 adapter 在进入主 parser 前识别完整 success-counting 表达式，并手动组装受控 AST；该 adapter 必须只服务 `syntax: 'fvtt-compatible'`，不得影响默认 OneDice token 流。

实现必须满足：

- `@path` 缺失必须抛 `VARIABLE_NOT_FOUND`，`meta.variable='path'`，`meta.range` 指向完整 `@path`。
- `{4d6,3d8}kh` 必须产生兼容诊断，说明该输入被归一化为 tuple operator；diagnostic 不得影响数值结果。
- 默认模式下 `{attack}` 仍必须按现有 env 插值工作；`{4d6,3d8}kh` 必须作为 FVTT 池语法整体拒绝，不得被误当作 env 名称。
- README 必须单独列出“默认 OneDice”与“FVTT 兼容”两个章节；示例不得混写。
- FVTT 兼容测试必须同时跑默认拒绝和兼容接受两套断言，防止未来重构把兼容语法泄漏到默认模式。

M10 发布前验收必须包含：

- `roll('{4d6,3d8}kh', { syntax: 'onedice' })` 抛 `PARSE_UNSUPPORTED_SYNTAX`。
- `roll('{4d6,3d8}kh', { syntax: 'fvtt-compatible', features: { tupleOperators: true } })` 产生稳定 tuple-selection trace。
- `roll('@abilities.str.mod + 1', { syntax: 'fvtt-compatible', env: { 'abilities.str.mod': 3 } })` 得到 `4`。
- `roll('@missing + 1', { syntax: 'fvtt-compatible' })` 抛 `VARIABLE_NOT_FOUND`。
- 未实现 Foundry 特性必须抛 `PARSE_UNSUPPORTED_SYNTAX` 并带 `meta.feature='fvttCompatibility'` 或更具体的 feature 名。

M10 测试矩阵必须成对覆盖“默认拒绝”和“兼容接受/兼容拒绝”：

| 输入 | 默认模式断言 | 兼容模式断言 |
| --- | --- | --- |
| `{4d6,3d8}kh` | `PARSE_UNSUPPORTED_SYNTAX`，`feature='fvttCompatibility'` | 有 `SYNTAX_NORMALIZED` diagnostic，trace 复用 tuple-selection |
| `{attack}` | 继续按 env 插值 | 继续按 env 插值，不得误判为 FVTT pool |
| `{attack,bonus}` | 按当前 env key 合同处理 | 无后缀时按 env key；`{attack,bonus}kh` 结构化拒绝为 `fvttNonDicePool` |
| `@abilities.str.mod` | `PARSE_UNSUPPORTED_SYNTAX` | resolver/env 返回值被规范化为 `RollValue` |
| `@missing` | `PARSE_UNSUPPORTED_SYNTAX` 或 FVTT reserved 错误 | `VARIABLE_NOT_FOUND`，`availableVariables` 可展示 |
| `4df` | `PARSE_UNSUPPORTED_SYNTAX`，`feature='fateAlias'` | 启用 `features.fateAlias` 后诊断归一化为 `4f` |

## PR 拆分策略

应当按以下 PR 粒度推进：

1. `docs: record upstream issue improvement plan`
2. `test: add deterministic random helper and arithmetic baseline`
3. `test: cover d limits from upstream issue 9`
4. `test: cover percentile bonus and penalty from upstream issue 10`
5. `fix: align percentile bonus and penalty dice with upstream rule`
6. `docs: formalize d expression syntax`
7. `feat: add structured OneDiceError codes`
8. `build: add browser-ready ESM and CJS outputs`
9. `feat: add roll result trace API`
10. `refactor: introduce internal roll value model`
11. `feat: add tuple keep highest and keep lowest`
12. `feat: add tuple drop highest and drop lowest`
13. `feat: add min max clamp operators`
14. `feat: add tuple projection operator`
15. `feat: add tuple slice operator`
16. `feat: add statement evaluation context`
17. `feat: add FVTT-compatible syntax mode`

每个 PR 应当满足：

- 只做一个逻辑主题。
- 包含测试。
- 包含 README 或 docs 更新。
- 不混入格式化大改。
- 不把生成文件和手写逻辑混在难以审查的大 diff 中；如必须同时提交，应当在 PR 描述中说明生成命令。

### PR 验收矩阵

每个 PR 必须写清“改动范围、不可混入事项、验证命令”。下表是后续拆任务时的最低颗粒度：

| PR | 必须改动 | 必须测试 | 不得混入 |
| --- | --- | --- | --- |
| `test: add deterministic random helper and arithmetic baseline` | `package.json` 脚本、测试框架、`test/helpers/random.ts`、算术测试 | `1+2*3`、`(1+2)*3`、`8/3`、`-8/3` | 不得修改骰子语义 |
| `test: cover d limits from upstream issue 9` | `test/issues/issue-009-d-limits.test.ts` | `1d10000`、`10000d1`、`10001d1`、`1d10001`、`maxRandomCalls` 优先级 | 不得顺手实现 V2 运算符 |
| `test/fix: percentile bonus and penalty` | `src/ast/dice/p.ts`、奖惩骰测试、trace 测试 | `00+0=>100`、奖励选择最小最终值、惩罚选择最大最终值 | 不得改变普通 `d` 语义 |
| `docs: formalize d expression syntax` | README 槽位说明、互斥矩阵、错误案例 | 文档示例必须能作为测试输入运行 | 不得只复制 `AdB(kq)C(pb)DaE` |
| `feat: add structured OneDiceError codes` | `src/errors.ts`、错误抛出点、错误测试 | 每个错误断言 `code` 和关键 `meta` | 不得让测试依赖完整 message |
| `build: add browser-ready ESM and CJS outputs` | `tsup.config.ts`、`package.json`、browser fixture | `npm.cmd run build`、`npm.cmd run test:browser`、`npm.cmd pack --dry-run` | 不得发布 `src/` 或测试目录 |
| `feat: add roll result trace API` | `src/trace.ts`、`src/index.ts`、trace 类型导出 | `JSON.stringify(trace)`、普通骰、奖惩骰、插值、算术 | 不得破坏 `dice()` 返回元组 |
| `refactor: introduce internal roll value model` | `src/evaluation/value.ts`、`projectToNumber()`、`roll().raw` | 普通 `2d20` raw 元组、`2d20k1` dropped 元数据、空元组错误 | 不得引入公开 V2 语法 |
| `feat: add tuple keep/drop operators` | grammar、AST、值模型、trace | 显式元组、骰子隐式元组、越界数量、selected/dropped | 不得改变旧 `k/q` 规则 |
| `feat: add min max clamp operators` | grammar、AST、文档 | `5min6=6`、`7max6=6`、元组逐项 clamp | 不得使用 `Math.min/max` 直觉反向实现 |
| `feat: add statement evaluation context` | `EvaluationContext`、program parser、`rollProgram()` | 变量写入读取、三目惰性求值、预算耗尽 | 不得让 `dice()` 默认接受 `;` |
| `feat: add FVTT-compatible syntax mode` | syntax 分支、归一化诊断、README 独立章节 | 默认模式拒绝 FVTT、兼容模式接受 `{}` 和 `@path` | 不得把 FVTT 语法并入默认 OneDice |

每个 PR 的描述必须包含：

- 上游 issue 来源或 ADR 编号。
- 新增/修改的公开 API。
- 兼容性影响，尤其是 `dice()` 是否完全保持旧行为。
- 测试命令输出摘要。
- 如果包含生成文件，必须写出生成命令。

## 风险与约束

| 风险 | 影响 | 必须采取的控制 |
| --- | --- | --- |
| 旧 API 破坏 | 下游项目升级失败 | `dice()` 返回类型不得改变 |
| 语法歧义扩大 | 用户表达式解释不稳定 | 新语法必须先写优先级和负例测试 |
| 浏览器卡死 | 大量骰子、循环、重骰会阻塞 UI | 引入随机调用预算和求值步数预算 |
| FVTT 与 OneDice 语义冲突 | 两套习惯互相污染 | 使用显式 `syntax` 模式 |
| 错误字符串不稳定 | UI 无法可靠提示 | 使用错误码和 `meta` |
| 元组投影不清 | 同一表达式在不同上下文结果不同 | 写清 `scalar` 与 `raw` 规则 |
| 上游开放议题未定 | 实现可能偏离未来标准 | 开放议题先做 ADR 和 feature flag |

## 立即应当执行的工作

第一批工作已经不应当再用“添加某某”这类粗粒度清单描述。后续维护者必须按下表判断状态、补齐证据，并把每个条目拆成能独立评审的 PR：

| 工作项 | 当前状态口径 | 下一步应当补齐的技术细节 | 必须保留的验收命令 |
| --- | --- | --- | --- |
| 测试框架与确定性随机 | 已经进入本地工作树 | 新增语法测试必须复用确定性随机 helper；不得在测试中直接依赖真实 `Math.random()` | `npm.cmd test` |
| V1 算术、`d`、`p/b` 基线 | 已经建立基础回归 | 后续修改 `DNode`、`PNode`、预算或 trace 时，必须补固定随机序列、参数错误和 JSON-safe 断言 | `npm.cmd test -- test/v1/*.test.ts test/issues/issue-009-d-limits.test.ts` |
| #9 `d` 上限与预算 | 已经按语义上限和运行预算分离 | 任何预算字段调整必须同时核验 `maxRandomCalls`、旧 `maxRollCount` 映射和 `meta.budgetKind='randomCalls'` | `npm.cmd test -- test/issues/issue-009-d-limits.test.ts test/v1/evaluation-context.test.ts` |
| #10 COC 奖惩骰 | 已经按上游关闭规则固化 | 后续不得回退到个位 `1..10`；trace 必须继续保留十位、个位、追加十位、候选和选中值 | `npm.cmd test -- test/issues/issue-010-percentile-bonus-penalty.test.ts test/v1/roll-trace.test.ts` |
| 浏览器 README 示例 | 已经补入纯 TypeScript、Vite、React、Vue 路径 | 新增公开 API、错误码、diagnostic 或 feature flag 时，README 必须同步更新并被测试锁定 | `npm.cmd test -- test/issues/readme-browser-examples.test.ts test/issues/readme-feature-flags.test.ts` |
| `d` 形式化文档与错误码 | 已经有合同框架，后续仍应当按 #11 深化 | README 槽位表、互斥矩阵、`DNode` 错误 `code/meta/range`、textarea 高亮示例必须保持同源 | `npm.cmd test -- test/issues/readme-error-codes.test.ts test/v1/runtime-errors.test.ts` |
| 浏览器包输出 | 已经建立 ESM/CJS/types 和 Vite smoke 基线 | 影响入口、类型、trace、diagnostic、feature flag 或包字段时，必须重新审计 pack 内容和 Node-only 依赖 | `npm.cmd run test:browser`; `npm.cmd pack --dry-run` |

### 当前下一批执行队列

截至 2026-07-24，测试框架、V1 边界修正、浏览器包输出、`roll()`、`RollValue`、`EvaluationContext`、显式 feature flag、program、loop、FVTT 兼容子集、结构化拒绝矩阵和 ADR-001 到 ADR-009 已经进入本地工作树。递归求值上下文复用、预算共享、`attachEvaluationContext()` 高低显式 `maxRandomCalls` 兼容桥接、parser range/expected/unsupported syntax、普通 `d` trace/raw 原始顺序、`FNode`/`ANode`/`CNode` 全局随机调用序号、嵌套 `{env}` 父子 range、browser bundle Node-only 扫描和 ADR/link 一致性测试已经建立。下一批工作必须优先处理仍会影响浏览器安全性、发布内容和 API 稳定性的缺口：

1. **运行时普通 Error 收敛已经完成**
   - `DNode`、`PNode`、`ANode`、`CNode`、`FNode` 的参数错误和预算错误已经改为 `OneDiceError`，`InterpolationNode` 缺失 env 已经改为 `VARIABLE_NOT_FOUND`。
   - `src/ast/index.ts`、`src/ast/simple.ts`、`src/ast/unary.ts` 的未知产生式/未知运算符防御分支已经改为 `PARSE_UNSUPPORTED_SYNTAX`。
   - `test/v1/runtime-errors.test.ts` 已覆盖 `DICE_TOO_MANY_ROLLS`、`DICE_INVALID_DICE_COUNT`、`DICE_INVALID_FACE_COUNT`、`VARIABLE_NOT_FOUND`、内部未知运算符和未知产生式的关键 `meta` 字段。
   - `test/issues/readme-error-codes.test.ts` 已锁定 README 的结构化错误表必须覆盖 `src/errors.ts` 中所有公开 `OneDiceErrorCode`，避免新增 program、tuple、loop 或 FVTT 错误码后浏览器 UI 文档再次落后。
   - `test/issues/no-plain-runtime-errors.test.ts` 已扫描 `src/**/*.ts`，禁止源码运行时重新引入普通 `throw new Error`。

2. **Trace range 第一轮已经完成**
   - `DiceNode` 已新增可为空的 `range`，parser resolve 会从 token/子节点范围合成 AST 节点范围。
   - `RollTrace` 已新增可为空的 `range`，并通过 `test/v1/roll-trace.test.ts` 覆盖 arithmetic/group/number/dice/percentile/fate/pool/interpolation 的源码区间。
   - `PNode` 百分骰 trace 已补齐 `onesRandomCall`、`baseTensRandomCall`、`extraTensRandomCalls` 和候选项 `randomCall/source/selected`，浏览器 UI 应当按随机调用序号回放 COC 奖惩骰候选生成过程。
   - `test/v1/json-serialization.test.ts` 已覆盖 tuple selection、tuple slice、`lp`、FVTT pool、FVTT `cs` 和 `rollProgram()` 的完整公开结果可 `JSON.stringify()`，确保 `raw`、`trace`、`diagnostics`、statement、variable snapshot 和 budget 不暴露循环引用或函数；同文件还递归断言所有已支持公开路径的序列化结果不得出现 `kind='generic'`。
   - 嵌套 `{env}` 表达式的父/子 range 坐标合同已经补齐：`InterpolationTrace.childRangeSource='input'`、`childInputRange` 说明子 trace 坐标来自 env 展开表达式，外层 `range` 仍指向原始 `{name}` 片段；缺失 env 的 `VARIABLE_NOT_FOUND.meta.range` 已指向外层插值范围。
   - `test/v1/roll-trace.test.ts` 已覆盖 `{attack}` 外层 range、env 子表达式局部 range、`childRangeSource/childInputRange` 和缺失 `{env}` 的 range 错误合同；未来新增节点仍必须补专属 trace，不得回退到 generic trace。

3. **未来语法默认拒绝基线已经完成**
   - lexer 已经在默认模式下把 `kh/kl/dh/dl`、`min/max`、`tp/sp/lp`、`df`、`$`、`;`、比较/三目符号、FVTT `{}` 池和 `@path` 识别为未来语法，并统一抛 `PARSE_UNSUPPORTED_SYNTAX`。
   - `OneDiceError.meta` 已新增 `feature` 字段，浏览器 UI 能够区分 `tupleOperators`、`clampOperators`、`tupleProjection`、`tupleSlice`、`loopOperator`、`fateAlias`、`program`、`conditionals`、`fvttCompatibility` 等保留能力。
   - `test/v1/parser-errors.test.ts` 已覆盖未来语法拒绝矩阵，并验证 `2d20k1` 等 V1 keep 语法不受影响。

4. **公开 `syntax/features` 配置骨架已经完成**
   - `src/config.ts` 已新增 `SyntaxMode`、`RollFeatureFlags`、`Config` 和安全默认 feature 表，并从 `src/index.ts` 导出。
   - `EvaluationContext` 已持有归一化后的 `syntax` 与 `features`，`attachEvaluationContext()` 会在递归求值中保留同一配置骨架。
   - `test/v1/evaluation-context.test.ts` 已覆盖默认 `'onedice'`、显式 `'fvtt-compatible'`、feature 归一化、调用方 `features` 对象不被修改，以及 `attachEvaluationContext()` 在低/高显式 `maxRandomCalls` 下对旧 `maxRollCount` 预检查的兼容桥接。
   - README 已补充 `Config.syntax` 和 `Config.features`，并说明它们当前是未来能力隔离入口，不会让未实现语法静默生效。
   - `test/issues/readme-feature-flags.test.ts` 已锁定 `RollFeatureFlags`、`DEFAULT_FEATURES`、README 和本方案的同步关系；新增 feature flag 时必须同时补默认值、README 说明和方案合同。

5. **显式元组字面量 G2 已经完成**
   - `utils/grammar.yaml` 已新增 `[`、`]`、`,` 终结符和 tuple 产生式，生成后的 `src/parser/grammar.json` 与 `src/parser/table.json` 已同步更新。
   - `src/ast/tuple.ts` 已新增 `TupleNode`，`dice('[1,2,3]', { features: { tupleLiterals: true } })` 会按旧 API 合同投影为最后一项。
   - `roll('[1,2,3]', { features: { tupleLiterals: true } })` 已返回 `raw.kind='tuple'`、`source='literal'`、`projection='last'` 和 `trace.kind='tuple'`。
   - `test/v1/tuple-literal.test.ts` 已覆盖默认拒绝、逗号拒绝、括号元素、tuple 内骰子随机预算共享、旧 API 投影和 trace/raw 合同。
   - 后续 `tupleOperators` 已按独立 feature flag 实现，显式元组阶段不得再被后续 `sp/lp/FVTT` 改动回退。

6. **元组选择运算符 M7 已经完成**
   - `utils/grammar.yaml` 已新增 `kh/kl/dh/dl` 终结符和后缀产生式，生成后的 parser 表已同步更新。
   - `src/ast/tuple-selection.ts` 已新增 `TupleSelectionNode`，实现显式元组和普通 `d` 骰子元组的 `kh/kl/dh/dl` 消费。
   - `roll()` 已返回 `trace.kind='tuple-selection'`、`selectedIndexes`、`droppedIndexes`、`count`、`inputLength` 和 operator raw 元数据。
   - `test/v1/tuple-operators.test.ts` 已覆盖 `kh/kl/dh/dl`、默认数量、稳定排序、骰子隐式元组、标量骰子消费不受影响和越界错误。
   - 后续 `min/max` clamp 已按独立 feature flag 实现，`tupleOperators` 的排序和 selected/dropped 合同不得被 clamp 或 projection 重构破坏。

7. **`min/max` clamp 运算已经完成**
   - `utils/grammar.yaml` 已新增 `min/max` 终结符和 `E2 min/max E3` 产生式，生成后的 parser 表已同步更新。
   - `src/ast/clamp.ts` 已新增 `ClampNode`，按 OneDice 语义实现 `min` 提升下限、`max` 压低上限。
   - `roll()` 已返回 `trace.kind='clamp'`、`before`、`limit`、`after` 和子 trace，tuple 模式会逐项 clamp。
   - `test/v1/clamp-operators.test.ts` 已覆盖 `5min6=6`、`7max6=6`、显式 tuple clamp 和普通骰子隐式 tuple clamp。
   - 后续 `tp` tuple projection 和 `sp` tuple slice 均已按独立 feature flag 实现；`lp/program/FVTT` 不得混入这些已完成能力的补漏。

8. **`tp` tuple projection 已经完成**
   - `utils/grammar.yaml` 已新增 `tp` 终结符和 `E4 tp` 后缀产生式，生成后的 parser 表已同步更新。
   - `src/ast/tuple-projection.ts` 已新增 `TupleProjectionNode`，只读取左侧已求出的 `RollValue`，不得重新求值左侧表达式。
   - `roll()` 已返回 `trace.kind='tuple-projection'`、`sourceKind`、`sourceRange`、`itemCount` 和 tuple item 明细。
   - `test/v1/tuple-projection.test.ts` 已覆盖默认拒绝、普通骰子 tuple、旧 `dice()` sum 投影、显式 tuple、标量包装和 selection 元数据保留。
   - `sp` 的 1 基索引、区间闭合性、三参数顺序和越界行为已经在 `ADR-007` 固化，并已进入 `TupleSliceNode` 实现。`lp` 的循环边界、预算和作用域已经由 ADR-008 固化并进入 `LoopNode` 实现。

9. **`sp` tuple slice 已经完成**
   - 已创建 `docs/decisions/0007-tuple-slice-indexing.md`，并按其规则实现单索引、闭区间、步进区间和错误码合同。
   - `utils/grammar.yaml` 已新增 `sp` 终结符和 `E4 sp T` 后缀产生式，生成后的 parser 表已同步更新。
   - `src/ast/tuple-slice.ts` 已新增 `TupleSliceNode`，按 tuple-required 规则消费左侧 raw tuple，不对标量左值做隐式包装。
   - `roll()` 已返回 `trace.kind='tuple-slice'`、`sourceIndexes`、`resultIndexes`、`start`、`end`、`step` 和 item 明细。
   - `test/v1/tuple-slice.test.ts` 已覆盖默认拒绝、缺少 tuple literal flag、单索引、闭区间、步进区间、普通骰子 tuple 和无效索引错误。

10. **`rollProgram()` M9a/M9b 已经完成**
   - `src/program.ts` 已新增 program scanner，按顶层 `;` 切分 statement，并保留 statement `range`、`expression` 和空 statement 错误合同。
   - `rollProgram()` 已让所有 statement 共享同一个 `EvaluationContext`、随机预算、变量表和 diagnostics，最终 `value/raw` 来自最后一条 statement。
   - `$0e(...)`、`$1e(...)` 和 `$tNamee(...)` 已实现为 program-only 赋值语法，变量快照保存完整 `RollValue`，读取时通过 `VariableReferenceNode` 返回保存的 raw/value 克隆，避免 tuple selection、slice 或 clamp 消费变量时污染最终变量快照。
   - `test/v1/program.test.ts` 已覆盖 `$0e(2d6);$0+1`、变量覆盖、`$tTotal` 命名变量、缺失变量 `VARIABLE_NOT_FOUND`、读取 raw clone 引用隔离和旧 `dice('$0')` 默认拒绝。
   - `dice()` 和普通 `roll()` 仍不得默认接受 `$` 或 `;`；`lp` 通过独立 `features.loopOperator` 合同启用，未开启时仍被默认拒绝。

11. **比较、布尔和三目 M9c 已经完成**
   - `utils/grammar.yaml` 已新增 conditionals 层级，`? :`、`|`、`&`、`>`、`<`、`=` 的优先级遵守 ADR-004。
   - `src/ast/conditionals.ts` 已新增 `ComparisonNode`、`BooleanNode` 和 `ConditionalNode`，比较/布尔返回数值布尔 `1/0`。
   - `ConditionalNode` 已实现短路求值，只执行被选中的分支，未选分支不会消耗随机数或触发缺失变量。
   - `roll()` trace 已新增 `comparison`、`boolean` 和 `conditional`，并保留 `conditionTrace`、`selectedTrace` 和分支 range。
   - `test/v1/conditionals.test.ts` 已覆盖默认拒绝、比较/布尔优先级、三目短路和 `rollProgram()` 变量条件分支。
12. **`lp` 循环 M9d 已经完成**
   - 已创建 `docs/decisions/0008-loop-operator-bounds.md`，固化标量边界、tuple 边界、三元素 `[leftBoundary,step,end]`、循环预算和局部 `i` 作用域。
   - `utils/grammar.yaml` 已新增 `lp` 终结符和 `E4 lp T` 产生式，生成后的 parser 表已同步更新。
   - `src/ast/loop.ts` 已新增 `LoopNode`，循环体共享同一个 `EvaluationContext`，每轮恢复外层变量表，并返回 `source='loop'` 的 tuple raw。
   - `src/evaluation/context.ts` 的 `VariableStore` 已新增只读绑定保护；`LoopNode` 每轮使用只读 `i`，恢复外层变量时走强制路径，避免未来赋值或 shadowing 语法绕过 `VARIABLE_READONLY` 合同。
   - `roll()` trace 已新增 `kind='loop'`，包含 `boundsTrace`、`bounds`、`itemCount` 和每轮 `iterations`。
   - `test/v1/loop-operator.test.ts` 已覆盖默认拒绝、标量边界、tuple 边界、三目短路、随机调用顺序、变量不泄漏、循环次数预算和循环深度预算；`test/v1/evaluation-context.test.ts` 已覆盖只读变量覆盖时抛 `VARIABLE_READONLY` 和 `meta.variable/range`。

13. **FVTT 兼容 M10a-M10m 已经阶段完成**
   - 默认 `syntax: 'onedice'` 已继续拒绝 `@path`，错误 `meta.feature='fvttCompatibility'`，不会污染默认 OneDice 语法。
   - lexer 已新增 `1d20cs>15` 等 FVTT success-counting 保留语法识别；默认模式或未启用 `features.fvttSuccessCounting` 时抛 `PARSE_UNSUPPORTED_SYNTAX` 且 `meta.feature='fvttSuccessCounting'`。
   - `syntax: 'fvtt-compatible'` 已通过 `src/parser/fvtt-normalize.ts` 把明确的 FVTT 骰池 `{4d6,3d8}` 归一化为内部 tuple literal `[4d6,3d8]`，并只在本次 parse 内部开启 `tupleLiterals`，不得污染调用方 `features` 或共享 `EvaluationContext.features`。
   - `{4d6,3d8}kh` 与 `{4d6,3d8}kl` 已复用 `TupleSelectionNode`、`RollValue` tuple operator 投影和 `trace.kind='tuple-selection'`；调用方仍必须传入 `features: { tupleOperators: true }`，兼容模式不得绕过 tuple operator 的 feature flag 合同。
   - FVTT pool 归一化会产生 `SYNTAX_NORMALIZED` diagnostic，包含 `range`、`feature='fvttPool'`、`original='{4d6,3d8}'` 和 `normalized='[4d6,3d8]'`；`{attack}` 与 `{attack,bonus}` 继续按 `{env}` 插值处理。
   - `syntax: 'fvtt-compatible'` 已支持 `@path.to.data` 先调用同步 `Config.resolver(path, context)`，resolver 返回 `undefined` 时再从 `env` 读取有限数字或数字字符串，并通过 `VariableReferenceNode` 输出 `trace.kind='variable'`。
   - resolver context 已包含 `syntax: 'fvtt-compatible'`、变量 token 的 `range` 和当前表达式 `originalInput`；resolver 返回 `RollValue` 时会复制 raw 后再投影，不得复用调用方传入的可变对象引用。
   - 缺失 `@path` 会抛 `VARIABLE_NOT_FOUND`；非数字值会抛 `VARIABLE_INVALID_VALUE`。
   - resolver 抛出的普通异常会包裹为 `VARIABLE_RESOLVER_FAILED`，并在 `meta.actual`、`meta.variable`、`meta.range` 中保留浏览器 UI 可展示的信息。
   - `test/v1/fvtt-compatibility.test.ts` 已覆盖成功读取、数字 env、resolver 优先、resolver `undefined` 回退 env、resolver 返回 `RollValue`、resolver 抛错、缺失变量、非数字变量错误、FVTT pool 成功归一化、无 keep/drop 的 tuple raw，以及 `{env}` 边界。
   - `test/browser/vite-import.test.ts` 已从“只确认 Vite 能 build”升级为“build 后执行产物并检查 DOM 输出 + bundle Node-only 依赖扫描”；浏览器 bundle 会实际调用 V1、`rollProgram()`、`lp`、FVTT pool、`@path` resolver、`df` alias、`cs` 成功计数和 Foundry runtime binding 拒绝路径，并断言产物不含 `fs/path/os/crypto` import、`process.` 或 `Buffer`。
   - 爆骰、重骰已在 lexer 层结构化识别为未实现 FVTT-only modifier；默认模式和 `syntax: 'fvtt-compatible'` 均抛 `PARSE_UNSUPPORTED_SYNTAX`，并分别填充 `meta.feature='fvttExplode'` / `meta.feature='fvttReroll'`。普通 V1 `x` 乘法已通过 `2x3=6` 回归测试保护。
   - `!`、后缀 `?` 和 FVTT `cf` 已建立结构化拒绝基线：`!1` / `5!` 归入 `factorialOrNotOperator`，`5?` 归入 `stepSumOperator`，`1?2:3` 仍归入 `conditionals`，`1d6cf<3` / `1d6cf` 归入 `fvttFailureCounting`。
   - Foundry `df`/`sf`/`ms`/`even`/`odd` 计数族已补齐结构化拒绝矩阵；`1d6df1` 不再误报为 FATE alias，`1d6sf<3` 不再误报为 conditionals，`1d6ms10` / `1d6even` / `1d6odd` 不再落入普通 parser 错误。
   - Foundry chat roll mode 已补齐结构化拒绝矩阵；`/roll`、`/r`、`/publicroll`、`/pr`、`/gmroll`、`/gmr`、`/blindroll`、`/broll`、`/br`、`/selfroll`、`/sr` 均归入 `fvttRuntimeBinding`，不再误报为除法或普通 parser 错误。
   - 非骰 FVTT pool 已补齐结构化拒绝边界；`{attack,bonus}` 继续按 `{env}` key 处理，`{attack,bonus}kh` 在默认模式下归入 `fvttCompatibility`，在 `syntax: 'fvtt-compatible'` 下归入 `fvttNonDicePool`，不得误提示“未开启 FVTT 兼容”。
   - 无目标 `cs` 成功计数已补齐结构化拒绝矩阵；`1d20cs` 在默认模式和 `syntax: 'fvtt-compatible'` 未开 flag 时归入 `fvttSuccessCounting`，在显式开启 `features.fvttSuccessCounting` 后仍抛目标缺失错误，range 指向输入末尾，不得采用 Foundry 默认目标语义。
   - Foundry actor/item/UUID/Compendium 深度绑定已补齐结构化拒绝矩阵；`@Actor[abc123]`、`@Item[item123]`、`@UUID[Actor.abc123]`、`@Compendium[world.spells.fireball]` 在默认模式和 `syntax: 'fvtt-compatible'` 下均归入 `fvttRuntimeBinding`，range 指向 `@Actor`/`@Item`/`@UUID`/`@Compendium` 前缀，兼容模式下不得调用 resolver，也不得把 `[` 误报为 tuple literal。
   - 小写 `@actor.path` 仍是受控 `@path` resolver 语法；M10m 只拦截带大写 Foundry 文档绑定前缀且后接 `[` 的输入，避免把宿主 document lookup、UUID 解析、actor/item 副作用路径混入浏览器核心。

14. **ADR 与执行方案一致性已经加固**
   - `docs/decisions/0001-browser-package-output.md` 已补齐 `sideEffects=false`、Node-only bundle 扫描和 browser smoke 验收要求，避免浏览器包输出策略落后于实现。
   - `docs/decisions/0003-roll-value-model.md` 已同步 `RollValue`、`projectToNumber()`、显式 tuple、tuple operator、JSON-safe trace 和 `rollProgram()` 证据。
   - `docs/decisions/0004-v2-operator-precedence.md` 已同步 tuple selection、clamp、`tp`、`sp`、conditionals、`lp` 的当前实现证据、feature flag 隔离和默认拒绝合同。
   - `docs/decisions/0005-variable-marker-strategy.md` 已同步 `$0/$1`、`$tName`、只读循环 `i`、FVTT `@path` resolver、`VARIABLE_READONLY` 和 `VARIABLE_RESOLVER_FAILED` 的当前实现状态。
   - `docs/decisions/0006-fvtt-compatibility-scope.md` 已同步 FVTT dice pool、`@path`、`kh/kl/dh/dl`、`min/max`、`df`、带目标值 `cs`、`fvttNonDicePool` 和 `fvttRuntimeBinding` 的当前受控子集与拒绝边界。
   - `docs/decisions/0007-tuple-slice-indexing.md` 已同步 `features.tupleSlice`、`trace.kind='tuple-slice'`、slice 结构化错误码、README 错误表和 JSON-safe trace 证据。
   - `docs/decisions/0008-loop-operator-bounds.md` 已同步 `EvaluationContext.variables` 只读保护、`VARIABLE_READONLY`、`loopIterations` / `loopDepth` 预算证据和 `lp` JSON-safe trace 证据。
   - `test/issues/docs-cross-links.test.ts` 已从单纯互链测试扩展为 ADR-001 到 ADR-009 的关键合同锁定；后续浏览器包入口、错误/诊断、变量语义、tuple slice、循环预算、FVTT 兼容范围、FVTT success-counting、发布内容或副作用策略变化时必须同步 ADR。

15. **为后续 V2 写剩余 ADR**
   - 已创建 `docs/decisions/0004-v2-operator-precedence.md`，实现 `kh/kl/dh/dl/min/max/tp/sp/lp` 前必须遵守其优先级和消费模式。
   - 已创建 `docs/decisions/0005-variable-marker-strategy.md`，实现变量或多语句前必须遵守其默认语法、program API 和 FVTT `@path` 隔离规则。
   - 已创建 `docs/decisions/0006-fvtt-compatibility-scope.md`，实现 FVTT 兼容模式前必须遵守其范围限制和默认模式隔离规则。
   - 已创建 `docs/decisions/0007-tuple-slice-indexing.md`，实现或修改 `sp` 前必须遵守 1 基索引、闭区间、步进区间和越界错误合同。
   - 已创建 `docs/decisions/0008-loop-operator-bounds.md`，实现或修改 `lp` 前必须遵守其边界、预算和作用域规则。
   - 已创建 `docs/decisions/0009-fvtt-success-counting.md`，实现或修改 FVTT `cs` 前必须遵守显式目标值、feature flag、trace 和未实现 Foundry 能力拒绝合同。

16. **`df` FATE alias 已经完成**
   - 默认 `syntax: 'onedice'` 且未启用 feature 时，`4df` 继续抛 `PARSE_UNSUPPORTED_SYNTAX`，`meta.feature='fateAlias'`。
   - 启用 `features.fateAlias` 后，lexer 会把 `df` 归一化为 `f`，复用 `FNode`、FATE trace、随机预算和 `dice()` 旧 API 数值投影。
   - `roll().diagnostics` 会返回 `SYNTAX_NORMALIZED`，并包含 `range`、`feature='fateAlias'`、`original='df'`、`normalized='f'`。
   - `test/v1/fate-alias.test.ts` 已覆盖默认拒绝、`4df` 启用路径、缺省 `df` 和 `1dfoo` 近邻反例。

## 第一阶段完成定义

第一阶段完成时必须满足下列硬性验收。每一项都应当能映射到测试文件、README/ADR 证据或浏览器打包命令，不能只凭人工阅读判断：

| 完成项 | 必须满足的技术细节 | 验收证据 |
| --- | --- | --- |
| 测试入口 | `npm.cmd test` 必须覆盖 V1 算术、`d`、`p/b`、`a/c/f`、parser 错误、预算、trace、JSON-safe 序列化、FVTT 子集和文档互链 | `npm.cmd test` |
| 类型入口 | `npm.cmd run typecheck` 必须覆盖公开导出、`RollResult`、`RollValue`、`RollTrace`、`RollDiagnostic`、`OneDiceError` 和 config 类型 | `npm.cmd run typecheck` |
| 旧 API 兼容 | `dice()` 必须继续返回 `[number, DiceNode]`；显式 tuple/program/FVTT 能力不得默认改变旧返回形态 | V1 回归测试、README 兼容 API 小节 |
| #9 上限与预算 | `1d10000`、`10000d1` 是语义合法；`10001d1`、`1d10001` 是参数错误；低预算是 `EVALUATION_BUDGET_EXCEEDED`，三者不得混淆 | `test/issues/issue-009-d-limits.test.ts`、预算测试 |
| #10 奖惩骰 | 十位为 `00..90`、个位为 `0..9`、`00+0=>100`，奖励取较小最终百分值，惩罚取较大最终百分值；trace 必须保留候选来源 | `test/issues/issue-010-percentile-bonus-penalty.test.ts`、`test/v1/roll-trace.test.ts` |
| 浏览器入口 | README 必须包含纯 TypeScript、Vite、React、Vue 的最小接入片段；示例必须展示 `roll()`、`diagnostics`、`OneDiceError.code/meta` 和确定性随机源 | README 示例测试、`npm.cmd run test:browser` |
| 发布内容 | npm 包必须只发布受控产物，且 ESM/CJS/types 均从 `dist` 消费；bundle 不得含 Node-only 依赖、WASM/native addon 或临时 tarball | `npm.cmd run test:browser`、`npm.cmd pack --dry-run` |
| 文档互链 | `docs/upstream-onedice-issues.md`、本方案、README 和 ADR-001 到 ADR-009 必须互相可发现；新增公开错误码、feature flag、trace kind 或 diagnostic code 必须同步 | `test/issues/docs-cross-links.test.ts` |
| 未定能力隔离 | 未设计清楚的 V2/FVTT 能力必须被 lexer/scanner/parser 早期识别并结构化拒绝；不得通过默认 `dice()` 或普通 `roll()` 隐式启用 | `test/v1/parser-errors.test.ts`、对应 ADR 暂缓清单 |

### 2026-07-25 第一阶段验收审计

本审计逐项对应上方完成定义，所有结论都必须来自实际命令、测试文件或文档护栏，不得只凭人工阅读判断：

| 完成项 | 当前结论 | 2026-07-25 验收证据 |
| --- | --- | --- |
| 测试入口 | 已通过 | `npm.cmd test` 通过，覆盖 `test/v1` 与 `test/issues` 共 29 个测试文件、323 个测试 |
| 类型入口 | 已通过 | `npm.cmd run typecheck` 通过，`tsc --noEmit` 未报告类型错误 |
| 旧 API 兼容 | 已通过 | `npm.cmd test` 中的 V1 回归、`dice()`/`roll()`/`rollProgram()`、tuple/program/FVTT 默认拒绝与启用路径测试均通过 |
| #9 上限与预算 | 已通过 | `test/issues/issue-009-d-limits.test.ts` 与 `test/v1/evaluation-context.test.ts` 随 `npm.cmd test` 通过，语义上限和随机预算继续分离 |
| #10 奖惩骰 | 已通过 | `test/issues/issue-010-percentile-bonus-penalty.test.ts` 与 `test/v1/roll-trace.test.ts` 随 `npm.cmd test` 通过，百分骰候选与 trace 合同未回退 |
| 浏览器入口 | 已通过 | `npm.cmd run test:browser` 通过，构建后执行 Vite fixture 与 browser package tests 共 2 个测试文件、4 个测试 |
| 发布内容 | 已通过 | `npm.cmd pack --dry-run` 通过且显示 8 个发布文件；`Get-ChildItem -Name *.tgz` 无输出，dry-run 后没有临时包残留 |
| 文档互链 | 已通过 | `test/issues/docs-cross-links.test.ts` 通过，锁定 README、本方案、上游 issue 记录和 ADR-001 到 ADR-009 的关键合同 |
| 未定能力隔离 | 已通过 | `test/v1/parser-errors.test.ts` 与 FVTT 兼容拒绝矩阵随 `npm.cmd test` 通过，未实现 V2/FVTT 能力继续结构化拒绝 |
| 应当化用词 | 已通过 | 已执行软性口吻扫描，方案相关文档未保留以“建”+“议”表达执行事项的口吻 |

## 后续 ADR 清单

以下主题应当在实现前写 ADR：

1. `ADR-001`: 浏览器包输出策略，决定 tsup/Rollup/tsc 和 ESM/CJS 结构。（已创建：`docs/decisions/0001-browser-package-output.md`）
2. `ADR-002`: 错误码与诊断模型，决定 `OneDiceError` 和 `RollDiagnostic`。（已创建：`docs/decisions/0002-error-diagnostics.md`）
3. `ADR-003`: 元组与标量投影规则，决定 `RollValue`。（已创建：`docs/decisions/0003-roll-value-model.md`）
4. `ADR-004`: V2 运算符优先级，决定 `kh/kl/dh/dl/min/max/tp/sp/lp` 的绑定方式。（已创建：`docs/decisions/0004-v2-operator-precedence.md`）
5. `ADR-005`: 变量标记策略，决定 `$`、`$t`、`@`、`{}` 的边界。（已创建：`docs/decisions/0005-variable-marker-strategy.md`）
6. `ADR-006`: FVTT 兼容模式范围，决定默认语法和兼容语法的隔离方式。（已创建：`docs/decisions/0006-fvtt-compatibility-scope.md`）
7. `ADR-007`: `sp` 元组裁切索引规则，决定单索引、闭区间、步进区间和越界错误合同。（已创建：`docs/decisions/0007-tuple-slice-indexing.md`）
8. `ADR-008`: `lp` 循环边界、预算和作用域规则，决定标量边界、tuple 边界、三元素边界、局部 `i` 和循环预算合同。（已创建：`docs/decisions/0008-loop-operator-bounds.md`）
9. `ADR-009`: FVTT `cs` 成功计数子集，决定显式 flag、adapter 边界、trace 合同和暂不实现的 Foundry success/failure 能力。（已创建：`docs/decisions/0009-fvtt-success-counting.md`）

ADR 应当放在：

```text
docs/decisions/
```

命名应当使用：

```text
0001-browser-package-output.md
0002-error-diagnostics.md
0003-roll-value-model.md
0004-v2-operator-precedence.md
0005-variable-marker-strategy.md
0006-fvtt-compatibility-scope.md
0007-tuple-slice-indexing.md
0008-loop-operator-bounds.md
0009-fvtt-success-counting.md
```

每份 ADR 必须包含：

- 背景
- 决策
- 备选方案
- 兼容性影响
- 测试要求
- 回滚策略















