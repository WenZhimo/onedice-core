import type { RollFeatureFlags, RollTrace, SyntaxMode } from '@onedice/core'

export interface ExplanationOptions {
  syntax: SyntaxMode
  features: RollFeatureFlags
}

export interface DiceDisplayDie {
  label: string
  value: number | string
  sides?: number
  selected?: boolean
  dropped?: boolean
  source?: string
  randomCall?: number
  round?: number
}

export interface DiceDisplayGroup {
  title: string
  expression: string
  dice: DiceDisplayDie[]
}

const featureLabels: Partial<Record<keyof RollFeatureFlags, string>> = {
  tupleLiterals: '元组字面量',
  tupleOperators: '元组选择/丢弃',
  clampOperators: '上下限裁剪',
  tupleProjection: '元组投影',
  tupleSlice: '元组裁切',
  conditionals: '条件表达式',
  loopOperator: '循环运算符',
  fateAlias: 'FATE df 别名',
  fvttSuccessCounting: 'FVTT 成功计数',
}

const operatorLabels: Record<string, string> = {
  '+': '加法',
  '-': '减法',
  '*': '乘法',
  '/': '除法',
  '%': '取余',
  '>': '大于比较',
  '<': '小于比较',
  '=': '等于比较',
  '&': '逻辑与',
  '|': '逻辑或',
}

const operatorActionLabels: Record<string, string> = {
  '+': '相加',
  '-': '相减',
  '*': '相乘',
  '/': '相除',
  '%': '取余',
}

export function describeRollTrace(trace: RollTrace, options: ExplanationOptions): string[] {
  return [
    `这次输入会按${options.syntax === 'fvtt-compatible' ? ' FVTT 兼容' : ' OneDice 默认'}规则来理解。`,
    describeEnabledFeatures(options.features),
    ...describeTrace(trace),
    `所以最终显示的结果值是 ${formatNumber(trace.value)}。`,
  ]
}

export function collectDiceGroups(trace: RollTrace): DiceDisplayGroup[] {
  const groups: DiceDisplayGroup[] = []
  walkTrace(trace, (node) => {
    if (node.kind === 'dice') {
      if (node.rolls.length > 0) {
        groups.push({
          title: `${node.diceCount} 个 d${node.faceCount}`,
          expression: node.expression,
          dice: node.rolls.map(roll => ({
            label: `#${roll.index + 1}`,
            value: roll.value,
            sides: node.faceCount,
            selected: roll.selected,
            dropped: roll.dropped,
            source: sourceLabel(roll.source),
            randomCall: roll.randomCall,
          })),
        })
      }
      return
    }

    if (node.kind === 'fate') {
      groups.push({
        title: `${node.diceCount} 个 FATE 骰`,
        expression: node.expression,
        dice: node.rolls.map(roll => ({
          label: `#${roll.index + 1}`,
          value: formatFateValue(roll.value),
          sides: node.faceCount,
          selected: true,
          source: 'FATE',
          randomCall: roll.randomCall,
        })),
      })
      return
    }

    if (node.kind === 'percentile') {
      groups.push({
        title: `${node.mode === 'bonus' ? '奖励骰' : '惩罚骰'}百分骰`,
        expression: node.expression,
        dice: [
          {
            label: '个位',
            value: node.ones,
            sides: 10,
            selected: true,
            source: '个位',
            randomCall: node.onesRandomCall,
          },
          ...node.candidates.map((candidate, index) => ({
            label: index === 0 ? '基础十位' : `额外十位 #${index}`,
            value: candidate.tens,
            sides: 10,
            selected: candidate.selected,
            dropped: !candidate.selected,
            source: sourceLabel(candidate.source),
            randomCall: candidate.randomCall,
          })),
        ],
      })
      return
    }

    if (node.kind === 'pool') {
      const sides = poolFaceCount(node.expression)
      groups.push({
        title: `${node.operator === 'a' ? '无限加骰池' : '双重十字骰池'}`,
        expression: node.expression,
        dice: node.rounds.flatMap(round => round.rolls.map(roll => ({
          label: `轮 ${round.index + 1} / #${roll.index + 1}`,
          value: roll.value,
          sides,
          selected: roll.selected,
          dropped: !roll.selected,
          source: `${sourceLabel(roll.source)}${roll.rerolled ? '，触发加骰' : ''}`,
          randomCall: roll.randomCall,
          round: round.index + 1,
        }))),
      })
    }
  })

  return groups
}

function describeEnabledFeatures(features: RollFeatureFlags): string {
  const enabled = Object.entries(featureLabels)
    .filter(([name]) => Boolean(features[name as keyof RollFeatureFlags]))
    .map(([, label]) => label)

  return enabled.length > 0
    ? `这次额外开启了：${enabled.join('、')}。`
    : '这次没有开启额外功能开关，只使用基础语法。'
}

function describeTrace(trace: RollTrace): string[] {
  switch (trace.kind) {
    case 'number':
      return [`数字常量 ${formatNumber(trace.value)}。`]
    case 'dice':
      return describeDice(trace)
    case 'fate':
      return [describeFate(trace)]
    case 'percentile':
      return [describePercentile(trace)]
    case 'pool':
      return [describePool(trace)]
    case 'binary':
      return [
        ...describeChildren(trace.children),
        `然后把左侧的 ${formatNumber(trace.left)} 和右侧的 ${formatNumber(trace.right)} 做${operatorActionLabels[trace.operator] ?? (operatorLabels[trace.operator] ?? trace.operator)}，这一段得到 ${formatNumber(trace.value)}。`,
      ]
    case 'unary':
      return [
        ...describeChildren(trace.children),
        `前面的 ${trace.operator} 号会作用在 ${formatNumber(trace.operand)} 上，这一段得到 ${formatNumber(trace.value)}。`,
      ]
    case 'group':
      return [...describeChildren(trace.children), `括号表示“先算里面”，所以这一组得到 ${formatNumber(trace.value)}。`]
    case 'tuple':
      return [
        `方括号里的内容是一个列表，里面有 ${trace.items.length} 项。`,
        ...describeChildren(trace.items),
        `这个列表没有额外说明时会取最后一项，所以这一段得到 ${formatNumber(trace.value)}。`,
      ]
    case 'tuple-selection':
      return [
        ...describeChildren(trace.children),
        `再从 ${trace.inputLength} 项里按 ${trace.operator} 规则选 ${trace.count} 项；被选中的位置是 ${trace.selectedIndexes.join(', ') || '无'}，这一段得到 ${formatNumber(trace.value)}。`,
      ]
    case 'tuple-projection':
      return [...describeChildren(trace.children), `再把 ${trace.itemCount} 项转换成${projectionLabel(trace.projection)}，这一段得到 ${formatNumber(trace.value)}。`]
    case 'tuple-slice':
      return [...describeChildren(trace.children), `再从 ${trace.inputLength} 项里取出位置 ${trace.resultIndexes.join(', ') || '无'}，这一段得到 ${formatNumber(trace.value)}。`]
    case 'success-count':
      return [
        ...describeChildren(trace.children),
        `最后按“${trace.comparator}${formatNumber(trace.target)} 才算成功”来数：成功 ${trace.successIndexes.length} 项，失败 ${trace.failureIndexes.length} 项，所以这一段得到 ${formatNumber(trace.value)}。`,
      ]
    case 'clamp':
      return [...describeChildren(trace.children), `${trace.operator} 会把结果限制在 ${formatNumber(trace.limit)} 这个边界内，所以这一段得到 ${formatNumber(trace.value)}。`]
    case 'comparison':
      return [
        ...describeChildren(trace.children),
        `再比较 ${formatNumber(trace.left)} 是否${operatorLabels[trace.operator] ?? trace.operator} ${formatNumber(trace.right)}；成立记为 1，不成立记为 0，这一段得到 ${formatNumber(trace.value)}。`,
      ]
    case 'boolean':
      return [
        ...describeChildren(trace.children),
        `再做${operatorLabels[trace.operator] ?? trace.operator}判断：左侧${trace.leftTruthy ? '为真' : '为假'}，右侧${trace.rightTruthy ? '为真' : '为假'}，这一段得到 ${formatNumber(trace.value)}。`,
      ]
    case 'conditional':
      return [
        ...describeChildren([trace.conditionTrace, trace.selectedTrace]),
        `条件部分得到 ${formatNumber(trace.conditionValue)}，所以选择${trace.selectedBranch === 'consequent' ? '为真分支' : '为假分支'}，这一段得到 ${formatNumber(trace.value)}。`,
      ]
    case 'loop':
      return [`循环执行 ${trace.itemCount} 次，范围为 ${trace.bounds.start} 到 ${trace.bounds.end}，步进 ${trace.bounds.step}，结果为 ${formatNumber(trace.value)}。`]
    case 'interpolation':
      return [`变量 {${trace.key}} 展开为 ${trace.input}，结果为 ${formatNumber(trace.value)}。`, ...describeChildren(trace.children)]
    case 'variable':
      return [`变量 ${trace.name} 的值为 ${formatNumber(trace.value)}。`]
    case 'generic':
      return [`表达式 ${trace.expression} 计算为 ${formatNumber(trace.value)}。`]
    default:
      return [`表达式计算为 ${formatNumber(trace.value)}。`]
  }
}

function describeChildren(children: RollTrace[]): string[] {
  return children.flatMap(child => describeTrace(child))
}

function describeDice(trace: Extract<RollTrace, { kind: 'dice' }>): string[] {
  const modifiers = trace.modifiers.map((modifier) => {
    if (modifier.kind === 'selection') {
      return `${modifier.operator === 'k' ? '保留最大' : '保留最小'} ${modifier.count} 个`
    }
    if (modifier.kind === 'bonusPenalty') {
      return `使用 ${modifier.operator === 'b' ? '奖励' : '惩罚'}骰 ${modifier.count} 个`
    }
    return `统计不低于 ${modifier.threshold} 的成功数`
  })
  const rollText = trace.rolls.map(roll => `${roll.value}${roll.dropped ? '（丢弃）' : '（计入）'}`).join('，')
  const childLines = describeChildren(trace.children ?? [])

  if (trace.rolls.length === 0 && childLines.length > 0) {
    const modifierSummary = modifiers.length > 0 ? `（${modifiers.join('，')}）` : ''
    return [
      ...childLines,
      `外层 ${trace.expression} 汇总 ${trace.diceCount} 次 d${trace.faceCount}${modifierSummary}，本段结果为 ${formatNumber(trace.value)}。`,
    ]
  }

  return [`投掷 ${trace.diceCount} 个 d${trace.faceCount}：${rollText || '无投掷'}；${modifiers.length > 0 ? `${modifiers.join('，')}；` : ''}本段结果为 ${formatNumber(trace.value)}。`]
}

function describeFate(trace: Extract<RollTrace, { kind: 'fate' }>): string {
  const rolls = trace.rolls.map(roll => formatFateValue(roll.value)).join('，')
  return `投掷 ${trace.diceCount} 个 FATE 骰：${rolls}；本段结果为 ${formatNumber(trace.value)}。`
}

function describePercentile(trace: Extract<RollTrace, { kind: 'percentile' }>): string {
  const candidates = trace.candidates.map(candidate => `${candidate.value}${candidate.selected ? '（采用）' : ''}`).join('，')
  return `执行 COC ${trace.mode === 'bonus' ? '奖励' : '惩罚'}骰：个位 ${trace.ones}，十位候选 ${candidates}，本段结果为 ${formatNumber(trace.value)}。`
}

function describePool(trace: Extract<RollTrace, { kind: 'pool' }>): string {
  const rollCount = trace.rounds.reduce((sum, round) => sum + round.rolls.length, 0)
  return `执行${trace.operator === 'a' ? '无限加' : '双重十字'}骰池：共 ${trace.rounds.length} 轮、${rollCount} 次投掷，本段结果为 ${formatNumber(trace.value)}。`
}

function walkTrace(trace: RollTrace, visit: (trace: RollTrace) => void) {
  visit(trace)

  switch (trace.kind) {
    case 'binary':
    case 'unary':
    case 'comparison':
    case 'boolean':
    case 'clamp':
    case 'group':
    case 'tuple-projection':
    case 'tuple-selection':
    case 'tuple-slice':
    case 'interpolation':
    case 'success-count':
      trace.children.forEach(child => walkTrace(child, visit))
      break
    case 'dice':
      trace.children?.forEach(child => walkTrace(child, visit))
      break
    case 'tuple':
      trace.items.forEach(child => walkTrace(child, visit))
      break
    case 'conditional':
      walkTrace(trace.conditionTrace, visit)
      walkTrace(trace.selectedTrace, visit)
      break
    case 'loop':
      walkTrace(trace.boundsTrace, visit)
      trace.iterations.forEach(iteration => walkTrace(iteration.body, visit))
      break
    default:
      break
  }
}

function projectionLabel(projection: string): string {
  if (projection === 'sum') return '求和'
  if (projection === 'last') return '最后一项'
  return '原始元组'
}

function poolFaceCount(expression: string): number | undefined {
  const match = expression.match(/m(\d+)\b/)
  return match ? Number(match[1]) : undefined
}

function sourceLabel(source: string): string {
  if (source === 'base') return '基础骰'
  if (source === 'bonus') return '奖励骰'
  if (source === 'penalty') return '惩罚骰'
  if (source === 'exploded') return '加骰'
  if (source === 'rerolled') return '重掷'
  return source
}

function formatFateValue(value: number): string {
  if (value > 0) return '+'
  if (value < 0) return '-'
  return '0'
}

function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : 'NaN'
}
