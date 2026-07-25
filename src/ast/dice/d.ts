import { Config, dice, fill, sum, indent } from '../..'
import { OneDiceError } from '../../errors'
import { getEvaluationContext, withEvaluationRange } from '../../evaluation/context'
import type { TokenRange } from '../../parser'
import { DiceNode } from '..'
import { ANode, PNode } from '.'

const D_OPERAND_MAX = 10000

export interface DEvaluation {
  expression: string
  aNode: ANode
  pNodes: PNode[]
  roll: DRollEvaluation[]
  a: number, b: number, c: number, d: number, e: number
  kq: 'k' | 'q', pb: 'p' | 'b'
  value: number
}

export interface DRollEvaluation {
  index: number
  randomCall: number
  value: number
  selected: boolean
}

export class DNode implements DiceNode<DEvaluation> {
  evaluation: DEvaluation
  range?: DiceNode['range']
  constructor(
    public a: DiceNode,
    public b: DiceNode,
    public c: DiceNode,
    public d: DiceNode,
    public e: DiceNode,
    public kq: 'k' | 'q',
    public pb: 'p' | 'b',
    public modifierRanges: Partial<Record<'k' | 'q' | 'p' | 'b' | 'a', TokenRange>> = {},
  ) {}

  eval(config: Config): number {
    const a = this.a?.eval(config) ?? config.d.a
    const b = this.b?.eval(config) ?? config.d.b
    const c = this.c?.eval(config) ?? config.d.c ?? a
    const d = this.d?.eval(config) ?? config.d.d
    const e = this.e?.eval(config) ?? config.d.e
    const rangeMeta = this.range ? { range: this.range } : {}
    const diceRangeMeta = this.a?.range ? { range: this.a.range } : rangeMeta
    const faceRangeMeta = this.b?.range ? { range: this.b.range } : rangeMeta
    if (a < 1) throw new OneDiceError(
      'DICE_INVALID_DICE_COUNT',
      'd 表达式的骰数必须大于等于 1',
      {
        operator: 'd',
        actual: a,
        diceCount: a,
        min: 1,
        max: D_OPERAND_MAX,
        hint: '请使用类似 1d6、d20 或 2d100 的表达式。',
        ...diceRangeMeta,
      },
    )
    if (a > D_OPERAND_MAX) throw new OneDiceError(
      'DICE_INVALID_DICE_COUNT',
      'd 表达式的骰数不能超过 10000',
      {
        operator: 'd',
        actual: a,
        diceCount: a,
        limit: D_OPERAND_MAX,
        min: 1,
        max: D_OPERAND_MAX,
        hint: '请使用小于等于 10000 的骰数。',
        ...diceRangeMeta,
      },
    )
    if (b < 1) throw new OneDiceError(
      'DICE_INVALID_FACE_COUNT',
      'd 表达式的面数必须大于等于 1',
      {
        operator: 'd',
        actual: b,
        faceCount: b,
        min: 1,
        max: D_OPERAND_MAX,
        hint: '请使用类似 1d6、d20 或 2d100 的表达式。',
        ...faceRangeMeta,
      },
    )
    if (b > D_OPERAND_MAX) throw new OneDiceError(
      'DICE_INVALID_FACE_COUNT',
      'd 表达式的面数不能超过 10000',
      {
        operator: 'd',
        actual: b,
        faceCount: b,
        limit: D_OPERAND_MAX,
        min: 1,
        max: D_OPERAND_MAX,
        hint: '请使用小于等于 10000 的面数。',
        ...faceRangeMeta,
      },
    )
    if (this.kq && c < 1) throw new OneDiceError(
      'DICE_INVALID_KEEP_COUNT',
      'd 表达式的选取个数必须大于等于 1',
      {
        operator: this.kq,
        actual: c,
        keepCount: c,
        diceCount: a,
        min: 1,
        max: a,
        hint: '请使用大于等于 1 的选取个数。',
        ...this.modifierRangeMeta(this.kq),
      },
    )
    if (this.pb && d < 0) throw new OneDiceError(
      'PERCENTILE_INVALID_BONUS_PENALTY_COUNT',
      'd 表达式的奖惩骰数量不能为负数',
      {
        operator: this.pb,
        actual: d,
        modifier: this.pb,
        bonusPenaltyCount: d,
        min: 0,
        hint: '请使用非负的奖惩骰数量。',
        ...this.modifierRangeMeta(this.pb),
      },
    )
    if (e !== null && e < 0) throw new OneDiceError(
      'DICE_INVALID_KEEP_COUNT',
      'd 表达式的 a 骰池阈值不能为负数',
      {
        operator: 'a',
        actual: e,
        modifier: 'a',
        poolThreshold: e,
        min: 0,
        hint: '请使用非负的 a 骰池阈值。',
        ...this.modifierRangeMeta('a'),
      },
    )
    this.evaluation = {
      a, b, c, d, e, kq: this.kq, pb: this.pb,
      expression: this.expression(a, b, c, d ,e),
      aNode: null, pNodes: null,
      roll: null, value: null,
    }

    if (e !== null) {
      if (this.kq || this.pb) {
        const conflictingModifier = this.latestModifier('a', this.kq, this.pb)
        throw new OneDiceError(
          'DICE_POOL_MODIFIER_EXCLUSIVE',
          'd 表达式的 a 骰池参数不能与 k/q 或 p/b 同时使用',
          {
            operator: 'd',
            actual: this.expression(a, b, c, d, e),
            modifier: conflictingModifier,
            poolModifier: 'a',
            conflictingModifier: conflictingModifier === 'a' ? (this.kq || this.pb) : conflictingModifier,
            conflictWith: conflictingModifier === 'a' ? (this.kq || this.pb) : 'a',
            hint: '请只保留 a[点数阈值]，或移除 a 后使用 k/q、p/b。',
            ...this.modifierRangeMeta(conflictingModifier),
          },
        )
      }
      const [value, node] = withEvaluationRange(
        config,
        this.range,
        () => dice(`${a}a${b + 1}k${e}m${b}`, config),
      )
      this.evaluation.aNode = node as ANode
      this.evaluation.value = value
      return value
    } else {
      if (this.kq && this.pb) {
        const conflictingModifier = this.latestModifier(this.kq, this.pb)
        throw new OneDiceError(
          'DICE_INCOMPATIBLE_MODIFIERS',
          'd 表达式不能同时使用 k/q 选取线与 p/b 奖惩骰',
          {
            operator: 'd',
            actual: this.expression(a, b, c, d, e),
            modifier: conflictingModifier,
            leftModifier: this.kq,
            rightModifier: this.pb,
            conflictWith: conflictingModifier === this.kq ? this.pb : this.kq,
            hint: '请在 k/q 和 p/b 中只选择一类修饰符。',
            ...this.modifierRangeMeta(conflictingModifier),
          },
        )
      }
      if (this.kq && c > a) throw new OneDiceError(
        'DICE_INVALID_KEEP_COUNT',
        'd 表达式的选取个数不能大于骰数',
        {
          operator: this.kq,
          actual: c,
          limit: a,
          modifier: this.kq,
          keepCount: c,
          diceCount: a,
          min: 1,
          max: a,
          hint: `当前骰数为 ${a}，选取个数必须小于等于 ${a}。`,
          ...this.modifierRangeMeta(this.kq),
        },
      )
      const rollCount = this.pb ? a * d : a
      if (rollCount > config.maxRollCount) throw new OneDiceError(
        'DICE_TOO_MANY_ROLLS',
        '掷出骰子数量超过 maxRollCount',
        {
          operator: 'd',
          actual: rollCount,
          limit: config.maxRollCount,
          hint: `当前上限为 ${config.maxRollCount}，请减少骰数或调高 maxRollCount。`,
          ...rangeMeta,
        },
      )

      if (this.pb) {
        const pbs = fill(a).map(_ => withEvaluationRange(
          config,
          this.range,
          () => dice(`${this.pb}${d}`, config),
        ))
        this.evaluation.pNodes = pbs.map(n => n[1] as PNode)
        const value = sum(pbs.map(n => n[0]))
        this.evaluation.value = value
        return value
      }

      const roll: DRollEvaluation[] = withEvaluationRange(
        config,
        this.range,
        () => fill(a).map((_, index) => {
          const value = config.random(1, b)
          const context = getEvaluationContext(config)

          return {
            index,
            randomCall: context?.budget.randomCalls ?? index + 1,
            value,
            selected: false,
          }
        }),
      )
      roll.sort((left, right) => left.value - right.value)
      this.evaluation.roll = [...roll]
      if (this.kq) {
        if (this.kq === 'k') {
          roll.splice(0, a - c)
        } else {
          roll.splice(c)
        }
      }
      roll.forEach(n => n.selected = true)
      const value = sum(roll.map(n => n.value))
      this.evaluation.value = value
      return value
    }
  }

  expression(a: number, b: number, c: number, d: number, e: number) {
    const as = String(a ?? '')
    const bs = String(b ?? '')
    const cs = this.kq ? `${this.kq}${c}` : ''
    const ds = this.pb ? `${this.pb}${d}` : ''
    const es = e !== null ? `a${e}` : ''
    return as + 'd' + bs + cs + ds + es
  }

  pure(): boolean {
    return false
  }

  private modifierRangeMeta(modifier?: 'k' | 'q' | 'p' | 'b' | 'a') {
    const range = modifier ? this.modifierRanges[modifier] : undefined
    return range ? { range } : (this.range ? { range: this.range } : {})
  }

  private latestModifier(...modifiers: Array<'k' | 'q' | 'p' | 'b' | 'a'>) {
    return modifiers
      .filter(Boolean)
      .sort((left, right) => {
        const leftStart = this.modifierRanges[left]?.start ?? -1
        const rightStart = this.modifierRanges[right]?.start ?? -1
        return rightStart - leftStart
      })[0]
  }

  toString(indentation = 0): string {
    const idt = indent(indentation)
    const idt1 = indent(indentation + 1)
    const pure = (this.a?.pure() ?? true)
      && (this.b?.pure() ?? true)
      && (this.c?.pure() ?? true)
      && (this.d?.pure() ?? true)
      && (this.e?.pure() ?? true)
    const a = this.a ? this.a.toString(indentation + 1) : this.evaluation.a
    const b = this.b ? this.b.toString(indentation + 1) : this.evaluation.b
    const c = this.c ? this.c.toString(indentation + 1) : this.evaluation.c
    const d = this.d ? this.d.toString(indentation + 1) : this.evaluation.d
    const e = this.e ? this.e.toString(indentation + 1) : this.evaluation.e
    const show = [
      a !== null ? `A: ${a}` : null,
      b !== null ? `B: ${b}` : null,
      c !== null ? `C: ${c}` : null,
      d !== null ? `D: ${d}` : null,
      e !== null ? `E: ${e}` : null,
    ].filter(n => n).join(', ')
    const result = this.evaluation.value
    if (this.evaluation.e !== null) {
      const as = this.evaluation.aNode.toString(indentation + 1)
      return [
        `{`,
        `${idt1}${show}`,
        `${idt1}${as}`,
        `${idt}}(${result})`,
      ].join('\n')
    }
    if (this.kq) {
      if (pure) {
        const roll = this.evaluation.roll
          .map(({ value, selected }) => selected ? `[${value}]` : value).join(', ')
        return `{${roll}}(${result})`
      }
      return [
        `{`,
        `${idt1}${show}`,
        `${idt}}(${result})`,
      ].join('\n')
    }
    if (this.pb) {
      if (this.evaluation.a === 1 && pure) {
        return this.evaluation.pNodes[0].toString(indentation)
      }
      const idt = indent(indentation)
      const idt1 = indent(indentation + 1)
      const pNodes = this.evaluation.pNodes
      const pbs = pNodes.map(n => idt1 + n.toString(indentation + 1))
      const adds = pNodes.map(n => n.evaluation.value)
        .filter(n => n !== 0).join(' + ')
      const lines = [
        `{`,
        `${idt1}${show}`,
        ...pbs,
        `${idt}}(${adds})(${result})`,
      ]
      return lines.join('\n')
    }
    const roll = this.evaluation.roll.map(n => n.value).join(', ')
    if (pure) {
      if (this.evaluation.a === 1) return `(${result})`
      return `{${roll}}(${result})`
    }
    return [
      `{`,
      `${idt1}${show}`,
      `${idt1}roll: [${roll}]`,
      `${idt}}(${result})`
    ].join('\n')
  }
}
