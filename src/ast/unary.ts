
import { Config } from '..'
import { OneDiceError } from '../errors'
import { DiceNode } from '.'

export interface UnaryEvaluation {
  operator: string
  right: number
  value: number
}

export class UnaryNode implements DiceNode<UnaryEvaluation> {
  evaluation: UnaryEvaluation
  constructor(
    public operator: string,
    public right: DiceNode,
  ) {}

  eval(config: Config): number {
    const right = this.right.eval(config)
    let value: number
    switch (this.operator) {
      case '+':
        value = +right
        break
      case '-':
        value = -right
        break
      default:
        throw new OneDiceError(
          'PARSE_UNSUPPORTED_SYNTAX',
          `未知一元运算符：${this.operator}`,
          {
            operator: this.operator,
            hint: '该一元运算符尚未被 OneDice V1 支持。',
          },
        )
    }
    this.evaluation = {
      right, operator: this.operator, value
    }
    return value
  }

  pure(): boolean {
    return this.right ? this.right.pure() : true
  }

  toString(indentation = 0): string {
    return `${this.operator}${this.right.toString(indentation)}`
  }
}
