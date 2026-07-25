import { Config } from '..'
import { createScalarValue, projectToNumber, TupleValue } from '../evaluation/value'
import { DiceNode } from '.'

export interface TupleEvaluation {
  value: number
  raw: TupleValue
}

export class TupleNode implements DiceNode<TupleEvaluation> {
  evaluation: TupleEvaluation
  range?: DiceNode['range']

  constructor(public items: DiceNode[]) {}

  eval(config: Config): number {
    const raw: TupleValue = {
      kind: 'tuple',
      items: this.items.map((item) => createScalarValue(item.eval(config), 'literal')),
      projection: 'last',
      source: 'literal',
    }
    const value = projectToNumber(raw, 'last', this.range)

    this.evaluation = {
      value,
      raw,
    }

    return value
  }

  pure(): boolean {
    return this.items.every(item => item.pure())
  }

  toString(indentation = 0): string {
    return `[${this.items.map(item => item.toString(indentation)).join(',')}]`
  }
}

