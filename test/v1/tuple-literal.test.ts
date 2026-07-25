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

describe('tuple literals', () => {
  it('rejects tuple syntax by default', () => {
    const error = expectOneDiceError(() => dice('[1,2,3]'), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      input: '[1,2,3]',
      operator: '[',
      feature: 'tupleLiterals',
      featureEnabled: false,
      syntax: 'onedice',
      range: { start: 0, end: 1 },
    })
  })

  it('rejects stray tuple separators by default', () => {
    const error = expectOneDiceError(() => dice('1,2'), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      input: '1,2',
      operator: ',',
      feature: 'tupleLiterals',
      featureEnabled: false,
      syntax: 'onedice',
      range: { start: 1, end: 2 },
    })
  })

  it('evaluates grouped expressions inside tuple literals', () => {
    const [value, root] = dice('[1,(2+3),4]', {
      features: { tupleLiterals: true },
    })

    expect(value).toBe(4)
    expect(root.toString()).toBe('[1,(2 + 3),4]')
  })

  it('shares the random budget with dice inside tuple literals', () => {
    const result = roll('[1,2d6,3]', {
      features: { tupleLiterals: true },
      random: sequenceRandom([5, 2]),
    })

    expect(result.value).toBe(3)
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([1, 7, 3])
    expect(result.trace).toMatchObject({
      kind: 'tuple',
      items: [
        { kind: 'number', value: 1 },
        {
          kind: 'dice',
          value: 7,
          rolls: [
            { index: 0, randomCall: 1, value: 5 },
            { index: 1, randomCall: 2, value: 2 },
          ],
        },
        { kind: 'number', value: 3 },
      ],
    })
  })
  it('projects tuple literals to the last item for the legacy dice API', () => {
    const [value, root] = dice('[1,2,3]', {
      features: { tupleLiterals: true },
    })

    expect(value).toBe(3)
    expect(root.toString()).toBe('[1,2,3]')
  })

  it('preserves tuple raw values and trace for roll()', () => {
    const result = roll('[1,2,3]', {
      features: { tupleLiterals: true },
    })

    expect(result.value).toBe(3)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      projection: 'last',
      source: 'literal',
    })
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([1, 2, 3])
    expect(result.trace).toMatchObject({
      kind: 'tuple',
      expression: '[1,2,3]',
      value: 3,
      projection: 'last',
      range: { start: 0, end: 7 },
    })
    expect(result.trace.kind === 'tuple' && result.trace.items.map(item => item.value)).toEqual([1, 2, 3])
  })
}
)
