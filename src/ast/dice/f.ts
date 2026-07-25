import { Config, fill, negative, sum, indent } from '../..'
import { OneDiceError } from '../../errors'
import { getEvaluationContext, withEvaluationRange } from '../../evaluation/context'
import { DiceNode } from '..'

export interface FRollEvaluation {
  value: -1 | 0 | 1
  randomCall: number
}

export interface FEvaluation {
  expression: string
  roll: FRollEvaluation[]
  a: number, b: number
  value: number
}

export class FNode implements DiceNode<FEvaluation> {
  range?: DiceNode['range']
  evaluation: FEvaluation
  constructor(
    public a: DiceNode,
    public b: DiceNode,
  ) {}

  eval(config: Config): number {
    const a = this.a?.eval(config) ?? config.f.a
    const b = this.b?.eval(config) ?? config.f.b
    const rangeMeta = this.range ? { range: this.range } : {}
    if (negative(a, b) || a < 1) throw new OneDiceError(
      'DICE_INVALID_DICE_COUNT',
      'FATE 骰数量必须大于等于 1',
      {
        operator: 'f',
        actual: a,
        ...rangeMeta,
        hint: '请使用类似 4f 或 3f 的表达式。',
      },
    )
    if (a > config.maxRollCount) throw new OneDiceError(
      'DICE_TOO_MANY_ROLLS',
      '掷出骰子数量超过 maxRollCount',
      {
        operator: 'f',
        actual: a,
        limit: config.maxRollCount,
        ...rangeMeta,
        hint: `当前上限为 ${config.maxRollCount}，请减少 FATE 骰数量或调高 maxRollCount。`,
      },
    )
    this.evaluation = {
      a, b,
      expression: this.expression(a, b),
      roll: null, value: null,
    }

    return withEvaluationRange(config, this.range, () => {
      const op = [1, -1, 0]
      const roll: FRollEvaluation[] = fill(a).map((_, index) => {
        const value = op[config.random(0, 2)] as -1 | 0 | 1
        const context = getEvaluationContext(config)

        return {
          value,
          randomCall: context?.budget.randomCalls ?? index + 1,
        }
      })
      this.evaluation.roll = roll
      const value = sum(roll.map(n => n.value))
      this.evaluation.value = value
      return value
    })
  }

  expression(a: number, b: number) {
    const as = String(a ?? '')
    const bs = String(b ?? '')
    return as + 'f' + bs
  }

  pure(): boolean {
    return false
  }

  toString(indentation = 0): string {
    const roll = this.evaluation.roll.map(n => n.value).join(', ')
    const result = this.evaluation.value
    if (this.a?.pure() ?? true) {
      return `{${roll}}(${result})`
    }
    const idt = indent(indentation)
    const idt1 = indent(indentation + 1)
    const lines = [
      `{`,
      `${idt1}A: ${this.a.toString(indentation + 1)}`,
      `${idt1}roll: [${roll}]`,
      `${idt}}(${result})`,
    ]
    return lines.join('\n')
  }
}
