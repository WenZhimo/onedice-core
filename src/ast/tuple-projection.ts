import { Config } from '..'
import { projectToNumber, RollValue, TupleValue } from '../evaluation/value'
import { DiceNode } from '.'
import { tupleSourceKindFromNode, tupleValueFromNode } from './tuple-selection'

export interface TupleProjectionEvaluation {
  operator: 'tp'
  value: number
  raw: TupleValue
  sourceKind: RollValue['kind']
  itemCount: number
}

export class TupleProjectionNode implements DiceNode<TupleProjectionEvaluation> {
  evaluation: TupleProjectionEvaluation
  range?: DiceNode['range']

  constructor(public left: DiceNode) {}

  eval(config: Config): number {
    const leftValue = this.left.eval(config)
    const tuple = tupleValueFromNode(this.left, leftValue)
    const raw: TupleValue = {
      kind: 'tuple',
      items: tuple.items,
      projection: 'sum',
      source: 'operator',
      operator: 'tp',
      ...(tuple.selected ? { selected: tuple.selected } : {}),
      ...(tuple.dropped ? { dropped: tuple.dropped } : {}),
    }
    const value = projectToNumber(raw, 'sum', this.range)

    this.evaluation = {
      operator: 'tp',
      value,
      raw,
      sourceKind: tupleSourceKindFromNode(this.left),
      itemCount: tuple.items.length,
    }

    return value
  }

  pure(): boolean {
    return this.left.pure()
  }

  toString(indentation = 0): string {
    return `${this.left.toString(indentation)}tp`
  }
}
