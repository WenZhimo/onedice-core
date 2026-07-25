import { Config, fill, indent } from '../..'
import { OneDiceError } from '../../errors'
import { getEvaluationContext, withEvaluationRange } from '../../evaluation/context'
import { DiceNode } from '..'

export type CRollEvaluation = [value: number, rerolled: boolean, selected: boolean, randomCall: number]

export interface CEvaluation {
  expression: string
  rounds: CRollEvaluation[][]
  count: number, last: number
  a: number, b: number, c: number
  value: number
}

export class CNode implements DiceNode<CEvaluation> {
  range?: DiceNode['range']
  evaluation: CEvaluation
  constructor(
    public a: DiceNode,
    public b: DiceNode,
    public c: DiceNode,
  ) {}

  eval(config: Config): number {
    const a = this.a?.eval(config) ?? config.c.a
    const b = this.b?.eval(config) ?? config.c.b
    const c = this.c?.eval(config) ?? config.c.c
    const rangeMeta = this.range ? { range: this.range } : {}
    if (a === null || a < 1) throw new OneDiceError(
      'DICE_INVALID_DICE_COUNT',
      'c 骰池的骰数必须大于等于 1',
      {
        operator: 'c',
        actual: a,
        ...rangeMeta,
        hint: '请在 c 前提供正整数骰数，例如 1c2 或 3c8。',
      },
    )
    if (b === null || b < 2) throw new OneDiceError(
      'DICE_INVALID_FACE_COUNT',
      'c 骰池的触发阈值必须大于等于 2',
      {
        operator: 'c',
        actual: b,
        ...rangeMeta,
        hint: '请在 c 后提供大于等于 2 的阈值，例如 1c2。',
      },
    )
    if (c < 1) throw new OneDiceError(
      'DICE_INVALID_FACE_COUNT',
      'c 骰池的 m 面数必须大于等于 1',
      {
        operator: 'm',
        actual: c,
        ...rangeMeta,
        hint: '请使用大于等于 1 的 m 面数。',
      },
    )
    this.evaluation = {
      a, b, c, rounds: [],
      count: null, last: null,
      expression: this.expression(a, b, c),
      value: null,
    }

    return withEvaluationRange(config, this.range, () => {
      let rollCount = 0
      let fallbackRandomCall = 0

      let count = a
      let roll: CRollEvaluation[]
      let round = 0
      while (count !== 0) {
        rollCount += count
        if (rollCount > config.maxRollCount) throw new OneDiceError(
          'DICE_TOO_MANY_ROLLS',
          '掷出骰子数量超过 maxRollCount',
          {
            operator: 'c',
            actual: rollCount,
            limit: config.maxRollCount,
            ...rangeMeta,
            hint: `当前上限为 ${config.maxRollCount}，请减少骰池规模或调高 maxRollCount。`,
          },
        )
        roll = fill(count).map(_ => {
          const value = config.random(1, c)
          const context = getEvaluationContext(config)

          return [value, false, false, context?.budget.randomCalls ?? ++fallbackRandomCall]
        })
        this.evaluation.rounds.push(roll)
        count = roll.filter(n => {
          if (n[0] < b) return false
          return n[1] = true
        }).length
        if (count !== 0) round++
      }
      const max = Math.max(...roll.map(n => n[0]))
      roll.forEach(n => n[0] === max && (n[2] = true))
      const value = round * c + max
      this.evaluation.count = round
      this.evaluation.last = max
      this.evaluation.value = value
      return value
    })
  }

  expression(a: number, b: number, c: number) {
    const as = String(a ?? '')
    const bs = String(b ?? '')
    const cs = c ? `m${c}` : ''
    return as + 'c' + bs + cs
  }

  pure(): boolean {
    return false
  }

  toString(indentation = 0): string {
    const idt = indent(indentation)
    const idt1 = indent(indentation + 1)
    const idt2 = indent(indentation + 2)
    const a = this.a ? this.a.toString(indentation + 1) : this.evaluation.a
    const b = this.b ? this.b.toString(indentation + 1) : this.evaluation.b
    const c = this.c ? this.c.toString(indentation + 1) : this.evaluation.c
    const { count, last, value: result, c: cNum } = this.evaluation
    const rounds = this.evaluation.rounds
      .map(round => {
        const r = round.map(([n, s1, s2]) => {
          if (s1 && !s2) return `<${n}>`
          if (!s1 && s2) return `[${n}]`
          // this won't appear in c
          // if (s1 && s2) return `<[${n}]>`
          return `${n}`
        }).join(', ')
        return `${idt2}{${r}}`
      }).join('\n')
    const lines = [
      `{`,
      `${idt1}A: ${a}, B: ${b}, C: ${c}`,
      `${idt1}rounds: {\n${rounds}\n${idt1}}`,
      `${idt}}(${count} * ${cNum} + ${last})(${result})`,
    ]
    return lines.join('\n')
  }
}
