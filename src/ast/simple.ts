import { Config } from '..'
import { OneDiceError } from '../errors'
import { DiceNode } from '.'

export interface SimpleEvaluation {
  operator: string
  left: number
  right: number
  value: number
}

export class SimpleNode implements DiceNode<SimpleEvaluation> {
  evaluation: SimpleEvaluation
  constructor(
    public operator: string,
    public left: DiceNode,
    public right: DiceNode,
  ) {}

  eval(config: Config): number {
    const left = this.left.eval(config)
    const right = this.right.eval(config)
    let value: number
    switch (this.operator) {
      case '+':
        value = left + right
        break
      case '-':
        value = left - right
        break
      case '*':
      case 'x':
        value = left * right
        break
      case '/':
        value = Math.trunc(left / right)
        break
      case '^':
        value = Math.pow(left, right)
        break
      default:
        throw new OneDiceError(
          'PARSE_UNSUPPORTED_SYNTAX',
          `未知二元运算符：${this.operator}`,
          {
            operator: this.operator,
            hint: '该运算符尚未被 OneDice V1 支持。',
          },
        )
    }
    this.evaluation = {
      left, right, operator: this.operator, value
    }
    return value
  }

  pure(): boolean {
    const left = this.left ? this.left.pure() : true
    const right = this.right ? this.right.pure() : true
    return left && right
  }

  toString(indentation = 0): string {
    return `${
      this.left.toString(indentation)
    } ${this.operator} ${
      this.right.toString(indentation)
    }`
  }
}
