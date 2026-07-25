import { Config } from '..'
import { OneDiceError } from '../errors'
import { projectToNumber, TupleValue } from '../evaluation/value'
import { DiceNode } from '.'
import { TupleNode } from './tuple'
import { tupleSourceKindFromNode, tupleValueFromNode } from './tuple-selection'

export interface TupleSliceEvaluation {
  operator: 'sp'
  arity: 1 | 2 | 3
  inputLength: number
  sourceIndexes: number[]
  resultIndexes: number[]
  start: number
  end: number
  step: number
  leftBoundary?: number
  value: number
  raw: TupleValue
}

export class TupleSliceNode implements DiceNode<TupleSliceEvaluation> {
  evaluation: TupleSliceEvaluation
  range?: DiceNode['range']

  constructor(
    public left: DiceNode,
    public parameters: TupleNode,
  ) {}

  eval(config: Config): number {
    const leftValue = this.left.eval(config)
    if (tupleSourceKindFromNode(this.left) !== 'tuple') {
      throw new OneDiceError(
        'TUPLE_REQUIRED',
        'sp requires a tuple left value',
        {
          operator: 'sp',
          range: this.range,
          hint: 'Use sp only after an expression that exposes tuple raw values, such as a dice roll or tuple literal.',
        },
      )
    }

    this.parameters.eval(config)
    const tuple = tupleValueFromNode(this.left, leftValue)
    const parameterRanges = this.parameters.items.map(item => item.range)
    const params = this.parameters.evaluation.raw.items.map((item, index) => (
      projectToNumber(item, 'sum', parameterRanges[index])
    ))
    const arity = params.length
    if (arity !== 1 && arity !== 2 && arity !== 3) {
      throw new OneDiceError(
        'TUPLE_INVALID_SLICE_ARITY',
        'sp expects one, two, or three slice parameters',
        {
          operator: 'sp',
          actual: arity,
          expected: [1, 2, 3],
          range: (this.parameters as DiceNode).range,
          hint: 'Use sp[index], sp[start,end], or sp[leftBoundary,step,end].',
        },
      )
    }

    const inputLength = tuple.items.length
    const selection = selectIndexes(params, arity, inputLength, parameterRanges)
    const raw: TupleValue = {
      kind: 'tuple',
      items: selection.resultIndexes.map(index => tuple.items[index]),
      projection: 'sum',
      source: 'slice',
      operator: 'sp',
    }
    const value = projectToNumber(raw, 'sum', this.range)

    this.evaluation = {
      operator: 'sp',
      arity,
      inputLength,
      sourceIndexes: tuple.items.map((_, index) => index),
      resultIndexes: selection.resultIndexes,
      start: selection.start,
      end: selection.end,
      step: selection.step,
      ...(selection.leftBoundary !== undefined ? { leftBoundary: selection.leftBoundary } : {}),
      value,
      raw,
    }

    return value
  }

  pure(): boolean {
    return this.left.pure() && this.parameters.pure()
  }

  toString(indentation = 0): string {
    return `${this.left.toString(indentation)}sp${this.parameters.toString(indentation)}`
  }
}

interface SliceSelection {
  resultIndexes: number[]
  start: number
  end: number
  step: number
  leftBoundary?: number
}

function selectIndexes(
  params: number[],
  arity: 1 | 2 | 3,
  inputLength: number,
  parameterRanges: Array<DiceNode['range']>,
): SliceSelection {
  params.forEach((param, index) => validateIntegerParameter(param, index, parameterRanges[index]))

  if (arity === 1) {
    const index = params[0]
    validateVisibleIndex(index, inputLength, parameterRanges[0])
    return {
      resultIndexes: [index - 1],
      start: index,
      end: index,
      step: 1,
    }
  }

  if (arity === 2) {
    const [start, end] = params
    validateVisibleIndex(start, inputLength, parameterRanges[0])
    validateVisibleIndex(end, inputLength, parameterRanges[1])
    if (start > end) {
      throw new OneDiceError(
        'TUPLE_INVALID_SLICE_RANGE',
        'sp start cannot be greater than end',
        {
          operator: 'sp',
          start,
          end,
          ...rangeMeta(combineRanges(parameterRanges, 0, 1)),
          hint: 'Use a start index less than or equal to the end index.',
        },
      )
    }
    return {
      resultIndexes: range(start, end, 1),
      start,
      end,
      step: 1,
    }
  }

  const [leftBoundary, step, end] = params
  validateVisibleIndex(leftBoundary, inputLength, parameterRanges[0])
  validateVisibleIndex(end, inputLength, parameterRanges[2])
  if (step <= 0) {
    throw new OneDiceError(
      'TUPLE_INVALID_SLICE_STEP',
      'sp step must be greater than zero',
      {
        operator: 'sp',
        step,
        ...rangeMeta(parameterRanges[1]),
        hint: 'Use a positive integer step.',
      },
    )
  }

  const start = leftBoundary + 1
  const resultIndexes = start <= end ? range(start, end, step) : []
  if (resultIndexes.length === 0) {
    throw new OneDiceError(
      'TUPLE_EMPTY_PROJECTION',
      'sp selected no tuple items',
      {
        operator: 'sp',
        start,
        end,
        step,
        ...rangeMeta(combineRanges(parameterRanges, 0, 2)),
        hint: 'Choose slice parameters that select at least one tuple item.',
      },
    )
  }

  return {
    resultIndexes,
    start,
    end,
    step,
    leftBoundary,
  }
}

function validateIntegerParameter(value: number, index: number, range?: DiceNode['range']): void {
  if (!Number.isInteger(value)) {
    throw new OneDiceError(
      'TUPLE_INVALID_SLICE_INDEX',
      'sp parameters must be integers',
      {
        operator: 'sp',
        index,
        received: value,
        ...rangeMeta(range),
        hint: 'Use integer slice parameters.',
      },
    )
  }
}

function validateVisibleIndex(index: number, inputLength: number, range?: DiceNode['range']): void {
  if (index < 1) {
    throw new OneDiceError(
      'TUPLE_INVALID_SLICE_INDEX',
      'sp indexes are 1-based and must be greater than zero',
      {
        operator: 'sp',
        index,
        received: index,
        ...rangeMeta(range),
        hint: 'Use 1 for the first tuple item.',
      },
    )
  }

  if (index > inputLength) {
    throw new OneDiceError(
      'TUPLE_SLICE_OUT_OF_RANGE',
      'sp index is outside the tuple length',
      {
        operator: 'sp',
        index,
        limit: inputLength,
        ...rangeMeta(range),
        hint: `Use an index between 1 and ${inputLength}.`,
      },
    )
  }
}

function rangeMeta(range?: DiceNode['range']): { range?: DiceNode['range'] } {
  return range ? { range } : {}
}

function combineRanges(
  ranges: Array<DiceNode['range']>,
  startIndex: number,
  endIndex: number,
): DiceNode['range'] {
  const selected = ranges
    .slice(startIndex, endIndex + 1)
    .filter((range): range is NonNullable<DiceNode['range']> => Boolean(range))

  if (selected.length === 0) return undefined

  return {
    start: Math.min(...selected.map(range => range.start)),
    end: Math.max(...selected.map(range => range.end)),
  }
}

function range(start: number, end: number, step: number): number[] {
  const result: number[] = []
  for (let visibleIndex = start; visibleIndex <= end; visibleIndex += step) {
    result.push(visibleIndex - 1)
  }
  return result
}

