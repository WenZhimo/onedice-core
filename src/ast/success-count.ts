import { Config } from '..'
import { createScalarValue, RollValue } from '../evaluation/value'
import { DiceNode } from '.'
import { tupleValueFromNode } from './tuple-selection'

export type SuccessCountComparator = '>' | '>=' | '<' | '<=' | '='

export interface SuccessCountEvaluation {
  operator: 'cs'
  comparator: SuccessCountComparator
  target: number
  value: number
  inputLength: number
  successIndexes: number[]
  failureIndexes: number[]
  raw: RollValue
  items: Array<{
    index: number
    value: number
    success: boolean
    counted: boolean
  }>
}

export class SuccessCountNode implements DiceNode<SuccessCountEvaluation> {
  evaluation: SuccessCountEvaluation
  range?: DiceNode['range']

  constructor(
    public comparator: SuccessCountComparator,
    public left: DiceNode,
    public target: DiceNode,
  ) {}

  eval(config: Config): number {
    const leftValue = this.left.eval(config)
    const tuple = tupleValueFromNode(this.left, leftValue)
    const target = this.target.eval(config)

    const items = tuple.items.map((item, index) => {
      const value = item.kind === 'scalar' ? item.value : Number.NaN
      const counted = isCounted(tuple, index)
      const success = counted && compare(value, target, this.comparator)
      return {
        index,
        value,
        success,
        counted,
      }
    })
    const successIndexes = items
      .filter(item => item.success)
      .map(item => item.index)
    const failureIndexes = items
      .filter(item => item.counted && !item.success)
      .map(item => item.index)
    const value = successIndexes.length
    const raw = createScalarValue(value, 'operator')

    this.evaluation = {
      operator: 'cs',
      comparator: this.comparator,
      target,
      value,
      inputLength: tuple.items.length,
      successIndexes,
      failureIndexes,
      raw,
      items,
    }

    return value
  }

  pure(): boolean {
    return this.left.pure() && this.target.pure()
  }

  toString(indentation = 0): string {
    return `${this.left.toString(indentation)}cs${this.comparator === '=' ? '' : this.comparator}${this.target.toString(indentation)}`
  }
}

function isCounted(tuple: Extract<RollValue, { kind: 'tuple' }>, index: number): boolean {
  if (tuple.selected && !tuple.selected[index]) return false
  if (tuple.dropped && tuple.dropped[index]) return false
  return true
}

function compare(value: number, target: number, comparator: SuccessCountComparator): boolean {
  switch (comparator) {
    case '>':
      return value > target
    case '>=':
      return value >= target
    case '<':
      return value < target
    case '<=':
      return value <= target
    case '=':
      return value === target
  }
}
