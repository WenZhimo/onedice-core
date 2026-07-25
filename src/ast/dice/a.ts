import { Config, fill, indent } from '../..'
import { OneDiceError } from '../../errors'
import { getEvaluationContext, withEvaluationRange } from '../../evaluation/context'
import { DiceNode } from '..'

export type ARollEvaluation = [value: number, rerolled: boolean, selected: boolean, randomCall: number]

export interface AEvaluation {
  expression: string
  rounds: ARollEvaluation[][]
  a: number, b: number, c: number, d: number, e: number
  value: number
}

export class ANode implements DiceNode<AEvaluation> {
  range?: DiceNode['range']
  evaluation: AEvaluation
  constructor(
    public a: DiceNode,
    public b: DiceNode,
    public c: DiceNode,
    public d: DiceNode,
    public e: DiceNode,
  ) {}

  eval(config: Config): number {
    const a = this.a?.eval(config) ?? config.a.a
    const b = this.b?.eval(config) ?? config.a.b
    const c = this.c?.eval(config) ?? config.a.c
    const d = this.d?.eval(config) ?? config.a.d
    const e = this.e?.eval(config) ?? config.a.e
    const rangeMeta = this.range ? { range: this.range } : {}
    if (a === null || a < 1) throw new OneDiceError(
      'DICE_INVALID_DICE_COUNT',
      'a 骰池的骰数必须大于等于 1',
      {
        operator: 'a',
        actual: a,
        ...rangeMeta,
        hint: '请在 a 前提供正整数骰数，例如 1a2 或 3a8。',
      },
    )
    if (b === null || b < 2) throw new OneDiceError(
      'DICE_INVALID_FACE_COUNT',
      'a 骰池的触发阈值必须大于等于 2',
      {
        operator: 'a',
        actual: b,
        ...rangeMeta,
        hint: '请在 a 后提供大于等于 2 的阈值，例如 1a2。',
      },
    )
    if (c !== null && c < 0) throw new OneDiceError(
      'DICE_INVALID_KEEP_COUNT',
      'a 骰池的 k 下限不能为负数',
      {
        operator: 'k',
        actual: c,
        ...rangeMeta,
        hint: '请使用非负的 k 下限。',
      },
    )
    if (d !== null && d < 0) throw new OneDiceError(
      'DICE_INVALID_KEEP_COUNT',
      'a 骰池的 q 上限不能为负数',
      {
        operator: 'q',
        actual: d,
        ...rangeMeta,
        hint: '请使用非负的 q 上限。',
      },
    )
    if (e < 1) throw new OneDiceError(
      'DICE_INVALID_FACE_COUNT',
      'a 骰池的 m 面数必须大于等于 1',
      {
        operator: 'm',
        actual: e,
        ...rangeMeta,
        hint: '请使用大于等于 1 的 m 面数。',
      },
    )
    this.evaluation = {
      a, b, c, d, e, rounds: [],
      expression: this.expression(a, b, c, d, e),
      value: null,
    }
    
    return withEvaluationRange(config, this.range, () => {
      let rollCount = 0
      let fallbackRandomCall = 0

      let count = a
      const roll: ARollEvaluation[] = []
      while (count !== 0) {
        rollCount += count
        if (rollCount > config.maxRollCount) throw new OneDiceError(
          'DICE_TOO_MANY_ROLLS',
          '掷出骰子数量超过 maxRollCount',
          {
            operator: 'a',
            actual: rollCount,
            limit: config.maxRollCount,
            ...rangeMeta,
            hint: `当前上限为 ${config.maxRollCount}，请减少骰池规模或调高 maxRollCount。`,
          },
        )
        const r: ARollEvaluation[] =
          fill(count).map(_ => {
            const value = config.random(1, e)
            const context = getEvaluationContext(config)

            return [value, false, false, context?.budget.randomCalls ?? ++fallbackRandomCall]
          })
        this.evaluation.rounds.push(r)
        count = r.filter(n => {
          if (n[0] < b) return false
          return n[1] = true
        }).length
        roll.push(...r)
      }
      const value = roll.filter(n => {
        if (c !== null && n[0] < c) return false
        if (d !== null && n[0] > d) return false
        return n[2] = true
      }).length
      this.evaluation.value = value
      return value
    })
  }

  expression(a: number, b: number, c: number, d: number, e: number) {
    const as = String(a ?? '')
    const bs = String(b ?? '')
    const cs = c !== null ? `k${c}` : ''
    const ds = d !== null ? `q${d}` : ''
    const es = e !== null ? `m${e}` : ''
    return as + 'a' + bs + cs + ds + es
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
    const d = this.d ? this.d.toString(indentation + 1) : this.evaluation.d
    const e = this.e ? this.e.toString(indentation + 1) : this.evaluation.e
    const result = this.evaluation.value
    const rounds = this.evaluation.rounds
      .map(round => {
        const r = round.map(([n, s1, s2]) => {
          if (s1 && !s2) return `<${n}>`
          if (!s1 && s2) return `[${n}]`
          if (s1 && s2) return `<[${n}]>`
          return `${n}`
        }).join(', ')
        return `${idt2}{${r}}`
      }).join('\n')
    const adds = this.evaluation.rounds
      .map(round => round.filter(n => n[2]).length)
      .filter(n => n !== 0)
      .join(' + ')
    const lines = [
      `{`,
      `${idt1}A: ${a}, B: ${b}, C: ${c}, ${d !== null ? `D: ${d}, ` : ''}E: ${e}`,
      `${idt1}rounds: {\n${rounds}\n${idt1}}`,
      `${idt}}(${adds})(${result})`,
    ]
    return lines.join('\n')
  }
}
