import { Config } from '..'
import { createScalarValue, projectToNumber, RollValue } from '../evaluation/value'
import { DiceNode } from '.'
import { tupleSourceKindFromNode, tupleValueFromNode } from './tuple-selection'

export type ComparisonOperator = '>' | '<' | '='
export type BooleanOperator = '&' | '|'
export type ConditionalBranch = 'consequent' | 'alternate'

export interface ComparisonEvaluation {
  operator: ComparisonOperator
  left: number
  right: number
  value: number
  raw: RollValue
}

export interface BooleanEvaluation {
  operator: BooleanOperator
  left: number
  right: number
  leftTruthy: boolean
  rightTruthy: boolean
  value: number
  raw: RollValue
}

export interface ConditionalEvaluation {
  conditionValue: number
  selectedBranch: ConditionalBranch
  value: number
  raw: RollValue
}

export class ComparisonNode implements DiceNode<ComparisonEvaluation> {
  evaluation: ComparisonEvaluation

  constructor(
    public operator: ComparisonOperator,
    public left: DiceNode,
    public right: DiceNode,
  ) {}

  eval(config: Config): number {
    const left = projectEvaluatedNode(this.left, this.left.eval(config))
    const right = projectEvaluatedNode(this.right, this.right.eval(config))
    const value = compareValues(this.operator, left, right) ? 1 : 0

    this.evaluation = {
      operator: this.operator,
      left,
      right,
      value,
      raw: createScalarValue(value, 'operator'),
    }

    return value
  }

  pure(): boolean {
    return this.left.pure() && this.right.pure()
  }

  toString(indentation = 0): string {
    return `${this.left.toString(indentation)} ${this.operator} ${this.right.toString(indentation)}`
  }
}

export class BooleanNode implements DiceNode<BooleanEvaluation> {
  evaluation: BooleanEvaluation

  constructor(
    public operator: BooleanOperator,
    public left: DiceNode,
    public right: DiceNode,
  ) {}

  eval(config: Config): number {
    const left = projectEvaluatedNode(this.left, this.left.eval(config))
    const right = projectEvaluatedNode(this.right, this.right.eval(config))
    const leftTruthy = left !== 0
    const rightTruthy = right !== 0
    const value = evaluateBooleanOperator(this.operator, leftTruthy, rightTruthy) ? 1 : 0

    this.evaluation = {
      operator: this.operator,
      left,
      right,
      leftTruthy,
      rightTruthy,
      value,
      raw: createScalarValue(value, 'operator'),
    }

    return value
  }

  pure(): boolean {
    return this.left.pure() && this.right.pure()
  }

  toString(indentation = 0): string {
    return `${this.left.toString(indentation)} ${this.operator} ${this.right.toString(indentation)}`
  }
}

export class ConditionalNode implements DiceNode<ConditionalEvaluation> {
  evaluation: ConditionalEvaluation

  constructor(
    public condition: DiceNode,
    public consequent: DiceNode,
    public alternate: DiceNode,
  ) {}

  eval(config: Config): number {
    const conditionValue = projectEvaluatedNode(this.condition, this.condition.eval(config))
    const selectedBranch: ConditionalBranch = conditionValue !== 0 ? 'consequent' : 'alternate'
    const selectedNode = selectedBranch === 'consequent' ? this.consequent : this.alternate
    const value = selectedNode.eval(config)

    this.evaluation = {
      conditionValue,
      selectedBranch,
      value,
      raw: rawValueFromEvaluatedNode(selectedNode, value),
    }

    return value
  }

  pure(): boolean {
    return this.condition.pure() && this.consequent.pure() && this.alternate.pure()
  }

  toString(indentation = 0): string {
    return `${safeToString(this.condition, indentation)} ? ${safeToString(this.consequent, indentation)} : ${safeToString(this.alternate, indentation)}`
  }
}

function safeToString(node: DiceNode, indentation: number): string {
  try {
    return node.toString(indentation)
  } catch {
    return node.range ? `<${node.range.start}:${node.range.end}>` : '<unevaluated>'
  }
}
function compareValues(operator: ComparisonOperator, left: number, right: number): boolean {
  switch (operator) {
    case '>':
      return left > right
    case '<':
      return left < right
    case '=':
      return left === right
  }
}

function evaluateBooleanOperator(operator: BooleanOperator, left: boolean, right: boolean): boolean {
  return operator === '&' ? left && right : left || right
}

function projectEvaluatedNode(node: DiceNode, fallback: number): number {
  const raw = rawFromEvaluation(node)
  return raw ? projectToNumber(raw, 'sum', node.range) : fallback
}

function rawValueFromEvaluatedNode(node: DiceNode, fallback: number): RollValue {
  if (tupleSourceKindFromNode(node) === 'tuple') return tupleValueFromNode(node, fallback)

  const raw = rawFromEvaluation(node)
  return raw ?? createScalarValue(fallback, 'projection')
}

function rawFromEvaluation(node: DiceNode): RollValue | null {
  const evaluation = (node as { evaluation?: unknown }).evaluation
  if (!evaluation || typeof evaluation !== 'object' || !('raw' in evaluation)) return null

  const raw = (evaluation as { raw?: RollValue }).raw
  return raw ?? null
}
