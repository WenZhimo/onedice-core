import {
  OneDiceError,
  roll,
  type RollFeatureFlags,
  type SyntaxMode,
} from '@onedice/core'
import { renderDiceResult } from './dice-result'
import { collectDiceGroups, describeRollTrace } from './explain'

const examples = document.querySelectorAll<HTMLElement>('[data-dice-example]')
const states = new WeakMap<HTMLElement, ExampleState>()

interface ExampleState {
  defaultExpression: string
  expression: string
  features: RollFeatureFlags
  randomValues?: string
  syntax: SyntaxMode
}

for (const example of examples) {
  initializeExample(example)
}

function initializeExample(container: HTMLElement) {
  const defaultExpression = container.dataset.expression
  if (!defaultExpression) {
    container.textContent = '这个示例缺少表达式。'
    return
  }

  states.set(container, {
    defaultExpression,
    expression: defaultExpression,
    features: parseFeatures(container.dataset.features),
    randomValues: container.dataset.random,
    syntax: parseSyntax(container.dataset.syntax),
  })
  renderExample(container, true)
}

function renderExample(container: HTMLElement, useInitialRandom: boolean) {
  const state = states.get(container)
  if (!state) return

  const controls = createExampleControls(container, state)
  const output = document.createElement('div')
  output.className = 'example-live-output'
  const expression = state.expression.trim()

  if (!expression) {
    renderExampleError(output, '请输入一个表达式。')
    container.replaceChildren(controls, output)
    return
  }

  try {
    const shouldUseInitialRandom = useInitialRandom
      && expression === state.defaultExpression
      && Boolean(state.randomValues)
    const result = roll(expression, {
      syntax: state.syntax,
      features: state.features,
      ...(shouldUseInitialRandom && state.randomValues ? { random: createSequenceRandom(state.randomValues) } : {}),
    })
    const diceRoot = document.createElement('div')
    diceRoot.className = 'dice-output compact'
    renderDiceResult(diceRoot, collectDiceGroups(result.trace), {
      emptyText: '这个示例没有实际投骰；它展示的是列表、数字或错误处理概念。',
      resultLabel: shouldUseInitialRandom ? '默认示例结果' : '当前结果',
      showValue: true,
      value: result.value,
    })

    const explanation = document.createElement('ul')
    explanation.className = 'example-explanation'
    for (const line of describeRollTrace(result.trace, { syntax: state.syntax, features: state.features }).slice(0, 5)) {
      const item = document.createElement('li')
      item.textContent = line
      explanation.append(item)
    }

    output.replaceChildren(diceRoot, explanation)
  } catch (error) {
    const message = error instanceof OneDiceError
      ? `${error.code}：${error.message}`
      : error instanceof Error
      ? error.message
      : String(error)
    renderExampleError(output, `这个表达式会返回结构化错误：${message}`)
  }

  container.replaceChildren(controls, output)
}

function createExampleControls(container: HTMLElement, state: ExampleState) {
  const form = document.createElement('form')
  form.className = 'example-controls'

  const label = document.createElement('label')
  label.className = 'example-expression-label'

  const labelText = document.createElement('span')
  labelText.textContent = '表达式'

  const input = document.createElement('input')
  input.dataset.exampleExpression = ''
  input.type = 'text'
  input.value = state.expression
  input.autocomplete = 'off'
  input.spellcheck = false
  input.setAttribute('aria-label', '示例表达式')

  label.append(labelText, input)

  const runButton = document.createElement('button')
  runButton.type = 'submit'
  runButton.textContent = '运行'

  const resetButton = document.createElement('button')
  resetButton.className = 'secondary-button'
  resetButton.dataset.exampleReset = ''
  resetButton.type = 'button'
  resetButton.textContent = '重置'

  form.addEventListener('submit', (event) => {
    event.preventDefault()
    state.expression = input.value
    renderExample(container, false)
  })

  resetButton.addEventListener('click', () => {
    state.expression = state.defaultExpression
    renderExample(container, true)
  })

  const actions = document.createElement('div')
  actions.className = 'example-control-actions'
  actions.append(runButton, resetButton)
  form.append(label, actions)

  return form
}

function renderExampleError(container: HTMLElement, message: string) {
  const errorBlock = document.createElement('p')
  errorBlock.className = 'example-error'
  errorBlock.textContent = message
  container.replaceChildren(errorBlock)
}

function parseSyntax(value: string | undefined): SyntaxMode {
  return value === 'fvtt-compatible' ? 'fvtt-compatible' : 'onedice'
}

function parseFeatures(value: string | undefined): RollFeatureFlags {
  if (!value) return {}

  return Object.fromEntries(
    value
      .split(',')
      .map(feature => feature.trim())
      .filter(Boolean)
      .map(feature => [feature, true]),
  ) as RollFeatureFlags
}

function createSequenceRandom(source: string) {
  const values = source
    .split(/[,\s]+/)
    .map(value => value.trim())
    .filter(Boolean)
    .map(Number)
  let index = 0

  return (min: number, max: number) => {
    const value = values[index]
    index += 1

    if (value === undefined || value < min || value > max || !Number.isInteger(value)) {
      throw new Error(`固定随机序列第 ${index} 项必须是 ${min} 到 ${max} 之间的整数。`)
    }

    return value
  }
}
