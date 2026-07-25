import { Config } from '..'
import { OneDiceError } from '../errors'
import { createScalarValue, projectToNumber, RollValue, TupleValue } from '../evaluation/value'
import { DiceNode } from '.'
import { DNode } from './dice'
import { TupleNode } from './tuple'

export type TupleSelectionOperator = 'kh' | 'kl' | 'dh' | 'dl'

export interface TupleSelectionEvaluation {
  operator: TupleSelectionOperator
  count: number
  inputLength: number
  selectedIndexes: number[]
  droppedIndexes: number[]
  value: number
  raw: TupleValue
}

export class TupleSelectionNode implements DiceNode<TupleSelectionEvaluation> {
  evaluation: TupleSelectionEvaluation
  range?: DiceNode['range']

  constructor(
    public operator: TupleSelectionOperator,
    public left: DiceNode,
    public count: DiceNode | null,
  ) {}

  eval(config: Config): number {
    const leftValue = this.left.eval(config)
    const tuple = tupleValueFromNode(this.left, leftValue)
    const count = this.count ? this.count.eval(config) : 1
    const inputLength = tuple.items.length
    const countRange = this.count?.range ?? this.range

    if (!Number.isInteger(count) || count < 1 || count > inputLength) {
      throw new OneDiceError(
        'DICE_INVALID_KEEP_COUNT',
        'Tuple selection count must be between 1 and the tuple length',
        {
          operator: this.operator,
          actual: count,
          limit: inputLength,
          ...(countRange ? { range: countRange } : {}),
          hint: `Use a ${this.operator} count between 1 and ${inputLength}.`,
        },
      )
    }

    const rankedIndexes = tuple.items
      .map((item, index) => ({ index, value: projectToNumber(item, 'sum', this.left.range) }))
      .sort((left, right) => {
        const direction = this.operator.endsWith('h') ? right.value - left.value : left.value - right.value
        return direction || left.index - right.index
      })
      .slice(0, count)
      .map(item => item.index)

    const selected = tuple.items.map((_, index) => {
      const matched = rankedIndexes.includes(index)
      return this.operator.startsWith('k') ? matched : !matched
    })
    const dropped = selected.map(value => !value)
    const selectedIndexes = selected
      .map((value, index) => value ? index : null)
      .filter((index): index is number => index !== null)
    const droppedIndexes = dropped
      .map((value, index) => value ? index : null)
      .filter((index): index is number => index !== null)

    const raw: TupleValue = {
      kind: 'tuple',
      items: tuple.items,
      projection: 'sum',
      source: 'operator',
      operator: this.operator,
      selected,
      dropped,
    }
    const value = projectToNumber(raw, 'sum', this.range)

    this.evaluation = {
      operator: this.operator,
      count,
      inputLength,
      selectedIndexes,
      droppedIndexes,
      value,
      raw,
    }

    return value
  }

  pure(): boolean {
    return this.left.pure() && (this.count?.pure() ?? true)
  }

  toString(indentation = 0): string {
    return `${this.left.toString(indentation)}${this.operator}${this.count ? this.count.toString(indentation) : ''}`
  }
}

export function tupleValueFromNode(node: DiceNode, value: number): TupleValue {
  const rawTuple = rawTupleValueFromNode(node)
  if (rawTuple) return rawTuple

  if (
    node instanceof DNode
    && node.evaluation.roll
    && !node.evaluation.pb
    && node.evaluation.e === null
  ) {
    return {
      kind: 'tuple',
      items: [...node.evaluation.roll]
        .sort((left, right) => left.index - right.index)
        .map((roll) => createScalarValue(roll.value, 'literal', {
          index: roll.index,
          randomCall: roll.randomCall,
          selected: roll.selected,
          dropped: !roll.selected,
          source: 'base',
        })),
      projection: 'sum',
      source: 'dice-rolls',
    }
  }

  return {
    kind: 'tuple',
    items: [createScalarValue(value, 'projection')],
    projection: 'sum',
    source: 'operator',
  }
}

export function tupleSourceKindFromNode(node: DiceNode): RollValue['kind'] {
  if (rawTupleValueFromNode(node)) return 'tuple'
  if (
    node instanceof DNode
    && node.evaluation.roll
    && !node.evaluation.pb
    && node.evaluation.e === null
  ) {
    return 'tuple'
  }
  return 'scalar'
}

function rawTupleValueFromNode(node: DiceNode): TupleValue | null {
  if (node instanceof TupleNode) return node.evaluation.raw

  const evaluation = (node as { evaluation?: unknown }).evaluation
  if (!evaluation || typeof evaluation !== 'object' || !('raw' in evaluation)) return null

  const raw = (evaluation as { raw?: RollValue }).raw
  return raw?.kind === 'tuple' ? raw : null
}
