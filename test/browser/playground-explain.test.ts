import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { OneDiceError, roll, type RollFeatureFlags, type SyntaxMode } from '../../src'
import { diceResultToHtml } from '../../examples/playground/src/dice-result'
import { collectDiceGroups, describeRollTrace } from '../../examples/playground/src/explain'
import { sequenceRandom } from '../helpers/random'

describe('browser playground expression explanation', () => {
  it('turns a compound dice expression into Chinese explanation lines', () => {
    const result = roll('2d6+1d20', {
      random: sequenceRandom([3, 5, 17]),
    })

    const explanation = describeRollTrace(result.trace, {
      syntax: 'onedice',
      features: {},
    }).join('\n')

    expect(explanation).toContain('按 OneDice 默认规则来理解')
    expect(explanation).toContain('投掷 2 个 d6')
    expect(explanation).toContain('投掷 1 个 d20')
    expect(explanation).toContain('所以最终显示的结果值是 25。')
  })

  it('collects every rolled die separately for visual rendering', () => {
    const result = roll('2d6+1d20', {
      random: sequenceRandom([3, 5, 17]),
    })

    const groups = collectDiceGroups(result.trace)

    expect(groups).toHaveLength(2)
    expect(groups.map(group => group.title)).toEqual(['2 个 d6', '1 个 d20'])
    expect(groups.flatMap(group => group.dice.map(die => die.value))).toEqual([3, 5, 17])
    expect(groups.flatMap(group => group.dice.map(die => die.sides))).toEqual([6, 6, 20])
  })

  it('collects percentile children from d100 bonus and penalty dice for visual rendering', () => {
    const bonus = roll('1d100b1', {
      random: sequenceRandom([3, 8, 2]),
    })
    const penalty = roll('2d100p1', {
      random: sequenceRandom([3, 2, 8, 7, 1, 4]),
    })

    const bonusGroups = collectDiceGroups(bonus.trace)
    const penaltyGroups = collectDiceGroups(penalty.trace)
    const explanation = describeRollTrace(bonus.trace, {
      syntax: 'onedice',
      features: {},
    }).join('\n')

    expect(bonusGroups).toHaveLength(1)
    expect(bonusGroups[0].title).toBe('奖励骰百分骰')
    expect(bonusGroups[0].dice.map(die => die.label)).toEqual(['个位', '基础十位', '额外十位 #1'])
    expect(bonusGroups[0].dice.map(die => die.value)).toEqual([3, 8, 2])
    expect(bonusGroups[0].dice.map(die => die.source)).toEqual(['个位', '基础骰', '奖励骰'])
    expect(bonusGroups[0].dice.map(die => die.selected)).toEqual([true, false, true])
    expect(penaltyGroups).toHaveLength(2)
    expect(penaltyGroups.map(group => group.title)).toEqual(['惩罚骰百分骰', '惩罚骰百分骰'])
    expect(penaltyGroups.map(group => group.dice.map(die => die.value))).toEqual([
      [3, 2, 8],
      [7, 1, 4],
    ])
    expect(explanation).toContain('执行 COC 奖励骰：个位 3，十位候选 83，23（采用），本段结果为 23。')
    expect(explanation).toContain('外层 1d100b1 汇总 1 次 d100（使用 奖励骰 1 个），本段结果为 23。')
  })

  it('collects pool children from d success-count modifiers for visual rendering', () => {
    const result = roll('4d6a5', {
      random: sequenceRandom([6, 2, 5, 4]),
    })

    const groups = collectDiceGroups(result.trace)

    expect(groups).toHaveLength(1)
    expect(groups[0].title).toBe('无限加骰池')
    expect(groups[0].dice.map(die => die.value)).toEqual([6, 2, 5, 4])
    expect(groups[0].dice.map(die => die.sides)).toEqual([6, 6, 6, 6])
    expect(groups[0].dice.map(die => die.selected)).toEqual([true, false, true, false])
    expect(groups[0].dice.map(die => die.dropped)).toEqual([false, true, false, true])
  })

  it('explains enabled playground options and FATE alias dice', () => {
    const result = roll('4df', {
      features: { fateAlias: true },
      random: sequenceRandom([0, 1, 2, 0]),
    })

    const explanation = describeRollTrace(result.trace, {
      syntax: 'onedice',
      features: { fateAlias: true },
    }).join('\n')
    const groups = collectDiceGroups(result.trace)

    expect(explanation).toContain('这次额外开启了：FATE df 别名。')
    expect(explanation).toContain('投掷 4 个 FATE 骰')
    expect(groups).toHaveLength(1)
    expect(groups[0].dice.map(die => die.value)).toEqual(['+', '-', '0', '+'])
  })

  it('renders the reusable dice result widget with a reroll button', () => {
    const result = roll('2d6+1d20', {
      random: sequenceRandom([3, 5, 17]),
    })
    const html = diceResultToHtml(collectDiceGroups(result.trace), {
      rerollLabel: '重投一次',
      showReroll: true,
      showValue: true,
      value: result.value,
    })

    expect(html).toContain('class="dice-result-widget"')
    expect(html).toContain('data-dice-reroll')
    expect(html).toContain('重投一次')
    expect(html).toContain('2 个 d6')
    expect(html).toContain('1 个 d20')
  })

  it('keeps the docs page using embedded dice examples instead of playground links', () => {
    const docs = readFileSync(resolve(__dirname, '..', '..', 'examples/playground/docs.html'), 'utf8')

    expect(docs).toContain('data-dice-example')
    expect(docs).toContain('/src/docs.ts')
    expect(docs).not.toContain('在演示页打开')
    expect(docs).not.toContain('href="./?expr=')
  })

  it('documents beginner details for percentile dice, success counting, and feature flags', () => {
    const docs = readDocsPage()

    expect(docs).toContain('把 <code>1d20cs&gt;15</code> 拆开看')
    expect(docs).toContain('掷骰表达式后面的“后缀位置”')
    expect(docs).toContain('<code>cs&gt;15</code>')
    expect(docs).toContain('<code>cs&gt;=15</code>')
    expect(docs).toContain('<code>cs&lt;3</code>')
    expect(docs).toContain('<code>cs&lt;=2</code>')
    expect(docs).toContain('<code>cs=1</code> / <code>cs1</code>')
    expect(docs).toContain('<code>cf</code>（失败计数）')
    expect(docs).toContain('<code>ms</code>（成功差值）')
    expect(docs).toContain('额外十位骰数量')
    expect(docs).toContain('这个数字可以修改')
    expect(docs).toContain('1d100b1')
    expect(docs).toContain('2d100p1')
    expect(docs).toContain('卡片会显示个位、基础十位、额外十位，以及当前奖励骰采用的百分结果。')
    expect(docs).toContain('卡片会分成两组显示，方便看清每一次百分骰各自采用了哪个十位。')
    expect(docs).toContain('卡片会显示每颗骰子的当前点数，并标出哪些骰子计入成功数。')
    expect(docs).toContain('卡片会显示每颗骰子的当前符号，并在上方显示它们换算后的合计。')
    expect(docs).not.toContain('奖励骰取 23')
    expect(docs).not.toContain('惩罚骰取 83')
    expect(docs).not.toContain('得到 130')
    expect(docs).not.toContain('点数是 6、2、5、4')
    expect(docs).not.toContain('投出 18')
    expect(docs).not.toContain('2、5、1、3 中')
    expect(docs).not.toContain('固定序列会显示')
    expect(docs).not.toContain('固定投出')
    expect(docs).not.toContain('固定随机序列 3, 5')
    expect(docs).toContain('data-expression="[1,2,3]dl1"')
    expect(docs).toContain('data-expression="1d20min10"')
    expect(docs).toContain('data-expression="[1,2,3,4]sp[2,3]"')
    expect(docs).toContain('data-expression="2lp[1d4+1]"')
    expect(docs).toContain('data-expression="4d6cs&lt;=2"')
  })

  it('documents and wires editable docs examples with reset support', () => {
    const docs = readDocsPage()
    const docsScript = readDocsScript()

    expect(docs).toContain('每个示例卡片都可以直接改表达式')
    expect(docs).toContain('修改数字、骰子面数或命令后缀后点“运行”会重新计算')
    expect(docs).toContain('点“重置”会恢复该示例的默认表达式和默认首屏结果')
    expect(docs).not.toContain('重投一次')
    expect(docs).toContain('解析文字可能变长或带一些实现细节')
    expect(docsScript).toContain('input.dataset.exampleExpression')
    expect(docsScript).toContain('resetButton.dataset.exampleReset')
    expect(docsScript).toContain("runButton.textContent = '运行'")
    expect(docsScript).toContain("resetButton.textContent = '重置'")
    expect(docsScript).not.toContain('onReroll')
    expect(docsScript).not.toContain('rerollLabel')
    expect(docsScript).not.toContain('readExpressionInput')
    expect(docsScript).toContain('state.expression = state.defaultExpression')
    expect(docsScript).toContain('renderExample(container, true)')
  })

  it('keeps docs examples executable or returning structured OneDice errors', () => {
    const docs = readDocsPage()
    const exampleTags = [...docs.matchAll(/<div class="doc-dice-result"[^>]*data-dice-example[^>]*>/g)]
      .map(match => match[0])

    expect(exampleTags.length).toBeGreaterThan(25)

    const failures: string[] = []
    for (const tag of exampleTags) {
      const attrs = parseDataAttributes(tag)
      const expression = decodeHtmlAttribute(attrs.expression ?? '')
      const syntax = parseSyntax(attrs.syntax)
      const features = parseFeatures(attrs.features)
      const randomValues = attrs.random

      try {
        roll(expression, {
          syntax,
          features,
          ...(randomValues ? { random: createSequenceRandom(randomValues) } : {}),
        })
      } catch (error) {
        if (!(error instanceof OneDiceError)) {
          failures.push(`${expression}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    expect(failures).toEqual([])
  })
})

function readDocsPage() {
  return readFileSync(resolve(__dirname, '..', '..', 'examples/playground/docs.html'), 'utf8')
}

function readDocsScript() {
  return readFileSync(resolve(__dirname, '..', '..', 'examples/playground/src/docs.ts'), 'utf8')
}

function parseDataAttributes(tag: string) {
  return Object.fromEntries(
    [...tag.matchAll(/\sdata-([\w-]+)="([^"]*)"/g)]
      .map(match => [toCamelCase(match[1]), match[2]]),
  ) as Record<string, string>
}

function toCamelCase(value: string) {
  return value.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
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
      throw new Error(`fixed random value ${index} must be an integer from ${min} to ${max}`)
    }

    return value
  }
}
