import {
  OneDiceError,
  roll,
  type OneDiceErrorMeta,
  type RollFeatureFlags,
  type SyntaxMode,
} from '@onedice/core'
import {
  collectDiceGroups,
  describeRollTrace,
} from './explain'
import { renderDiceResult } from './dice-result'
import './styles.css'

type FeatureFlagName = keyof Omit<RollFeatureFlags, 'program' | 'variableAliases'>

const featureFlagNames: FeatureFlagName[] = [
  'tupleLiterals',
  'tupleOperators',
  'clampOperators',
  'tupleProjection',
  'tupleSlice',
  'conditionals',
  'loopOperator',
  'fateAlias',
  'fvttSuccessCounting',
]

const expressionInput = mustElement<HTMLInputElement>('expression-input')
const rollButton = mustElement<HTMLButtonElement>('roll-button')
const syntaxSelect = mustElement<HTMLSelectElement>('syntax-select')
const deterministicRandom = mustElement<HTMLInputElement>('deterministic-random')
const randomSequence = mustElement<HTMLInputElement>('random-sequence')
const rangePreview = mustElement<HTMLDivElement>('range-preview')
const valueOutput = mustElement<HTMLOutputElement>('value-output')
const explanationOutput = mustElement<HTMLUListElement>('explanation-output')
const diceOutput = mustElement<HTMLDivElement>('dice-output')
const rawOutput = mustElement<HTMLPreElement>('raw-output')
const traceOutput = mustElement<HTMLPreElement>('trace-output')
const diagnosticsOutput = mustElement<HTMLPreElement>('diagnostics-output')
const errorCard = mustElement<HTMLDivElement>('error-card')
const errorCode = mustElement<HTMLElement>('error-code')
const errorMessage = mustElement<HTMLParagraphElement>('error-message')
const errorMeta = mustElement<HTMLPreElement>('error-meta')

rollButton.addEventListener('click', runRoll)
expressionInput.addEventListener('input', runRoll)
expressionInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') runRoll()
})
syntaxSelect.addEventListener('change', runRoll)
deterministicRandom.addEventListener('change', runRoll)
randomSequence.addEventListener('change', runRoll)
for (const checkbox of featureCheckboxes()) {
  checkbox.addEventListener('change', runRoll)
}

applyInitialParams()
runRoll()

function applyInitialParams() {
  const params = new URLSearchParams(window.location.search)
  const expression = params.get('expr')
  const syntax = params.get('syntax')
  const random = params.get('random')
  const features = params.get('features')

  if (expression) expressionInput.value = expression
  if (syntax === 'onedice' || syntax === 'fvtt-compatible') {
    syntaxSelect.value = syntax
  }
  if (random) {
    deterministicRandom.checked = true
    randomSequence.value = random
  }
  if (features) {
    const enabledFeatures = new Set(features.split(',').map(feature => feature.trim()).filter(Boolean))
    for (const name of featureFlagNames) {
      featureInput(name).checked = enabledFeatures.has(name)
    }
  }
}

function runRoll() {
  const input = expressionInput.value
  clearError()
  clearRange()

  try {
    const syntax = syntaxSelect.value as SyntaxMode
    const features = selectedFeatures()
    const result = roll(input, {
      syntax,
      features,
      ...(deterministicRandom.checked ? { random: createSequenceRandom(randomSequence.value) } : {}),
    })

    valueOutput.textContent = String(result.value)
    renderExplanation(describeRollTrace(result.trace, { syntax, features }))
    renderDiceResult(diceOutput, collectDiceGroups(result.trace), {
      onReroll: runRoll,
      rerollLabel: '重投',
      showValue: false,
    })
    rawOutput.textContent = formatJson(result.raw)
    traceOutput.textContent = formatJson(result.trace)
    diagnosticsOutput.textContent = formatJson(result.diagnostics)
  } catch (error) {
    valueOutput.textContent = '-'
    renderExplanation(['表达式尚未成功解析；请查看下方结构化错误。'])
    renderDiceResult(diceOutput, [])
    rawOutput.textContent = '{}'
    traceOutput.textContent = '{}'
    diagnosticsOutput.textContent = '[]'

    if (error instanceof OneDiceError) {
      showError(error.code, error.message, error.meta)
      showRange(input, error.meta.range)
      return
    }

    const fallback = error instanceof Error
      ? { message: error.message, name: error.name }
      : { message: String(error) }
    showError('UNKNOWN_ERROR', fallback.message, fallback)
  }
}

function selectedFeatures(): RollFeatureFlags {
  return Object.fromEntries(
    featureFlagNames.map(name => [name, featureInput(name).checked]),
  ) as RollFeatureFlags
}

function createSequenceRandom(source: string) {
  const values = source
    .split(/[,\s]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .map(Number)
  let index = 0

  if (values.length === 0 || values.some(value => !Number.isFinite(value))) {
    throw new OneDiceError('VARIABLE_INVALID_VALUE', '随机序列必须包含有限数字。', {
      actual: source,
      hint: '请使用逗号或空格分隔数字，例如：11, 7, 5。',
    })
  }

  return (min: number, max: number) => {
    const value = values[index]
    index += 1

    if (value === undefined) {
      throw new OneDiceError('EVALUATION_BUDGET_EXCEEDED', '固定随机序列已用尽。', {
        budgetKind: 'deterministicRandomValues',
        actual: index,
        limit: values.length,
        hint: `请再添加一个 ${min} 到 ${max} 之间的值。`,
      })
    }

    if (value < min || value > max || !Number.isInteger(value)) {
      throw new OneDiceError('VARIABLE_INVALID_VALUE', '固定随机值超出本次请求范围。', {
        actual: value,
        limit: max,
        start: min,
        hint: `第 ${index} 个值必须是 ${min} 到 ${max} 之间的整数。`,
      })
    }

    return value
  }
}

function showError(code: string, message: string, meta: unknown) {
  errorCard.classList.remove('hidden')
  errorCode.textContent = code
  errorMessage.textContent = message
  errorMeta.textContent = formatJson(meta)
}

function renderExplanation(lines: string[]) {
  explanationOutput.innerHTML = lines
    .map(line => `<li>${escapeHtml(line)}</li>`)
    .join('')
}

function clearError() {
  errorCard.classList.add('hidden')
  errorCode.textContent = '-'
  errorMessage.textContent = ''
  errorMeta.textContent = '{}'
}

function showRange(input: string, range: OneDiceErrorMeta['range']) {
  if (!range) {
    rangePreview.textContent = '范围：-'
    return
  }

  const before = input.slice(0, range.start)
  const target = input.slice(range.start, range.end) || '∅'
  const after = input.slice(range.end)
  rangePreview.innerHTML = [
    '<span class="range-label">范围 ',
    String(range.start),
    '..',
    String(range.end),
    '</span><code>',
    escapeHtml(before),
    '<mark>',
    escapeHtml(target),
    '</mark>',
    escapeHtml(after),
    '</code>',
  ].join('')
}

function clearRange() {
  rangePreview.textContent = '范围：-'
}

function featureCheckboxes(): HTMLInputElement[] {
  return featureFlagNames.map(featureInput)
}

function featureInput(name: FeatureFlagName): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(`[data-feature="${name}"]`)
  if (!input) throw new Error(`缺少功能开关输入：${name}`)
  return input
}

function mustElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`缺少页面元素：#${id}`)
  return element as T
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}
