import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

function readDoc(path: string): string {
  return readFileSync(resolve(__dirname, '..', '..', path), 'utf8')
}

describe('documentation cross-links', () => {
  it('keeps the improvement plan and upstream issue record mutually linked', () => {
    const plan = readDoc('docs/improvement-plan.md')
    const issues = readDoc('docs/upstream-onedice-issues.md')

    expect(plan).toContain('[upstream-onedice-issues.md](./upstream-onedice-issues.md)')
    expect(issues).toContain('[improvement-plan.md](./improvement-plan.md)')
  })

  it('keeps upstream issue status and execution posture aligned with the plan', () => {
    const plan = readDoc('docs/improvement-plan.md')
    const issues = readDoc('docs/upstream-onedice-issues.md')

    for (const issue of ['#3', '#11']) {
      expect(issues).toMatch(new RegExp(`### ${issue}[:：][\\s\\S]*?状态[:：]open`))
      expect(plan).toMatch(new RegExp(`\\| ${issue} [^|]+ \\| Open \\|[^\\n]+不得`))
    }

    for (const issue of ['#5', '#9', '#10']) {
      expect(issues).toMatch(new RegExp(`### ${issue}[:：][\\s\\S]*?状态[:：]closed`))
      expect(plan).toMatch(new RegExp(`\\| ${issue} [^|]+ \\| Closed \\|[^\\n]+(?:必须|不得|只作为)`))
    }

    expect(plan).toContain('开放 issue 只能作为设计输入')
    expect(plan).toContain('关闭 issue 必须成为测试规则')
    expect(plan).toContain('暂缓能力必须写明当前拒绝策略')
    expect(issues).toContain('开放议题继续作为设计输入')
    expect(issues).toContain('关闭议题继续作为必须固化的行为规则')
  })

  it('keeps ADR-001 aligned with the browser package output contract', () => {
    const adr = readDoc('docs/decisions/0001-browser-package-output.md')

    expect(adr).toContain('"sideEffects": false')
    expect(adr).toContain('Node-only')
    expect(adr).toContain('process.')
    expect(adr).toContain('Buffer')
    expect(adr).toContain('test/browser/vite-import.test.ts')
    expect(adr).toContain('test/browser/package-contents.test.ts')
    expect(adr).toContain('package.json.main/module/types/exports')
    expect(adr).toContain('dist/index.cjs')
    expect(adr).toContain('dist/index.mjs')
    expect(adr).toContain('dist/index.d.ts')
    expect(adr).toContain('CommonJS `require()`')
    for (const publicExport of [
      'rollProgram()',
      'Config',
      'RollFeatureFlags',
      'SyntaxMode',
      'RollResult',
      'RollValue',
      'RollTrace',
      'RollDiagnostic',
      'ProgramResult',
    ]) {
      expect(adr).toContain(publicExport)
    }
  })

  it('keeps ADR-002 aligned with implemented error and diagnostic contracts', () => {
    const adr = readDoc('docs/decisions/0002-error-diagnostics.md')

    for (const staleStatus of [
      '后续应当进入 `RollResult.diagnostics`',
      '当前阶段默认为空数组',
    ]) {
      expect(adr).not.toContain(staleStatus)
    }

    for (const contract of [
      'RollResult.diagnostics',
      'SYNTAX_NORMALIZED',
      'VARIABLE_*',
      'VARIABLE_RESOLVER_FAILED',
      'FEATURE_FLAG_REQUIRED',
      'COMPATIBILITY_PROJECTION',
      'BUDGET_NEAR_LIMIT',
      'OneDiceError.code',
      'error.meta',
      'src/trace.ts',
      'README',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('keeps ADR-003 aligned with implemented RollValue projection contracts', () => {
    const adr = readDoc('docs/decisions/0003-roll-value-model.md')

    for (const staleStatus of [
      '未来程序/显式元组兼容旧 API',
      'future trace',
      '浏览器 UI 和未来 V2 运算',
    ]) {
      expect(adr).not.toContain(staleStatus)
    }

    for (const contract of [
      'projectToNumber()',
      'TUPLE_EMPTY_PROJECTION',
      'TUPLE_CANNOT_PROJECT',
      'test/v1/roll-value.test.ts',
      'test/v1/tuple-literal.test.ts',
      'test/v1/tuple-operators.test.ts',
      'test/v1/json-serialization.test.ts',
      'rollProgram()',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('keeps ADR-004 aligned with implemented V2 operator precedence contracts', () => {
    const adr = readDoc('docs/decisions/0004-v2-operator-precedence.md')

    for (const staleStatus of [
      '实现任何 V2 运算符前必须先补测试',
      '未设计完成的 `lp/sp` 语法',
      '必须最后实现',
      '进入实现后必须读取',
    ]) {
      expect(adr).not.toContain(staleStatus)
    }

    for (const contract of [
      '持续验收必须覆盖',
      'feature flag',
      'PARSE_UNSUPPORTED_SYNTAX',
      'meta.feature',
      'test/v1/tuple-operators.test.ts',
      'test/v1/clamp-operators.test.ts',
      'test/v1/tuple-projection.test.ts',
      'test/v1/tuple-slice.test.ts',
      'test/v1/conditionals.test.ts',
      'test/v1/loop-operator.test.ts',
      'test/v1/parser-errors.test.ts',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('keeps ADR-005 aligned with implemented variable and resolver contracts', () => {
    const adr = readDoc('docs/decisions/0005-variable-marker-strategy.md')

    for (const staleStatus of [
      '| `$0`、`$1` | `rollProgram()` | 待实现',
      '| `$tName` | `rollProgram()` | 待实现',
      '| `i` | `lp` 循环体 | 待实现',
      '| `@path.to.data` | `syntax: \'fvtt-compatible\'` | 待实现',
    ]) {
      expect(adr).not.toContain(staleStatus)
    }

    for (const contract of [
      '已实现',
      '已实现受控子集',
      'ProgramVariableSnapshot',
      'assignedAtStatement',
      'VARIABLE_READONLY',
      'VARIABLE_RESOLVER_FAILED',
      'test/v1/program.test.ts',
      'test/v1/loop-operator.test.ts',
      'test/v1/evaluation-context.test.ts',
      'test/v1/fvtt-compatibility.test.ts',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('keeps ADR-006 aligned with implemented FVTT compatibility scope', () => {
    const adr = readDoc('docs/decisions/0006-fvtt-compatibility-scope.md')

    for (const staleStatus of [
      '| `{a,b,c}` 骰池/tuple 输入 | 应当实现',
      '| `@path.to.data` | 应当实现',
      '| `kh/kl/dh/dl` | 应当实现',
      '| `min/max` | 应当实现',
      '| `df` | 可实现',
      '实现 FVTT 兼容前必须补测试',
    ]) {
      expect(adr).not.toContain(staleStatus)
    }

    for (const contract of [
      '已实现受控子集',
      'features.tupleOperators',
      'features.clampOperators',
      'features.fateAlias',
      'features.fvttSuccessCounting',
      'fvttNonDicePool',
      'fvttRuntimeBinding',
      'Compendium',
      'test/v1/fvtt-compatibility.test.ts',
      'test/v1/clamp-operators.test.ts',
      'test/v1/fate-alias.test.ts',
      'test/browser/vite-import.test.ts',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('keeps ADR-007 aligned with implemented tuple slice indexing contracts', () => {
    const adr = readDoc('docs/decisions/0007-tuple-slice-indexing.md')

    for (const staleStatus of [
      '实现 `sp` 前必须新增',
    ]) {
      expect(adr).not.toContain(staleStatus)
    }

    for (const contract of [
      'features.tupleSlice',
      "trace.kind='tuple-slice'",
      'TUPLE_INVALID_SLICE_INDEX',
      'TUPLE_INVALID_SLICE_STEP',
      'TUPLE_INVALID_SLICE_ARITY',
      'TUPLE_SLICE_OUT_OF_RANGE',
      'TUPLE_INVALID_SLICE_RANGE',
      'test/v1/tuple-slice.test.ts',
      'test/v1/json-serialization.test.ts',
      'README.md',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('keeps ADR-008 aligned with implemented loop readonly and budget contracts', () => {
    const adr = readDoc('docs/decisions/0008-loop-operator-bounds.md')

    for (const staleStatus of [
      '实现 `lp` 前必须新增',
      '当前阶段不得支持在循环体内给 `i` 赋值；如果未来引入 `$ie(...)` 或 shadowing',
    ]) {
      expect(adr).not.toContain(staleStatus)
    }

    for (const contract of [
      'EvaluationContext.variables',
      'VARIABLE_READONLY',
      "variable='i'",
      'test/v1/loop-operator.test.ts',
      'test/v1/evaluation-context.test.ts',
      'test/v1/json-serialization.test.ts',
      'budgetKind',
      'loopIterations',
      'loopDepth',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('keeps ADR-009 aligned with implemented FVTT success-counting contracts', () => {
    const adr = readDoc('docs/decisions/0009-fvtt-success-counting.md')

    for (const contract of [
      'features.fvttSuccessCounting',
      "syntax: 'fvtt-compatible'",
      '不采用。`cs` 是 FVTT 兼容语法',
      '当前只实现带目标值的 success counting',
      'SuccessCountNode',
      "trace.kind` 为 `success-count",
      'successIndexes',
      'failureIndexes',
      '1d20cs',
      '[1,6,2]cs>3',
      'test/v1/fvtt-compatibility.test.ts',
      'test/v1/json-serialization.test.ts',
      'test/browser/vite-import.test.ts',
      '浏览器 smoke',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('keeps every ADR discoverable from README and the improvement plan', () => {
    const adrDir = resolve(__dirname, '..', '..', 'docs', 'decisions')
    const adrFiles = readdirSync(adrDir)
      .filter(file => /^\d{4}-.+\.md$/.test(file))
      .sort()
    const readme = readDoc('README.md')
    const plan = readDoc('docs/improvement-plan.md')

    expect(adrFiles.length).toBeGreaterThan(0)

    for (const file of adrFiles) {
      const adrNumber = Number(file.slice(0, 4))
      const adrLabel = `ADR-${String(adrNumber).padStart(3, '0')}`
      const adr = readDoc(`docs/decisions/${file}`)

      expect(adr).toContain(`# ${adrLabel}:`)
      expect(readme).toContain(`./docs/decisions/${file}`)
      expect(plan).toContain(`docs/decisions/${file}`)
    }
  })
})


