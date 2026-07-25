import { describe, expect, it } from 'vitest'
import { dice, OneDiceError, roll } from '../../src'
import { sequenceRandom } from '../helpers/random'

function expectOneDiceError(fn: () => unknown, code: string) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(OneDiceError)
    expect((error as OneDiceError).code).toBe(code)
    return error as OneDiceError
  }

  throw new Error(`Expected OneDiceError ${code}`)
}

const sliceFeatures = {
  tupleLiterals: true,
  tupleSlice: true,
}

describe('tuple slice operator', () => {
  it('rejects sp by default with a tupleSlice feature hint', () => {
    const error = expectOneDiceError(
      () => dice('3d100sp[1]', { features: { tupleLiterals: true } }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      operator: 'sp',
      feature: 'tupleSlice',
      featureEnabled: false,
      range: { start: 5, end: 7 },
    })
  })

  it('still requires tuple literal syntax for slice parameters', () => {
    const error = expectOneDiceError(
      () => dice('3d100sp[1]', { features: { tupleSlice: true } }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      operator: '[',
      feature: 'tupleLiterals',
      featureEnabled: false,
    })
  })

  it('slices a single 1-based tuple index', () => {
    const result = roll('[1,2,3,4,5,6]sp[2]', { features: sliceFeatures })

    expect(result.value).toBe(2)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      source: 'slice',
      projection: 'sum',
      operator: 'sp',
    })
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([2])
    expect(result.trace).toMatchObject({
      kind: 'tuple-slice',
      arity: 1,
      inputLength: 6,
      sourceIndexes: [0, 1, 2, 3, 4, 5],
      resultIndexes: [1],
      start: 2,
      end: 2,
      step: 1,
      items: [{ index: 0, value: 2 }],
      children: [{ kind: 'tuple' }, { kind: 'tuple' }],
    })
  })

  it('slices a 1-based inclusive range', () => {
    const result = roll('[1,2,3,4,5,6]sp[2,5]', { features: sliceFeatures })

    expect(result.value).toBe(14)
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([2, 3, 4, 5])
    expect(result.trace).toMatchObject({
      kind: 'tuple-slice',
      arity: 2,
      resultIndexes: [1, 2, 3, 4],
      start: 2,
      end: 5,
      step: 1,
    })
  })

  it('slices the upstream stepped range form', () => {
    const result = roll('[1,2,3,4,5,6]sp[1,2,5]', { features: sliceFeatures })

    expect(result.value).toBe(6)
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([2, 4])
    expect(result.trace).toMatchObject({
      kind: 'tuple-slice',
      arity: 3,
      leftBoundary: 1,
      resultIndexes: [1, 3],
      start: 2,
      end: 5,
      step: 2,
    })
  })

  it('slices ordinary dice roll tuples without changing random call order', () => {
    const result = roll('2d6sp[1,2]', {
      features: sliceFeatures,
      random: sequenceRandom([2, 5]),
    })

    expect(result.value).toBe(7)
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([2, 5])
    expect(result.trace).toMatchObject({
      kind: 'tuple-slice',
      resultIndexes: [0, 1],
      items: [
        { index: 0, value: 2, randomCall: 1, source: 'base' },
        { index: 1, value: 5, randomCall: 2, source: 'base' },
      ],
      children: [
        {
          kind: 'dice',
          rolls: [
            { index: 0, randomCall: 1, value: 2 },
            { index: 1, randomCall: 2, value: 5 },
          ],
        },
        { kind: 'tuple' },
      ],
    })
  })

  it('rejects scalar left values', () => {
    const error = expectOneDiceError(
      () => dice('5sp[1]', { features: sliceFeatures }),
      'TUPLE_REQUIRED',
    )

    expect(error.meta).toMatchObject({
      operator: 'sp',
      range: { start: 0, end: 6 },
    })
  })

  it.each([
    ['[1,2,3]sp[0]', 'TUPLE_INVALID_SLICE_INDEX', { index: 0, received: 0, range: { start: 10, end: 11 } }],
    ['[1,2,3]sp[-1]', 'TUPLE_INVALID_SLICE_INDEX', { index: -1, received: -1, range: { start: 10, end: 12 } }],
    ['[1,2,3]sp[1.5]', 'TUPLE_INVALID_SLICE_INDEX', { index: 0, received: 1.5, range: { start: 10, end: 13 } }],
    ['[1,2,3]sp[4]', 'TUPLE_SLICE_OUT_OF_RANGE', { index: 4, limit: 3, range: { start: 10, end: 11 } }],
    ['[1,2,3]sp[3,2]', 'TUPLE_INVALID_SLICE_RANGE', { start: 3, end: 2, range: { start: 10, end: 13 } }],
    ['[1,2,3]sp[1,0,3]', 'TUPLE_INVALID_SLICE_STEP', { step: 0, range: { start: 12, end: 13 } }],
    ['[1,2,3]sp[3,1,3]', 'TUPLE_EMPTY_PROJECTION', { start: 4, end: 3, step: 1, range: { start: 10, end: 15 } }],
    ['[1,2,3]sp[1,2,3,4]', 'TUPLE_INVALID_SLICE_ARITY', { actual: 4, expected: [1, 2, 3], range: { start: 9, end: 18 } }],
  ])('rejects invalid slice expression %s', (input, code, meta) => {
    const error = expectOneDiceError(
      () => dice(input, { features: sliceFeatures }),
      code,
    )

    expect(error.meta).toMatchObject({ operator: 'sp', ...meta })
  })
})
