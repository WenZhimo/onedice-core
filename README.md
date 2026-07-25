# @onedice/core

`@onedice/core` 是 OneDice 掷骰表达式标准的 TypeScript 实现。本 fork 的改进目标是让核心库更适合浏览器应用使用：可测试、可打包、可复现随机结果，并逐步对齐上游 OneDice issue 中已经确认的行为。

上游标准文档：<https://github.com/OlivOS-Team/onedice>

## 安装

```bash
npm install @onedice/core
```

## 本地开发

```bash
npm install
npm run typecheck
npm test
npm run build
npm run test:browser
```

当前仓库以 npm 为本地开发入口。单元测试使用 Vitest，浏览器烟测使用 Vite。构建脚本使用 tsup 输出 ESM、CJS 和类型声明到 `dist/`。

## 浏览器使用

在 Vite、React、Vue 或其他现代前端项目中，应当直接从包入口导入公开 API：

```ts
import { dice } from '@onedice/core'

const [value, root] = dice('2d20k1')

console.log(value)
console.log(root.toString())
```

包入口提供双格式输出：

- ESM：`dist/index.mjs`
- CJS：`dist/index.cjs`
- 类型声明：`dist/index.d.ts`

`package.json` 的 `exports` 已经指向这些构建产物，现代打包器会自动选择 ESM 入口。

如果需要在浏览器 UI 中复现同一次掷骰，应当传入自定义随机数函数：

```ts
import { dice } from '@onedice/core'

function sequenceRandom(values: number[]) {
  let index = 0

  return (min: number, max: number) => {
    const value = values[index++]
    if (value < min || value > max) {
      throw new Error(`random value ${value} outside [${min}, ${max}]`)
    }
    return value
  }
}

const [value] = dice('2d20k1', {
  random: sequenceRandom([11, 7]),
})

console.log(value) // 11
```

浏览器 UI 如果需要展示掷骰过程，应当使用 `roll()`，不要解析 `DiceNode#toString()`：

```ts
import { roll } from '@onedice/core'

const result = roll('2d20k1', {
  random: sequenceRandom([11, 7]),
})

console.log(result.value) // 11
console.log(result.raw)
// {
//   kind: 'tuple',
//   projection: 'sum',
//   source: 'dice-rolls',
//   items: [
//     { kind: 'scalar', value: 11, roll: { index: 0, selected: true } },
//     { kind: 'scalar', value: 7, roll: { index: 1, dropped: true } },
//   ],
// }

if (result.trace.kind === 'dice') {
  console.log(result.trace.rolls)
  // rolls 按原始投掷顺序排列；UI 如需按点数或保留状态展示，应当自行排序。
}
```

### 浏览器框架接入片段

以下片段应当作为浏览器接入的最小形态：UI 使用 `roll()` 获取结构化结果，使用 `OneDiceError.code/meta` 渲染失败，展示 `diagnostics`，并在测试或回放场景注入确定性随机源。

#### 纯 TypeScript

```ts
import {
  OneDiceError,
  roll,
  type OneDiceErrorMeta,
  type RollResult,
} from '@onedice/core'

type BrowserRollOutcome =
  | { ok: true; result: RollResult }
  | { ok: false; code: string; meta: OneDiceErrorMeta; message: string }

function rollForBrowser(input: string): BrowserRollOutcome {
  try {
    return {
      ok: true,
      result: roll(input, {
        random: sequenceRandom([11, 7]),
      }),
    }
  } catch (error) {
    if (error instanceof OneDiceError) {
      return {
        ok: false,
        code: error.code,
        meta: error.meta,
        message: error.message,
      }
    }
    throw error
  }
}

const input = document.querySelector<HTMLInputElement>('#dice-input')!
const output = document.querySelector<HTMLPreElement>('#dice-output')!

input.addEventListener('input', () => {
  const outcome = rollForBrowser(input.value)
  output.textContent = JSON.stringify(outcome, null, 2)
})
```

#### Vite

```ts
import { OneDiceError, roll } from '@onedice/core'

const app = document.querySelector<HTMLDivElement>('#app')!

try {
  const result = roll('4df', {
    features: { fateAlias: true },
    random: sequenceRandom([-1, 0, 1, 1]),
  })

  app.textContent = JSON.stringify({
    value: result.value,
    diagnostics: result.diagnostics.map(diagnostic => diagnostic.code),
  })
} catch (error) {
  if (error instanceof OneDiceError) {
    app.textContent = `${error.code}: ${error.meta.hint ?? error.message}`
  }
}
```

#### React

```tsx
import { useMemo, useState } from 'react'
import { OneDiceError, roll, type RollDiagnostic, type RollResult } from '@onedice/core'

export function DicePanel() {
  const [expression, setExpression] = useState('2d20k1')
  const random = useMemo(() => sequenceRandom([11, 7]), [])

  let result: RollResult | null = null
  let diagnostics: RollDiagnostic[] = []
  let errorText = ''

  try {
    result = roll(expression, { random })
    diagnostics = result.diagnostics
  } catch (error) {
    if (error instanceof OneDiceError) {
      errorText = `${error.code}: ${error.meta.hint ?? error.message}`
    } else {
      throw error
    }
  }

  return (
    <section>
      <input value={expression} onChange={event => setExpression(event.target.value)} />
      <output>{result ? result.value : errorText}</output>
      <pre>{JSON.stringify({ trace: result?.trace, diagnostics }, null, 2)}</pre>
    </section>
  )
}
```

#### Vue

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { OneDiceError, roll } from '@onedice/core'

const expression = ref('2d20k1')

const outcome = computed(() => {
  try {
    const result = roll(expression.value, {
      random: sequenceRandom([11, 7]),
    })

    return {
      ok: true,
      value: result.value,
      trace: result.trace,
      diagnostics: result.diagnostics,
    }
  } catch (error) {
    if (error instanceof OneDiceError) {
      return {
        ok: false,
        code: error.code,
        meta: error.meta,
      }
    }
    throw error
  }
})
</script>

<template>
  <input v-model="expression">
  <pre>{{ outcome }}</pre>
</template>
```

`roll()` 返回：

| 字段 | 用途 |
| --- | --- |
| `value` | 标量结果，兼容旧数值消费方式 |
| `raw` | 原始值模型；普通 `d` 会保留每个骰子的 tuple item |
| `trace` | JSON-safe 掷骰过程，适合浏览器 UI 展示 |
| `diagnostics` | 非致命提示；当前已用于 `SYNTAX_NORMALIZED`，例如 `df` 归一化为 `f` 或 FVTT 池归一化为内部 tuple |
| `root` | AST 根节点，保留调试能力 |

普通 `d` 的 `trace.rolls` 与 `raw.items` 都按原始投掷顺序排列。`index` 表示原始下标，`randomCall` 表示本次表达式求值中的随机调用序号，`selected/dropped` 表示选取线处理后的状态。

COC 奖惩骰 `p/b` 的 `trace.candidates` 会保留基础十位和额外十位的最终百分值、`randomCall`、来源 `source` 和 `selected` 状态；`onesRandomCall`、`baseTensRandomCall` 与 `extraTensRandomCalls` 可用于浏览器按随机调用顺序回放候选生成过程。

`{env}` 插值的 trace 会同时保留外层和展开表达式坐标：`trace.range` 指向原始输入中的 `{name}`，子 trace 的 `range` 以 `trace.input` 为坐标系，`childRangeSource: 'input'` 与 `childInputRange` 用于告诉浏览器编辑器如何展示展开后的局部表达式。

浏览器 UI 应当优先根据错误码展示提示，而不是解析错误文本：

```ts
import { dice, OneDiceError } from '@onedice/core'

try {
  dice('2d20k1b1')
} catch (error) {
  if (error instanceof OneDiceError) {
    switch (error.code) {
      case 'DICE_INCOMPATIBLE_MODIFIERS':
        console.log('k/q 不能和 p/b 同时使用')
        break
      case 'DICE_INVALID_FACE_COUNT':
        console.log('骰子面数必须在 1 到 10000 之间')
        break
      default:
        console.log(error.message)
    }
  }
}
```

## 当前 API

```ts
function dice(input: string, config?: Config): [number, DiceNode]
function roll(input: string, config?: Config): RollResult
function rollProgram(input: string, config?: Config): ProgramResult
```

常用配置：

```ts
interface Config {
  random?: (min: number, max: number) => number
  maxRollCount?: number
  maxRandomCalls?: number
  maxEvaluationSteps?: number
  maxLoopIterations?: number
  maxLoopDepth?: number
  syntax?: 'onedice' | 'fvtt-compatible'
  features?: {
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
  env?: Record<string, string | number>
  resolver?: (path: string, context: {
    syntax: 'fvtt-compatible'
    range?: { start: number; end: number }
    originalInput: string
  }) => string | number | RollValue | undefined
}
```

- `random` 用于替换默认随机数，适合测试、回放和浏览器演示。
- `maxRollCount` 是旧配置名，继续兼容一次表达式允许消耗的随机调用预算，默认值为 `10000`。`maxRandomCalls` 是新的显式随机调用预算字段；两者同时传入时，`maxRandomCalls` 优先，并且可以显式提高高成本 `p/f/a/c` 等骰子族的随机调用预算；普通 `d` 的骰数和面数语义上限仍固定为 `10000`。`maxEvaluationSteps`、`maxLoopIterations` 和 `maxLoopDepth` 用于限制 `lp` 等高成本语法。
- `syntax` 默认是 `'onedice'`；`'fvtt-compatible'` 是 FVTT 兼容模式的显式入口，当前已支持 FVTT dice pool 归一化、`@path` resolver/env 读取数值，以及显式 flag 下的 `cs` 成功计数。
- `features` 默认全部关闭，用于逐项启用已经实现且有测试覆盖的 V2/FVTT 能力；未实现语法仍会抛 `PARSE_UNSUPPORTED_SYNTAX`。`features.program` 是 `rollProgram()` 的内部隔离开关，普通调用方应当直接使用 `rollProgram()`，不得让 `dice()` / `roll()` 默认获得有状态语义。`features.fateAlias` 会把 `df` 归一化为 FATE `f`，`features.fvttSuccessCounting` 会在 `syntax: 'fvtt-compatible'` 下启用带目标值的 `cs` 成功计数。`features.variableAliases` 仍是预留隔离开关，默认不得把 `$0` 与 `@0` 视为等价；启用语义必须等待 ADR 和测试合同。
- `env` 用于 `{name}` 插值表达式；在 `syntax: 'fvtt-compatible'` 下也用于 `@path.to.data` 的回退读取，值必须是有限数字或数字字符串。
- `resolver` 是 FVTT 兼容模式下的同步 `@path` 解析器；它优先于 `env`，返回 `undefined` 时才回退到 `env[path]`。resolver 抛出的普通异常会包裹为 `VARIABLE_RESOLVER_FAILED`。

`rollProgram()` 当前实现 M9a/M9b/M9c/M9d 的 program 能力：它支持用 `;` 分隔多个普通表达式，所有 statement 共享同一个随机预算和循环预算，最终 `value` 和 `raw` 来自最后一个 statement。它还支持 `$0`、`$1` 等数字寄存器和 `$tName` 命名临时变量；赋值语法为 `$0e(...)` / `$tNamee(...)`，变量会保存完整 `raw`，后续表达式读取时再由消费方投影为 number。开启 `features.conditionals` 后，比较、布尔和三目分支可在 `roll()` / `rollProgram()` 中使用；开启 `features.loopOperator` 后，`lp` 循环可用局部只读变量 `i` 生成 tuple raw，并受 `maxLoopIterations`、`maxLoopDepth` 和 `maxEvaluationSteps` 约束。

```ts
import { rollProgram } from '@onedice/core'

const program = rollProgram('$0e(2d6);$0+1', {
  random: sequenceRandom([2, 5]),
})

console.log(program.value) // 8
console.log(program.statements.map(statement => statement.result.value)) // [7, 8]
console.log(program.variables['$0'].raw.kind) // 'tuple'
console.log(program.budget.randomCalls) // 2
```

FVTT 兼容模式当前支持 dice pool 归一化、`@path` resolver/env 读取数值，以及显式 flag 下的带目标值 `cs` 成功计数。默认 OneDice 模式仍会拒绝 FVTT 专属 `{4d6,3d8}kh`、`@path` 与 `cs`，避免污染 `{env}` 插值和原生 OneDice 语法。

```ts
import { roll } from '@onedice/core'

const pool = roll('{4d6,3d8}kh', {
  syntax: 'fvtt-compatible',
  features: { tupleOperators: true },
  random: sequenceRandom([6, 2, 3, 4, 7, 1, 2]),
})

console.log(pool.value) // 15
console.log(pool.trace.kind) // 'tuple-selection'
console.log(pool.diagnostics[0])
// {
//   code: 'SYNTAX_NORMALIZED',
//   feature: 'fvttPool',
//   original: '{4d6,3d8}',
//   normalized: '[4d6,3d8]'
// }

const fvtt = roll('@abilities.str.mod + 1', {
  syntax: 'fvtt-compatible',
  env: {
    'abilities.str.mod': 3,
  },
})

console.log(fvtt.value) // 4

const resolved = roll('@actor.system.bonus + 1', {
  syntax: 'fvtt-compatible',
  env: {
    'actor.system.bonus': 2,
  },
  resolver(path) {
    if (path === 'actor.system.bonus') return 4
    return undefined
  },
})

console.log(resolved.value) // 5

const successes = roll('4d6cs>4', {
  syntax: 'fvtt-compatible',
  features: { fvttSuccessCounting: true },
  random: sequenceRandom([5, 4, 6, 1]),
})

console.log(successes.value) // 2
console.log(successes.trace.kind) // 'success-count'
```

已实现的 feature flags：

```ts
import { roll } from '@onedice/core'

const tuple = roll('[2,7,4]kh1', {
  features: {
    tupleLiterals: true,
    tupleOperators: true,
  },
})

console.log(tuple.value) // 7
console.log(tuple.raw.selected) // [false, true, false]
console.log(tuple.raw.dropped) // [true, false, true]

const diceTuple = roll('2d20kh1', {
  features: { tupleOperators: true },
  random: sequenceRandom([7, 19]),
})

console.log(diceTuple.value) // 19

const clamped = roll('[7,4]max5', {
  features: {
    tupleLiterals: true,
    clampOperators: true,
  },
})

console.log(clamped.value) // 9
console.log(clamped.raw.items.map(item => item.value)) // [5, 4]

const projected = roll('3d100tp', {
  features: { tupleProjection: true },
  random: sequenceRandom([10, 20, 30]),
})

console.log(projected.value) // 60
console.log(projected.raw.items.map(item => item.value)) // [10, 20, 30]

const sliced = roll('[1,2,3,4,5,6]sp[2,5]', {
  features: {
    tupleLiterals: true,
    tupleSlice: true,
  },
})

console.log(sliced.value) // 14
console.log(sliced.raw.items.map(item => item.value)) // [2, 3, 4, 5]

const branched = roll('1?1d8:1d4', {
  features: { conditionals: true },
  random: sequenceRandom([6]),
})

console.log(branched.value) // 6

const looped = roll('3lp[i>1?1d6:0]', {
  features: { loopOperator: true, conditionals: true },
  random: sequenceRandom([4, 5]),
})

console.log(looped.value) // 9
console.log(looped.raw.items.map(item => item.value)) // [0, 4, 5]
console.log(looped.trace.kind) // 'loop'

const fateAlias = roll('4df', {
  features: { fateAlias: true },
  random: sequenceRandom([0, 1, 2, 0]),
})

console.log(fateAlias.value) // 1
console.log(fateAlias.diagnostics[0].code) // 'SYNTAX_NORMALIZED'
```

- `tupleLiterals` 启用显式元组字面量，例如 `[1,2,3]`；旧 `dice()` 会把顶层元组投影为最后一项。
- `tupleOperators` 启用 `kh/kl/dh/dl`，可消费显式元组或普通 `d` 的骰子元组。
- `clampOperators` 启用 `min/max`，其中 `AminB` 会把低于 `B` 的值提升到 `B`，`AmaxB` 会把高于 `B` 的值降低到 `B`。
- `tupleProjection` 启用 `tp`，用于把普通 `d` 的骰子结果或显式元组暴露为 `roll().raw.kind === 'tuple'`；旧 `dice()` 仍返回数字，并按 `sum` 投影。
- `tupleSlice` 启用 `sp`，用于按 `ADR-007` 的 1 基索引规则裁切 tuple；单索引结果仍以单元素 tuple 暴露给 `roll().raw`。
- `conditionals` 启用 `>`、`<`、`=`、`&`、`|` 和 `? :`，比较和布尔运算返回数值布尔 `1/0`，三目只求值被选中的分支。
- `loopOperator` 启用 `lp`，左侧边界按 ADR-008 归一化，循环体使用方括号 tuple body，局部变量 `i` 只在循环体内可见。
- `fvttSuccessCounting` 在 `syntax: 'fvtt-compatible'` 下启用 `cs` 成功计数；当前支持 `csN`、`cs>N`、`cs>=N`、`cs<N`、`cs<=N` 和 `cs=N`，不实现无目标默认 `cs`。
- 默认模式仍会拒绝 `[1,2,3]`、`2d20kh1`、`5min6`、`3d100tp`、`3d100sp[1]`、`3lp[i]` 和 `3>2`，浏览器 UI 可根据 `error.meta.feature` 提示用户是否开启对应能力。

## 结构化错误

当前 parser 与 `d` 表达式的关键校验已经提供稳定错误码：

| 错误码 | 触发场景 |
| --- | --- |
| `PARSE_UNEXPECTED_TOKEN` | 当前位置出现不允许的 token |
| `PARSE_UNEXPECTED_END` | 表达式提前结束 |
| `PARSE_UNSUPPORTED_SYNTAX` | 输入了已知但当前未启用的 V2/FVTT 语法 |
| `PROGRAM_EMPTY_STATEMENT` | `rollProgram()` 中出现空语句或尾随分号 |
| `DICE_INVALID_DICE_COUNT` | 骰子数量缺失、小于 `1`、大于 `10000` 或不是合法整数 |
| `DICE_INVALID_FACE_COUNT` | 面数小于 `1` 或大于 `10000` |
| `DICE_INVALID_KEEP_COUNT` | `k/q` 选取个数大于骰数 |
| `DICE_INCOMPATIBLE_MODIFIERS` | `k/q` 与 `p/b` 同时出现 |
| `DICE_POOL_MODIFIER_EXCLUSIVE` | `a` 骰池参数与 `k/q` 或 `p/b` 同时出现 |
| `DICE_TOO_MANY_ROLLS` | 旧 `maxRollCount` 预检查发现掷骰数量超过限制 |
| `PERCENTILE_INVALID_BONUS_PENALTY_COUNT` | COC 奖励/惩罚骰数量小于 `0` 或非法 |
| `EVALUATION_BUDGET_EXCEEDED` | 求值步数、随机调用、循环次数或循环深度超过预算；随机预算优先使用 `maxRandomCalls` |
| `VARIABLE_NOT_FOUND` | `{name}`、`$0` 或 `@path` 缺少对应值 |
| `VARIABLE_INVALID_VALUE` | 变量或插值结果不是有限数字 |
| `VARIABLE_RESOLVER_FAILED` | FVTT resolver 抛出普通异常 |
| `VARIABLE_READONLY` | 写入只读变量，例如 `lp` 循环局部变量 `i` |
| `TUPLE_REQUIRED` | `sp` 等 tuple-only 运算收到标量左值 |
| `TUPLE_EMPTY_PROJECTION` | 空 tuple 被投影为数字，`meta.operator/range` 指向投影消费方 |
| `TUPLE_CANNOT_PROJECT` | 当前 tuple 投影不能被旧 `dice()`、resolver 或标量消费方读取，`meta.operator/range` 指向消费方 |
| `TUPLE_INVALID_SLICE_INDEX` | `sp` 索引不是正整数 |
| `TUPLE_INVALID_SLICE_STEP` | `sp` 步长小于等于 `0` |
| `TUPLE_INVALID_SLICE_ARITY` | `sp` 参数数量不是 `1`、`2` 或 `3` |
| `TUPLE_SLICE_OUT_OF_RANGE` | `sp` 索引超过 tuple 长度 |
| `TUPLE_INVALID_SLICE_RANGE` | `sp` 起始索引大于结束索引 |
| `LOOP_INVALID_BOUNDS_ARITY` | `lp` 边界 tuple 参数数量不是 `1`、`2` 或 `3` |
| `LOOP_INVALID_BOUND` | `lp` 边界值不是整数 |
| `LOOP_INVALID_STEP` | `lp` 步长小于等于 `0` |
| `LOOP_INVALID_RANGE` | `lp` 起始值大于结束值，无法产生循环 |

`OneDiceError.meta` 会携带可供 UI 使用的结构化信息，例如 `range`、`expected`、`actual`、`limit` 和 `hint`。浏览器编辑器应当优先使用 `meta.range` 高亮出错位置。

## 当前支持的语法

| 语法 | 示例 | 状态 |
| --- | --- | --- |
| 加减乘除、乘方 | `1+2*3`, `2^3` | 已支持 |
| 小括号 | `(1+2)*3` | 已支持 |
| 普通多面骰 `d` | `2d6`, `d20` | 已支持 |
| 选取线 `k/q` | `2d20k1`, `2d20q1` | 已支持 |
| 奖惩骰 `p/b` | `p1`, `b1` | 已支持 |
| 无限加骰池 `a` | `7a5m6k4` | 已支持 |
| 双重十字加骰池 `c` | `5c10m10` | 已支持 |
| FATE 骰 `f` | `4f` | 已支持 |
| 插值 | `{default}` | 已支持 |

## `d` 表达式说明

普通多面骰应当理解为：

```text
[骰数]d[面数][骰池参数 | 选取线参数 奖惩数参数]

骰池参数：a[点数阈值]
选取线参数：(k|q)[选取个数]
奖惩数参数：(p|b)[奖惩个数]
```

有效组合：

| 表达式 | 含义 |
| --- | --- |
| `AdB` | 掷 A 个 B 面骰并求和 |
| `AdBkC` | 掷 A 个 B 面骰，保留最大的 C 个 |
| `AdBqC` | 掷 A 个 B 面骰，保留最小的 C 个 |
| `AdBpD` | 使用 COC 惩罚骰规则 |
| `AdBbD` | 使用 COC 奖励骰规则 |
| `AdBaE` | 转为骰池计数 |

约束：

- `k/q` 不得与 `p/b` 同时使用。
- `k/q` 的选取个数不得大于实际骰数。
- `a` 骰池模式应当作为独占模式处理。
- 骰数和面数必须在 `1` 到 `10000` 之间；超过该语义上限会在随机调用前失败。

## 已对齐的上游行为

- `d` 左右值支持到 `10000`；`maxRandomCalls` 控制实际随机调用预算，旧 `maxRollCount` 继续兼容；显式 `maxRandomCalls` 高于 `10000` 时，`p/f/a/c` 等非 `d` 语义上限路径不再被旧默认预检查截断。
- COC 奖惩骰采用上游 #10 的规则：十位骰为 `00, 10, ..., 90`，个位骰为 `0, 1, ..., 9`，`00 + 0` 记作 `100`。
- `/` 按 OneDice V1 标准执行整数除法。

## 已隔离实现的 V2 能力

以下能力已经实现，但默认关闭，必须通过 `features` 显式启用：

- `[]` 显式元组：`features.tupleLiterals`
- `kh/kl/dh/dl` 元组选择/丢弃：`features.tupleOperators`
- `min/max` clamp：`features.clampOperators`
- `tp` tuple projection：`features.tupleProjection`
- `sp` tuple slice：`features.tupleSlice`
- 比较、布尔和三目运算：`features.conditionals`
- `lp` 循环：`features.loopOperator`
- 多语句和寄存器：`features.program` 由 `rollProgram()` 内部开启；普通 `dice()` / `roll()` 仍默认拒绝 `$` 和 `;`
- `df` FATE alias：`features.fateAlias`，归一化为 `f` 并产生 `SYNTAX_NORMALIZED` 诊断
- FVTT `cs` 成功计数：`features.fvttSuccessCounting`，仅在 `syntax: 'fvtt-compatible'` 下启用带目标值的 `cs`

FVTT dice pool 已在 `syntax: 'fvtt-compatible'` 下实现为兼容 adapter：`{4d6,3d8}` 会归一化为内部 tuple literal，`{4d6,3d8}kh` 还必须显式启用 `features.tupleOperators`。`cs>N`、`cs>=N`、`cs=N` 和 `csN` 会通过 success-counting adapter 组装为 `SuccessCountNode`，不扩张主 grammar 表。`{attack}` 和 `{attack,bonus}` 仍按 `{env}` 插值处理，直到非骰表达式池有独立设计和测试。

## 暂不支持的 V2 能力

以下能力已经记录在改进方案中，但当前尚未实现：

- FVTT 爆骰和重骰语法
- FVTT 无目标默认成功计数 `cs`
- FVTT 非骰表达式 `{attack,bonus}` 池；当前仍按 `{env}` 插值 key 处理
- 多变量标记别名：`features.variableAliases` 仍不得把 `$0` 与 `@0` 默认视为等价，未来启用前必须先补 ADR、warning diagnostic 和默认拒绝测试
- Foundry chat roll mode、`@Actor[...]`、`@Item[...]`、`@UUID[...]` 和 Compendium/document lookup；浏览器核心不会访问 `window.game`、actor/item 或异步宿主数据源

后续实现顺序和技术约束见 [docs/improvement-plan.md](./docs/improvement-plan.md)。

## 相关文档

- [上游 issue 记录](./docs/upstream-onedice-issues.md)
- [改进方案](./docs/improvement-plan.md)
- [ADR-001：浏览器包输出策略](./docs/decisions/0001-browser-package-output.md)
- [ADR-002：错误码与诊断模型](./docs/decisions/0002-error-diagnostics.md)
- [ADR-003：RollValue 与标量投影规则](./docs/decisions/0003-roll-value-model.md)
- [ADR-004：V2 运算符优先级](./docs/decisions/0004-v2-operator-precedence.md)
- [ADR-005：变量标记策略](./docs/decisions/0005-variable-marker-strategy.md)
- [ADR-006：FVTT 兼容范围](./docs/decisions/0006-fvtt-compatibility-scope.md)
- [ADR-007：`sp` 元组裁切索引规则](./docs/decisions/0007-tuple-slice-indexing.md)
- [ADR-008：`lp` 循环边界和预算](./docs/decisions/0008-loop-operator-bounds.md)
- [ADR-009：FVTT `cs` 成功计数子集](./docs/decisions/0009-fvtt-success-counting.md)
