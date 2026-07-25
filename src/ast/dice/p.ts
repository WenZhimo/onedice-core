import { Config, fill, negative, indent } from '../..'
import { OneDiceError } from '../../errors'
import { getEvaluationContext, withEvaluationRange } from '../../evaluation/context'
import { DiceNode } from '..'

export type PRollEvaluation = [tens: number, selected: boolean, randomCall: number]

export interface PEvaluation {
  expression: string
  d100: number
  one: number
  oneRandomCall: number
  ten: number
  tenRandomCall: number
  realTen: number
  roll: PRollEvaluation[]
  a?: number, b?: number, pb: 'p' | 'b'
  value: number
}

export class PNode implements DiceNode<PEvaluation> {
  range?: DiceNode['range']
  evaluation: PEvaluation
  constructor(
    public a: DiceNode,
    public b: DiceNode,
    public pb: 'p' | 'b'
  ) {}

  eval(config: Config): number {
    const a = this.a?.eval(config) ?? config.p.a
    const b = this.b?.eval(config) ?? config.p.b
    const rangeMeta = this.range ? { range: this.range } : {}
    if (negative(a, b) || b < 0) throw new OneDiceError(
      'PERCENTILE_INVALID_BONUS_PENALTY_COUNT',
      '奖惩骰数量不能为负数',
      {
        operator: this.pb,
        actual: b,
        ...rangeMeta,
        hint: '请使用 p0、p1、b0 或 b1 这样的非负奖惩骰数量。',
      },
    )
    if (b + 2 > config.maxRollCount) throw new OneDiceError(
      'DICE_TOO_MANY_ROLLS',
      '掷出骰子数量超过 maxRollCount',
      {
        operator: this.pb,
        actual: b + 2,
        limit: config.maxRollCount,
        ...rangeMeta,
        hint: `当前上限为 ${config.maxRollCount}，请减少奖惩骰数量或调高 maxRollCount。`,
      },
    )
    this.evaluation = {
      a, b, pb: this.pb,
      expression: this.expression(a, b),
      d100: null,
      one: null,
      oneRandomCall: null,
      ten: null,
      tenRandomCall: null,
      realTen: null,
      roll: null,
      value: null,
    }

    return withEvaluationRange(config, this.range, () => {
      let fallbackRandomCall = 0
      const nextRandomCall = () => getEvaluationContext(config)?.budget.randomCalls ?? ++fallbackRandomCall
      const one = config.random(0, 9)
      const oneRandomCall = nextRandomCall()
      const ten = config.random(0, 9)
      const tenRandomCall = nextRandomCall()
      this.evaluation.one = one
      this.evaluation.oneRandomCall = oneRandomCall
      this.evaluation.ten = ten
      this.evaluation.tenRandomCall = tenRandomCall
      this.evaluation.d100 = percentileValue(ten, one)
      const roll: PRollEvaluation[] = fill(b).map(_ => {
        const tens = config.random(0, 9)
        return [tens, false, nextRandomCall()]
      })
      const realTen = roll.map(n => n[0]).concat(ten).reduce((selected, candidate) => {
        const selectedValue = percentileValue(selected, one)
        const candidateValue = percentileValue(candidate, one)
        if (this.pb === 'p') {
          return candidateValue > selectedValue ? candidate : selected
        }
        return candidateValue < selectedValue ? candidate : selected
      }, ten)
      this.evaluation.realTen = realTen
      roll.forEach(n => n[0] === realTen && (n[1] = true))
      this.evaluation.roll = roll
      const value = percentileValue(realTen, one)
      this.evaluation.value = value
      return value
    })
  }

  expression(a: number, b: number) {
    return `${a ?? ''}${this.pb}${b ?? ''}`
  }

  pure(): boolean {
    return false
  }

  toString(indentation = 0): string {
    const d100 = this.evaluation.d100
    const pb = this.pb == 'p' ? 'punish' : 'bonus'
    const roll = this.evaluation.roll
      .map(([n, selected]) => selected ? `[${n}]` : n).join(', ')
    const result = this.evaluation.value
    if (this.b?.pure() ?? true) {
      return `{D100: ${d100}, ${pb}: [${roll}]}(${result})`
    }
    const idt = indent(indentation)
    const idt1 = indent(indentation + 1)
    const lines = [
      `{`,
      `${idt1}D100: ${d100}`,
      `${idt1}B: ${this.b.toString(indentation + 1)}`,
      `${idt1}${pb}: [${roll}]`,
      `${idt}}(${result})`,
    ]
    return lines.join('\n')
  }
}

function percentileValue(ten: number, one: number) {
  const value = ten * 10 + one
  return value === 0 ? 100 : value
}
