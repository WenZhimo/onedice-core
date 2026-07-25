import { describe, expect, it } from 'vitest'
import { dice, OneDiceError, OneDiceErrorCode } from '../../src'

function expectOneDiceError(fn: () => unknown, code: OneDiceErrorCode) {
  try {
    fn()
  } catch (error) {
    expect(error).toBeInstanceOf(OneDiceError)
    expect((error as OneDiceError).code).toBe(code)
    return error as OneDiceError
  }

  throw new Error(`Expected OneDiceError ${code}`)
}

describe('parser structured errors', () => {
  it('reports unexpected end with expected tokens and input range', () => {
    const error = expectOneDiceError(() => dice('1+'), 'PARSE_UNEXPECTED_END')

    expect(error.meta).toMatchObject({
      input: '1+',
      actual: '$',
      range: { start: 2, end: 2 },
    })
    expect(error.meta.expected).toEqual(expect.arrayContaining(['num', '(', 'd']))
  })

  it('reports unexpected tokens with token range', () => {
    const error = expectOneDiceError(() => dice('1)'), 'PARSE_UNEXPECTED_TOKEN')

    expect(error.meta).toMatchObject({
      input: '1)',
      actual: ')',
      range: { start: 1, end: 2 },
    })
    expect(error.meta.expected).toEqual(['$'])
  })

  it('reports known future syntax as unsupported syntax', () => {
    const error = expectOneDiceError(() => dice('1>2'), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      input: '1>2',
      operator: '>',
      actual: '>',
      range: { start: 1, end: 2 },
      feature: 'conditionals',
    })
  })

  it.each([
    ['2d20kh1', 'kh', 'tupleOperators', { start: 4, end: 6 }],
    ['2d20kl1', 'kl', 'tupleOperators', { start: 4, end: 6 }],
    ['2d20dh1', 'dh', 'tupleOperators', { start: 4, end: 6 }],
    ['2d20dl1', 'dl', 'tupleOperators', { start: 4, end: 6 }],
    ['5min6', 'min', 'clampOperators', { start: 1, end: 4 }],
    ['7max6', 'max', 'clampOperators', { start: 1, end: 4 }],
    ['3d100tp', 'tp', 'tupleProjection', { start: 5, end: 7 }],
    ['3d100sp1', 'sp', 'tupleSlice', { start: 5, end: 7 }],
    ['2lp1', 'lp', 'loopOperator', { start: 1, end: 3 }],
    ['4df', 'df', 'fateAlias', { start: 1, end: 3 }],
    ['$0e(2d6);$0', '$', 'program', { start: 0, end: 1 }],
    ['!1', '!', 'factorialOrNotOperator', { start: 0, end: 1 }],
    ['5!', '!', 'factorialOrNotOperator', { start: 1, end: 2 }],
    ['5?', '?', 'stepSumOperator', { start: 1, end: 2 }],
    ['(3d6>5)?2d8:1d4', '>', 'conditionals', { start: 4, end: 5 }],
    ['3=3', '=', 'conditionals', { start: 1, end: 2 }],
    ['{4d6,3d8}kh', '{}', 'fvttCompatibility', { start: 0, end: 9 }],
    ['{attack,bonus}kh', '{}', 'fvttCompatibility', { start: 0, end: 14 }],
    ['@abilities.str.mod', '@', 'fvttCompatibility', { start: 0, end: 1 }],
    ['@Actor[abc123]', '@Actor', 'fvttRuntimeBinding', { start: 0, end: 6 }],
    ['@Item[item123]', '@Item', 'fvttRuntimeBinding', { start: 0, end: 5 }],
    ['@UUID[Actor.abc123]', '@UUID', 'fvttRuntimeBinding', { start: 0, end: 5 }],
    ['@Compendium[world.spells.fireball]', '@Compendium', 'fvttRuntimeBinding', { start: 0, end: 11 }],
    ['/r 1d20', '/r', 'fvttRuntimeBinding', { start: 0, end: 2 }],
    ['/gmroll 1d20', '/gmroll', 'fvttRuntimeBinding', { start: 0, end: 7 }],
    ['/blindroll 1d20', '/blindroll', 'fvttRuntimeBinding', { start: 0, end: 10 }],
    ['1d20cs>15', 'cs', 'fvttSuccessCounting', { start: 4, end: 6 }],
    ['1d20cs', 'cs', 'fvttSuccessCounting', { start: 4, end: 6 }],
    ['1d6cf<3', 'cf', 'fvttFailureCounting', { start: 3, end: 5 }],
    ['1d6df1', 'df', 'fvttDeductFailures', { start: 3, end: 5 }],
    ['1d6sf<3', 'sf', 'fvttSubtractFailures', { start: 3, end: 5 }],
    ['1d6ms10', 'ms', 'fvttMarginOfSuccess', { start: 3, end: 5 }],
    ['1d6even', 'even', 'fvttParityCounting', { start: 3, end: 7 }],
    ['1d6odd', 'odd', 'fvttParityCounting', { start: 3, end: 6 }],
    ['1d6x6', 'x', 'fvttExplode', { start: 3, end: 4 }],
    ['1d6r<2', 'r', 'fvttReroll', { start: 3, end: 4 }],
  ])('rejects future syntax %s with a feature hint', (input, operator, feature, range) => {
    const error = expectOneDiceError(() => dice(input), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      input,
      operator,
      actual: operator,
      feature,
      featureEnabled: false,
      syntax: 'onedice',
      range,
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })

  it('parses enabled lp syntax far enough to report malformed loop bodies', () => {
    const error = expectOneDiceError(
      () => dice('2lp1', { features: { loopOperator: true } }),
      'PARSE_UNEXPECTED_TOKEN',
    )

    expect(error.meta).toMatchObject({
      input: '2lp1',
      actual: '1',
      range: { start: 3, end: 4 },
    })
    expect(error.meta.expected).toContain('[')
  })

  it('normalizes FVTT pools before reporting disabled tuple operators in compatibility mode', () => {
    const error = expectOneDiceError(
      () => dice('{4d6,3d8}kh', { syntax: 'fvtt-compatible' }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input: '{4d6,3d8}kh',
      operator: 'kh',
      feature: 'tupleOperators',
      featureEnabled: false,
      syntax: 'fvtt-compatible',
      range: { start: 9, end: 11 },
    })
  })

  it('does not reject existing V1 keep syntax while reserving kh and kl', () => {
    const [value] = dice('2d20k1', {
      random: () => 7,
    })

    expect(value).toBe(7)
  })

  it('does not mistake interpolation names starting with f for the df alias', () => {
    const error = expectOneDiceError(() => dice('1dfoo'), 'VARIABLE_NOT_FOUND')

    expect(error.meta.actual).not.toBe('df')
  })

  it('keeps comma-containing env keys as interpolation unless they use FVTT operators', () => {
    const [value] = dice('{attack,bonus}', {
      env: {
        'attack,bonus': '1',
      },
    })

    expect(value).toBe(1)
  })
})


