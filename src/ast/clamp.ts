import { Config } from '..'
import { createScalarValue, projectToNumber, RollValue, TupleValue } from '../evaluation/value'
import { DiceNode } from '.'
import { DNode } from './dice'
import { TupleNode } from './tuple'
import { tupleValueFromNode } from './tuple-selection'

export type ClampOperator = 'min' | 'max'

export interface ClampEvaluation {
  operator: ClampOperator
  limit: number
  before: number[]
  after: number[]
  value: number
  raw: RollValue
}

export class ClampNode implements DiceNode<ClampEvaluation> {
  evaluation: ClampEvaluation
  range?: DiceNode['range']

  constructor(
    public operator: ClampOperator,
    public left: DiceNode,
    public right: DiceNode,
  ) {}

  eval(config: Config): number {
    const leftValue = this.left.eval(config)
    const limit = this.right.eval(config)
    const tuple = tupleValueFromNode(this.left, leftValue)
    const before = tuple.items.map(item => projectToNumber(item, 'sum', this.left.range))
    const after = before.map(value => clampValue(this.operator, value, limit))
    const isTuple = isTupleSource(this.left)
    const raw: RollValue = isTuple
      ? createTupleRaw(this.operator, after)
      : createScalarValue(after[0], 'operator')
    const value = projectToNumber(raw, 'sum', this.range)

    this.evaluation = {
      operator: this.operator,
      limit,
      before,
      after,
      value,
      raw,
    }

    return value
  }

  pure(): boolean {
    return this.left.pure() && this.right.pure()
  }

  toString(indentation = 0): string {
    return `${this.left.toString(indentation)}${this.operator}${this.right.toString(indentation)}`
  }
}

function clampValue(operator: ClampOperator, value: number, limit: number): number {
  if (operator === 'min') return value < limit ? limit : value
  return value > limit ? limit : value
}

function isTupleSource(node: DiceNode): boolean {
  return node instanceof TupleNode
    || (
      node instanceof DNode
      && Boolean(node.evaluation.roll)
      && !node.evaluation.pb
      && node.evaluation.e === null
    )
}

function createTupleRaw(operator: ClampOperator, values: number[]): TupleValue {
  return {
    kind: 'tuple',
    items: values.map(value => createScalarValue(value, 'operator')),
    projection: 'sum',
    source: 'operator',
    operator,
  }
}
