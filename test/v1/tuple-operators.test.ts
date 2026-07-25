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

const tupleFeatures = {
  tupleLiterals: true,
  tupleOperators: true,
}

describe('tuple keep/drop operators', () => {
  it('keeps the highest explicit tuple item with kh', () => {
    const result = roll('[2,7,4]kh1', { features: tupleFeatures })

    expect(result.value).toBe(7)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      source: 'operator',
      projection: 'sum',
      operator: 'kh',
      selected: [false, true, false],
      dropped: [true, false, true],
    })
    expect(result.trace).toMatchObject({
      kind: 'tuple-selection',
      operator: 'kh',
      count: 1,
      inputLength: 3,
      selectedIndexes: [1],
      droppedIndexes: [0, 2],
      value: 7,
      range: { start: 0, end: 10 },
    })
  })

  it('supports default count and stable tie-breaking for kl', () => {
    const result = roll('[5,5,3]kl', { features: tupleFeatures })

    expect(result.value).toBe(3)
    expect(result.trace).toMatchObject({
      kind: 'tuple-selection',
      operator: 'kl',
      count: 1,
      selectedIndexes: [2],
      droppedIndexes: [0, 1],
    })
  })

  it('drops highest and lowest tuple items', () => {
    expect(dice('[2,7,4]dh1', { features: tupleFeatures })[0]).toBe(6)
    expect(dice('[2,7,4]dl1', { features: tupleFeatures })[0]).toBe(11)
  })

  it('operates on dice roll tuples without changing scalar dice consumption', () => {
    const selected = roll('2d20kh1', {
      features: { tupleOperators: true },
      random: sequenceRandom([7, 19]),
    })
    const scalar = roll('2d20+1', {
      features: { tupleOperators: true },
      random: sequenceRandom([7, 19]),
    })

    expect(selected.value).toBe(19)
    expect(selected.raw).toMatchObject({
      kind: 'tuple',
      selected: [false, true],
      dropped: [true, false],
    })
    expect(selected.trace).toMatchObject({
      kind: 'tuple-selection',
      operator: 'kh',
      selectedIndexes: [1],
      droppedIndexes: [0],
      children: [
        {
          kind: 'dice',
          rolls: [
            { index: 0, randomCall: 1, value: 7 },
            { index: 1, randomCall: 2, value: 19 },
          ],
        },
      ],
    })
    expect(scalar.value).toBe(27)
    expect(scalar.trace).toMatchObject({ kind: 'binary', operator: '+' })
  })

  it('rejects tuple selection counts outside the tuple length', () => {
    const error = expectOneDiceError(
      () => dice('2d20kh3', {
        features: { tupleOperators: true },
        random: sequenceRandom([7, 19]),
      }),
      'DICE_INVALID_KEEP_COUNT',
    )

    expect(error.meta).toMatchObject({
      operator: 'kh',
      actual: 3,
      limit: 2,
      range: { start: 6, end: 7 },
    })
  })
})
