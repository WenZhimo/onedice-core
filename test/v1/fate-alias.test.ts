import { describe, expect, it } from 'vitest'
import { dice, OneDiceError, roll } from '../../src'
import { sequenceRandom } from '../helpers/random'

describe('FATE df alias', () => {
  it('keeps df rejected by default', () => {
    try {
      dice('4df')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('PARSE_UNSUPPORTED_SYNTAX')
      expect((error as OneDiceError).meta).toMatchObject({
        operator: 'df',
        feature: 'fateAlias',
        featureEnabled: false,
        range: { start: 1, end: 3 },
      })
      return
    }

    throw new Error('Expected df to be rejected by default')
  })

  it('normalizes df to f when fateAlias is enabled', () => {
    const result = roll('4df', {
      features: { fateAlias: true },
      random: sequenceRandom([0, 1, 2, 0]),
    })

    expect(result.value).toBe(1)
    expect(result.trace).toMatchObject({
      kind: 'fate',
      operator: 'f',
      expression: '4f3',
      range: { start: 0, end: 3 },
      rolls: [
        { index: 0, randomCall: 1, value: 1 },
        { index: 1, randomCall: 2, value: -1 },
        { index: 2, randomCall: 3, value: 0 },
        { index: 3, randomCall: 4, value: 1 },
      ],
    })
    expect(result.diagnostics).toEqual([
      {
        code: 'SYNTAX_NORMALIZED',
        severity: 'info',
        message: 'Normalized df FATE alias to f.',
        range: { start: 1, end: 3 },
        feature: 'fateAlias',
        original: 'df',
        normalized: 'f',
      },
    ])
  })

  it('does not normalize df inside longer identifiers when fateAlias is enabled', () => {
    expect(() => dice('1dfoo', { features: { fateAlias: true } })).toThrow()
  })

  it('keeps df equivalent to f for dice() callers when enabled', () => {
    const [value] = dice('df', {
      features: { fateAlias: true },
      random: sequenceRandom([0, 1, 2, 0]),
    })

    expect(value).toBe(1)
  })
})
