import { Config, dice, indent } from '..'
import { OneDiceError } from '../errors'
import { DiceNode } from '.'

export interface InterpolationEvaluation {
  input: string
  node: DiceNode
  value: number
}

export class InterpolationNode implements DiceNode<InterpolationEvaluation> {
  evaluation: InterpolationEvaluation
  range?: DiceNode['range']

  constructor(public key: string) {}

  eval(config: Config): number {
    const envValue = config.env[this.key]
    if (envValue === undefined) throw new OneDiceError(
      'VARIABLE_NOT_FOUND',
      `没有名为 ${this.key} 的表达式`,
      {
        actual: this.key,
        ...(this.range ? { range: this.range } : {}),
        hint: '请在 env 中提供该插值名称对应的表达式。',
      },
    )
    const input = String(envValue)
    const [value, node] = dice(input, {
      env: {}, // avoid infinite recursion
      ...config,
    })
    this.evaluation = {
      input, value,
      node,
    }
    return value
  }

  pure(): boolean {
    return false
  }
  
  toString(indentation = 0): string {
    return `(${this.evaluation.node.toString(indentation)})`
  }
}
