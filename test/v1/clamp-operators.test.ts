import { describe, expect, it } from 'vitest'
import { dice, roll } from '../../src'
import { sequenceRandom } from '../helpers/random'

describe('min/max clamp operators', () => {
  it('uses OneDice clamp semantics for scalar values', () => {
    const features = { clampOperators: true }

    expect(dice('5min6', { features })[0]).toBe(6)
    expect(dice('7min6', { features })[0]).toBe(7)
    expect(dice('5max6', { features })[0]).toBe(5)
    expect(dice('7max6', { features })[0]).toBe(6)
  })

  it('clamps explicit tuples item by item', () => {
    const result = roll('[7,4]max5', {
      features: {
        tupleLiterals: true,
        clampOperators: true,
      },
    })

    expect(result.value).toBe(9)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      source: 'operator',
      projection: 'sum',
      operator: 'max',
    })
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([5, 4])
    expect(result.trace).toMatchObject({
      kind: 'clamp',
      operator: 'max',
      limit: 5,
      before: [7, 4],
      after: [5, 4],
      value: 9,
      children: [
        { kind: 'tuple' },
        { kind: 'number', value: 5 },
      ],
    })
  })

  it('clamps ordinary dice roll tuples without changing random call order', () => {
    const result = roll('2d6min5', {
      features: { clampOperators: true },
      random: sequenceRandom([2, 6]),
    })

    expect(result.value).toBe(11)
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([5, 6])
    expect(result.trace).toMatchObject({
      kind: 'clamp',
      operator: 'min',
      limit: 5,
      before: [2, 6],
      after: [5, 6],
      children: [
        {
          kind: 'dice',
          rolls: [
            { index: 0, randomCall: 1, value: 2 },
            { index: 1, randomCall: 2, value: 6 },
          ],
        },
        { kind: 'number', value: 5 },
      ],
    })
  })
})
