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

describe('tuple projection operator', () => {
  it('rejects tp by default with a tupleProjection feature hint', () => {
    const error = expectOneDiceError(() => dice('3d100tp'), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      operator: 'tp',
      feature: 'tupleProjection',
      featureEnabled: false,
      range: { start: 5, end: 7 },
    })
  })

  it('exposes ordinary dice roll tuples without re-rolling the left side', () => {
    let calls = 0
    const values = [10, 20, 30]
    const result = roll('3d100tp', {
      features: { tupleProjection: true },
      random: (min, max) => {
        const value = values[calls++]
        expect(value).toBeGreaterThanOrEqual(min)
        expect(value).toBeLessThanOrEqual(max)
        return value
      },
    })

    expect(calls).toBe(3)
    expect(result.value).toBe(60)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      source: 'operator',
      projection: 'sum',
      operator: 'tp',
    })
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([10, 20, 30])
    expect(result.trace).toMatchObject({
      kind: 'tuple-projection',
      operator: 'tp',
      value: 60,
      projection: 'sum',
      sourceKind: 'tuple',
      sourceRange: { start: 0, end: 5 },
      itemCount: 3,
      items: [
        { index: 0, value: 10, randomCall: 1, source: 'base' },
        { index: 1, value: 20, randomCall: 2, source: 'base' },
        { index: 2, value: 30, randomCall: 3, source: 'base' },
      ],
      children: [
        {
          kind: 'dice',
          rolls: [
            { index: 0, randomCall: 1, value: 10 },
            { index: 1, randomCall: 2, value: 20 },
            { index: 2, randomCall: 3, value: 30 },
          ],
        },
      ],
    })
  })

  it('keeps the old dice API numeric by projecting tp tuples to a sum', () => {
    const [value] = dice('3d100tp', {
      features: { tupleProjection: true },
      random: sequenceRandom([10, 20, 30]),
    })

    expect(value).toBe(60)
  })

  it('projects explicit tuple literals as tuple raw with sum-compatible numeric value', () => {
    const result = roll('[1,2,3]tp', {
      features: {
        tupleLiterals: true,
        tupleProjection: true,
      },
    })

    expect(result.value).toBe(6)
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([1, 2, 3])
    expect(result.trace).toMatchObject({
      kind: 'tuple-projection',
      sourceKind: 'tuple',
      itemCount: 3,
      children: [{ kind: 'tuple' }],
    })
  })

  it('wraps scalar left values as single-item tuples', () => {
    const result = roll('5tp', {
      features: { tupleProjection: true },
    })

    expect(result.value).toBe(5)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      source: 'operator',
      projection: 'sum',
      operator: 'tp',
    })
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([5])
    expect(result.trace).toMatchObject({
      kind: 'tuple-projection',
      sourceKind: 'scalar',
      itemCount: 1,
    })
  })

  it('preserves tuple selection metadata when projecting an existing tuple result', () => {
    const result = roll('[2,7,4]kh1tp', {
      features: {
        tupleLiterals: true,
        tupleOperators: true,
        tupleProjection: true,
      },
    })

    expect(result.value).toBe(7)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      selected: [false, true, false],
      dropped: [true, false, true],
    })
    expect(result.trace).toMatchObject({
      kind: 'tuple-projection',
      items: [
        { index: 0, value: 2, selected: false, dropped: true },
        { index: 1, value: 7, selected: true, dropped: false },
        { index: 2, value: 4, selected: false, dropped: true },
      ],
      children: [{ kind: 'tuple-selection' }],
    })
  })
})
