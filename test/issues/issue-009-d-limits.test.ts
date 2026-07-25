import { describe, expect, it } from 'vitest'
import { dice, OneDiceError } from '../../src'
import { constantRandom, sequenceRandom } from '../helpers/random'

function expectRandomBudgetExceeded(
  fn: () => unknown,
  actual: number,
  limit: number,
  range?: { start: number; end: number },
) {
  try {
    fn()
    throw new Error('Expected random budget to be exceeded')
  } catch (error) {
    expect(error).toBeInstanceOf(OneDiceError)
    expect((error as OneDiceError).code).toBe('EVALUATION_BUDGET_EXCEEDED')
    expect((error as OneDiceError).meta).toMatchObject({
      budgetKind: 'randomCalls',
      actual,
      limit,
      ...(range ? { range } : {}),
    })
  }
}

describe('issue #9: d operands support limits up to 10000', () => {
  it('allows a face count of 10000', () => {
    const [value] = dice('1d10000', {
      random: sequenceRandom([9999]),
    })

    expect(value).toBe(9999)
  })

  it('allows rolling 10000 dice when maxRollCount is 10000', () => {
    const [value] = dice('10000d1', {
      random: constantRandom(1),
    })

    expect(value).toBe(10000)
  })

  it('rejects dice counts above 10000 as a semantic operand limit even when maxRollCount is higher', () => {
    try {
      dice('10001d1', {
        random: constantRandom(1),
        maxRollCount: 20000,
      })
      throw new Error('Expected dice count limit to be enforced')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('DICE_INVALID_DICE_COUNT')
      expect((error as OneDiceError).meta).toMatchObject({
        operator: 'd',
        actual: 10001,
        limit: 10000,
      })
    }
  })

  it('keeps legacy maxRollCount as the random budget when maxRandomCalls is absent', () => {
    try {
      dice('2d1', {
        random: constantRandom(1),
        maxRollCount: 1,
      })
      throw new Error('Expected legacy maxRollCount to be enforced')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('DICE_TOO_MANY_ROLLS')
      expect((error as OneDiceError).meta).toMatchObject({
        operator: 'd',
        actual: 2,
        limit: 1,
      })
    }
  })

  it('treats maxRandomCalls as the runtime budget without changing the 10000 semantic limit', () => {
    try {
      dice('2d1', {
        random: constantRandom(1),
        maxRollCount: 10000,
        maxRandomCalls: 1,
      })
      throw new Error('Expected random budget to be exceeded')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('EVALUATION_BUDGET_EXCEEDED')
      expect((error as OneDiceError).meta).toMatchObject({
        budgetKind: 'randomCalls',
        actual: 2,
        limit: 1,
        range: { start: 0, end: 3 },
      })
    }
  })

  it('lets maxRandomCalls take precedence over maxRollCount when both are provided', () => {
    try {
      dice('2d1', {
        random: constantRandom(1),
        maxRollCount: 10000,
        maxRandomCalls: 1,
      })
      throw new Error('Expected maxRandomCalls to take precedence')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('EVALUATION_BUDGET_EXCEEDED')
      expect((error as OneDiceError).meta.limit).toBe(1)
    }
  })

  it('lets a higher maxRandomCalls override a lower legacy maxRollCount', () => {
    const [value] = dice('2d1', {
      random: constantRandom(1),
      maxRollCount: 1,
      maxRandomCalls: 2,
    })

    expect(value).toBe(2)
  })

  it('reports the explicit maxRandomCalls budget when it is exceeded despite a lower legacy maxRollCount', () => {
    expectRandomBudgetExceeded(() => dice('3d1', {
      random: constantRandom(1),
      maxRollCount: 1,
      maxRandomCalls: 2,
    }), 3, 2, { start: 0, end: 3 })
  })

  it('applies explicit maxRandomCalls to percentile and fate dice instead of the legacy precheck', () => {
    expectRandomBudgetExceeded(() => dice('p1', {
      random: sequenceRandom([0, 0]),
      maxRollCount: 10000,
      maxRandomCalls: 2,
    }), 3, 2, { start: 0, end: 2 })

    expectRandomBudgetExceeded(() => dice('3f', {
      random: sequenceRandom([0, 1]),
      maxRollCount: 10000,
      maxRandomCalls: 2,
    }), 3, 2, { start: 0, end: 2 })
  })

  it('reports original d-expression range when generated bonus or penalty dice exceed maxRandomCalls', () => {
    expectRandomBudgetExceeded(() => dice('2d6p1', {
      random: sequenceRandom([0, 0]),
      maxRollCount: 10000,
      maxRandomCalls: 2,
    }), 3, 2, { start: 0, end: 5 })
  })

  it('lets explicit maxRandomCalls override low legacy maxRollCount for percentile and fate dice', () => {
    const [percentile] = dice('b0', {
      random: sequenceRandom([0, 1]),
      maxRollCount: 1,
      maxRandomCalls: 2,
    })
    const [fate] = dice('2f', {
      random: sequenceRandom([0, 2]),
      maxRollCount: 1,
      maxRandomCalls: 2,
    })

    expect(percentile).toBe(10)
    expect(fate).toBe(1)
  })

  it('lets explicit maxRandomCalls above the default legacy limit drive percentile and fate dice', () => {
    const [percentile] = dice('p9999', {
      random: constantRandom(0),
      maxRandomCalls: 10001,
    })
    const [fate] = dice('10001f', {
      random: constantRandom(0),
      maxRandomCalls: 10001,
    })

    expect(percentile).toBe(100)
    expect(fate).toBe(10001)
  })

  it('applies explicit maxRandomCalls to exploding pool dice instead of the legacy precheck', () => {
    expectRandomBudgetExceeded(() => dice('1a2m2', {
      random: sequenceRandom([2]),
      maxRollCount: 10000,
      maxRandomCalls: 1,
    }), 2, 1, { start: 0, end: 5 })

    expectRandomBudgetExceeded(() => dice('1c2m2', {
      random: sequenceRandom([2]),
      maxRollCount: 10000,
      maxRandomCalls: 1,
    }), 2, 1, { start: 0, end: 5 })
  })

  it('lets explicit maxRandomCalls override low legacy maxRollCount for pool dice prechecks', () => {
    const [aPool] = dice('2a2m2', {
      random: sequenceRandom([1, 1]),
      maxRollCount: 1,
      maxRandomCalls: 2,
    })
    const [cPool] = dice('2c2m2', {
      random: sequenceRandom([1, 1]),
      maxRollCount: 1,
      maxRandomCalls: 2,
    })

    expect(aPool).toBe(0)
    expect(cPool).toBe(1)
  })

  it('lets explicit maxRandomCalls above the default legacy limit drive pool dice', () => {
    const [aPool] = dice('10001a2m2', {
      random: constantRandom(1),
      maxRandomCalls: 10001,
    })
    const [cPool] = dice('10001c2m2', {
      random: constantRandom(1),
      maxRandomCalls: 10001,
    })

    expect(aPool).toBe(0)
    expect(cPool).toBe(1)
  })

  it('rejects face counts below one', () => {
    expect(() => dice('1d0', {
      random: sequenceRandom([]),
    })).toThrow()
  })

  it('rejects face counts above 10000 as a semantic operand limit', () => {
    try {
      dice('1d10001', {
        random: constantRandom(1),
        maxRandomCalls: 10000,
      })
      throw new Error('Expected face count limit to be enforced')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('DICE_INVALID_FACE_COUNT')
      expect((error as OneDiceError).meta).toMatchObject({
        operator: 'd',
        actual: 10001,
        limit: 10000,
      })
    }
  })
})
