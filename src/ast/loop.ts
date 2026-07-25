import { Config } from '..'
import { DiceNode } from '.'
import {
  consumeEvaluationStep,
  enterLoop,
  exitLoop,
  getEvaluationContext,
  reserveLoopIterations,
} from '../evaluation/context'
import { createScalarValue, projectToNumber, RollValue, TupleValue } from '../evaluation/value'
import { OneDiceError } from '../errors'
import { createTrace, RollTrace } from '../trace'
import { TupleNode } from './tuple'
import { tupleSourceKindFromNode, tupleValueFromNode } from './tuple-selection'

export interface LoopBounds {
  start: number
  end: number
  step: number
  count: number
  source: 'scalar' | 'tuple'
}

export interface LoopIterationEvaluation {
  index: number
  variable: 'i'
  value: number
  body: RollTrace
  raw: RollValue
}

export interface LoopEvaluation {
  operator: 'lp'
  bounds: LoopBounds
  value: number
  raw: TupleValue
  iterations: LoopIterationEvaluation[]
}

interface StoredLoopVariable {
  name: 'i'
  raw: RollValue
  value: number
  assignedAtStatement: number
}

export class LoopNode implements DiceNode<LoopEvaluation> {
  evaluation: LoopEvaluation
  range?: DiceNode['range']

  constructor(
    public bounds: DiceNode,
    public body: TupleNode,
  ) {}

  eval(config: Config): number {
    const context = getEvaluationContext(config)
    if (!context) {
      throw new OneDiceError(
        'EVALUATION_BUDGET_EXCEEDED',
        'lp requires a shared evaluation context',
        {
          operator: 'lp',
          budgetKind: 'evaluationSteps',
          hint: 'Evaluate lp through dice() or roll() so a shared EvaluationContext is attached.',
        },
      )
    }

    const boundsValue = this.bounds.eval(config)
    const loopBounds = normalizeLoopBounds(this.bounds, boundsValue, this.bounds.range)

    enterLoop(context, this.range)
    try {
      reserveLoopIterations(context, loopBounds.count, this.range)

      const previousI = context.variables.get('i')
      const hadPreviousI = previousI !== undefined
      const previousIReadonly = context.variables.isReadonly('i')
      const items: RollValue[] = []
      const iterations: LoopIterationEvaluation[] = []
      const values = loopValues(loopBounds)

      try {
        values.forEach((i, index) => {
          consumeEvaluationStep(context, 'lp', this.body.range)
          context.variables.set('i', createLoopVariable(i), { readonly: true, force: true })
          this.body.eval(config)
          const bodyRaw = this.body.evaluation.raw
          items.push(...bodyRaw.items)
          iterations.push({
            index,
            variable: 'i',
            value: i,
            body: createTrace(this.body),
            raw: bodyRaw,
          })
        })
      } finally {
        if (hadPreviousI) {
          context.variables.set('i', previousI, {
            force: true,
            ...(previousIReadonly ? { readonly: true } : {}),
          })
        } else {
          context.variables.delete('i', { force: true })
        }
      }

      const raw: TupleValue = {
        kind: 'tuple',
        items,
        projection: 'sum',
        source: 'loop',
        operator: 'lp',
      }
      const value = projectToNumber(raw, 'sum', this.range)

      this.evaluation = {
        operator: 'lp',
        bounds: loopBounds,
        value,
        raw,
        iterations,
      }

      return value
    } finally {
      exitLoop(context)
    }
  }

  pure(): boolean {
    return this.bounds.pure() && this.body.pure()
  }

  toString(indentation = 0): string {
    return `${this.bounds.toString(indentation)}lp${this.body.toString(indentation)}`
  }
}

export function normalizeLoopBounds(
  node: DiceNode,
  value: number,
  range?: DiceNode['range'],
): LoopBounds {
  const params = tupleSourceKindFromNode(node) === 'tuple'
    ? tupleValueFromNode(node, value).items.map(item => projectToNumber(item, 'sum', range))
    : [value]
  const source: LoopBounds['source'] = tupleSourceKindFromNode(node) === 'tuple' ? 'tuple' : 'scalar'
  const arity = params.length

  if (arity !== 1 && arity !== 2 && arity !== 3) {
    throw new OneDiceError(
      'LOOP_INVALID_BOUNDS_ARITY',
      'lp expects one, two, or three loop boundary values',
      {
        operator: 'lp',
        actual: arity,
        expected: [1, 2, 3],
        ...(range ? { range } : {}),
        hint: 'Use Nlp[body], [start,end]lp[body], or [leftBoundary,step,end]lp[body].',
      },
    )
  }

  params.forEach((param, index) => validateIntegerBoundary(param, index, range))

  if (arity === 1) {
    const end = params[0]
    return validateLoopBounds({ start: 1, end, step: 1, source }, range)
  }

  if (arity === 2) {
    const [start, end] = params
    return validateLoopBounds({ start, end, step: 1, source }, range)
  }

  const [leftBoundary, step, end] = params
  if (step <= 0) {
    throw new OneDiceError(
      'LOOP_INVALID_STEP',
      'lp step must be greater than zero',
      {
        operator: 'lp',
        step,
        ...(range ? { range } : {}),
        hint: 'Use a positive integer loop step.',
      },
    )
  }

  return validateLoopBounds({ start: leftBoundary + step, end, step, source }, range)
}

function validateIntegerBoundary(value: number, index: number, range?: DiceNode['range']): void {
  if (!Number.isInteger(value)) {
    throw new OneDiceError(
      'LOOP_INVALID_BOUND',
      'lp boundaries must be integers',
      {
        operator: 'lp',
        index,
        received: value,
        ...(range ? { range } : {}),
        hint: 'Use integer loop boundary values.',
      },
    )
  }
}

function validateLoopBounds(
  bounds: Omit<LoopBounds, 'count'>,
  range?: DiceNode['range'],
): LoopBounds {
  if (bounds.step <= 0) {
    throw new OneDiceError(
      'LOOP_INVALID_STEP',
      'lp step must be greater than zero',
      {
        operator: 'lp',
        step: bounds.step,
        ...(range ? { range } : {}),
        hint: 'Use a positive integer loop step.',
      },
    )
  }

  if (bounds.start > bounds.end) {
    throw new OneDiceError(
      'LOOP_INVALID_RANGE',
      'lp start cannot be greater than end',
      {
        operator: 'lp',
        start: bounds.start,
        end: bounds.end,
        step: bounds.step,
        ...(range ? { range } : {}),
        hint: 'Use loop bounds that produce at least one iteration.',
      },
    )
  }

  return {
    ...bounds,
    count: Math.floor((bounds.end - bounds.start) / bounds.step) + 1,
  }
}

function loopValues(bounds: LoopBounds): number[] {
  const values: number[] = []
  for (let value = bounds.start; value <= bounds.end; value += bounds.step) {
    values.push(value)
  }
  return values
}

function createLoopVariable(value: number): StoredLoopVariable {
  return {
    name: 'i',
    raw: createScalarValue(value, 'operator'),
    value,
    assignedAtStatement: -1,
  }
}

