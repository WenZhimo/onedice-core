import { describe, expect, it } from 'vitest'
import { createScalarValue, OneDiceError, OneDiceErrorCode, roll } from '../../src'
import { sequenceRandom } from '../helpers/random'

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

describe('FVTT-compatible @path variables', () => {
  it('reads @path values from env in FVTT-compatible syntax mode', () => {
    const result = roll('@abilities.str.mod + 1', {
      syntax: 'fvtt-compatible',
      env: {
        'abilities.str.mod': '3',
      },
    })

    expect(result.value).toBe(4)
    expect(result.trace).toMatchObject({
      kind: 'binary',
      operator: '+',
      left: 3,
      right: 1,
    })
    expect(result.trace.kind).toBe('binary')
    if (result.trace.kind === 'binary') {
      expect(result.trace.children[0]).toMatchObject({
        kind: 'variable',
        name: '@abilities.str.mod',
        value: 3,
        range: { start: 0, end: 18 },
      })
    }
  })

  it('throws VARIABLE_NOT_FOUND for missing @path values', () => {
    const error = expectOneDiceError(
      () => roll('@missing + 1', { syntax: 'fvtt-compatible' }),
      'VARIABLE_NOT_FOUND',
    )

    expect(error.meta).toMatchObject({
      actual: '@missing',
      variable: 'missing',
      availableVariables: [],
      range: { start: 0, end: 8 },
    })
  })

  it('accepts numeric env values for @path variables', () => {
    const result = roll('@abilities.dex.mod + 2', {
      syntax: 'fvtt-compatible',
      env: {
        'abilities.dex.mod': 4,
      },
    })

    expect(result.value).toBe(6)
  })

  it('uses resolver values before env fallback for @path variables', () => {
    const calls: Array<{ path: string; originalInput: string; range?: { start: number; end: number } }> = []
    const result = roll('@abilities.str.mod + 1', {
      syntax: 'fvtt-compatible',
      env: {
        'abilities.str.mod': 1,
      },
      resolver(path, context) {
        calls.push({
          path,
          originalInput: context.originalInput,
          range: context.range,
        })
        return 5
      },
    })

    expect(result.value).toBe(6)
    expect(calls).toEqual([
      {
        path: 'abilities.str.mod',
        originalInput: '@abilities.str.mod + 1',
        range: { start: 0, end: 18 },
      },
    ])
    expect(result.trace.kind === 'binary' && result.trace.children[0]).toMatchObject({
      kind: 'variable',
      value: 5,
    })
  })

  it('falls back to env when resolver returns undefined', () => {
    const result = roll('@abilities.dex.mod + 2', {
      syntax: 'fvtt-compatible',
      env: {
        'abilities.dex.mod': 4,
      },
      resolver: () => undefined,
    })

    expect(result.value).toBe(6)
  })

  it('accepts RollValue results from the resolver without reusing mutable references', () => {
    const raw = {
      kind: 'tuple' as const,
      items: [
        createScalarValue(2, 'literal'),
        createScalarValue(3, 'literal'),
      ],
      projection: 'sum' as const,
      source: 'operator' as const,
    }
    const result = roll('@actor.pool + 1', {
      syntax: 'fvtt-compatible',
      resolver: () => raw,
    })

    expect(result.value).toBe(6)
    expect(result.trace.kind === 'binary' && result.trace.children[0]).toMatchObject({
      kind: 'variable',
      value: 5,
      raw: {
        kind: 'tuple',
        items: [
          { kind: 'scalar', value: 2 },
          { kind: 'scalar', value: 3 },
        ],
      },
    })
    expect(result.trace.kind === 'binary' && result.trace.children[0].kind === 'variable'
      ? result.trace.children[0].raw
      : null).not.toBe(raw)
  })

  it('reports the @path range when resolver RollValue cannot be projected', () => {
    const error = expectOneDiceError(
      () => roll('@actor.pool + 1', {
        syntax: 'fvtt-compatible',
        resolver: () => ({
          kind: 'tuple' as const,
          items: [createScalarValue(2, 'literal')],
          projection: 'identity' as const,
          source: 'operator' as const,
        }),
      }),
      'TUPLE_CANNOT_PROJECT',
    )

    expect(error.meta).toMatchObject({
      operator: 'identity',
      range: { start: 0, end: 11 },
    })
  })

  it.each([
    ['@Actor[abc123]', '@Actor', { start: 0, end: 6 }],
    ['@Item[item123]', '@Item', { start: 0, end: 5 }],
    ['@UUID[Actor.abc123]', '@UUID', { start: 0, end: 5 }],
    ['@Compendium[world.spells.fireball]', '@Compendium', { start: 0, end: 11 }],
  ])('rejects Foundry document binding %s without calling resolver', (input, operator, range) => {
    const calls: string[] = []
    const error = expectOneDiceError(
      () => roll(`${input} + 1`, {
        syntax: 'fvtt-compatible',
        resolver(path) {
          calls.push(path)
          return 1
        },
      }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(calls).toEqual([])
    expect(error.meta).toMatchObject({
      input: `${input} + 1`,
      operator,
      actual: operator,
      feature: 'fvttRuntimeBinding',
      featureEnabled: false,
      syntax: 'fvtt-compatible',
      range,
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })

  it.each([
    ['@Actor[abc123]', '@Actor', { start: 0, end: 6 }],
    ['@Item[item123]', '@Item', { start: 0, end: 5 }],
    ['@UUID[Actor.abc123]', '@UUID', { start: 0, end: 5 }],
    ['@Compendium[world.spells.fireball]', '@Compendium', { start: 0, end: 11 }],
  ])('rejects Foundry document binding %s in default OneDice syntax', (input, operator, range) => {
    const error = expectOneDiceError(
      () => roll(`${input} + 1`),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input: `${input} + 1`,
      operator,
      actual: operator,
      feature: 'fvttRuntimeBinding',
      featureEnabled: false,
      syntax: 'onedice',
      range,
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })

  it('wraps resolver failures in VARIABLE_RESOLVER_FAILED', () => {
    const error = expectOneDiceError(
      () => roll('@broken.path + 1', {
        syntax: 'fvtt-compatible',
        resolver() {
          throw new Error('resolver boom')
        },
      }),
      'VARIABLE_RESOLVER_FAILED',
    )

    expect(error.meta).toMatchObject({
      actual: 'resolver boom',
      variable: 'broken.path',
      range: { start: 0, end: 12 },
    })
  })

  it('throws VARIABLE_INVALID_VALUE for non-numeric @path values', () => {
    const error = expectOneDiceError(
      () => roll('@abilities.str.mod + 1', {
        syntax: 'fvtt-compatible',
        env: {
          'abilities.str.mod': 'strong',
        },
      }),
      'VARIABLE_INVALID_VALUE',
    )

    expect(error.meta).toMatchObject({
      actual: 'strong',
      variable: 'abilities.str.mod',
      range: { start: 0, end: 18 },
    })
  })
})

describe('FVTT-compatible dice pools', () => {
  it('normalizes FVTT dice pools into tuple selection when compatibility mode is enabled', () => {
    const result = roll('{4d6,3d8}kh', {
      syntax: 'fvtt-compatible',
      features: { tupleOperators: true },
      random: sequenceRandom([6, 2, 3, 4, 7, 1, 2]),
    })

    expect(result.value).toBe(15)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      source: 'operator',
      projection: 'sum',
      operator: 'kh',
      selected: [true, false],
      dropped: [false, true],
    })
    expect(result.trace).toMatchObject({
      kind: 'tuple-selection',
      operator: 'kh',
      count: 1,
      inputLength: 2,
      selectedIndexes: [0],
      droppedIndexes: [1],
      value: 15,
      range: { start: 0, end: 11 },
      children: [
        {
          kind: 'tuple',
          items: [
            { kind: 'dice', value: 15 },
            { kind: 'dice', value: 10 },
          ],
        },
      ],
    })
    expect(result.diagnostics).toEqual([
      {
        code: 'SYNTAX_NORMALIZED',
        severity: 'info',
        message: 'Normalized FVTT dice pool to tuple literal.',
        range: { start: 0, end: 9 },
        feature: 'fvttPool',
        original: '{4d6,3d8}',
        normalized: '[4d6,3d8]',
      },
    ])
  })

  it('reuses tuple selection semantics for FVTT low keep pools', () => {
    const result = roll('{4d6,3d8}kl', {
      syntax: 'fvtt-compatible',
      features: { tupleOperators: true },
      random: sequenceRandom([6, 2, 3, 4, 7, 1, 2]),
    })

    expect(result.value).toBe(10)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      source: 'operator',
      projection: 'sum',
      operator: 'kl',
      selected: [false, true],
      dropped: [true, false],
    })
    expect(result.trace).toMatchObject({
      kind: 'tuple-selection',
      operator: 'kl',
      count: 1,
      selectedIndexes: [1],
      droppedIndexes: [0],
      value: 10,
    })
    expect(result.diagnostics[0]).toMatchObject({
      code: 'SYNTAX_NORMALIZED',
      feature: 'fvttPool',
      original: '{4d6,3d8}',
      normalized: '[4d6,3d8]',
    })
  })

  it('normalizes FVTT dice pools without keep/drop operators', () => {
    const result = roll('{4d6,3d8}', {
      syntax: 'fvtt-compatible',
      random: sequenceRandom([1, 1, 1, 1, 2, 2, 2]),
    })

    expect(result.value).toBe(6)
    expect(result.raw.kind === 'tuple' && result.raw.items.map(item => item.kind === 'scalar' ? item.value : NaN))
      .toEqual([4, 6])
    expect(result.trace).toMatchObject({
      kind: 'tuple',
      value: 6,
      range: { start: 0, end: 9 },
    })
    expect(result.diagnostics).toHaveLength(1)
    expect(result.diagnostics[0]).toMatchObject({
      code: 'SYNTAX_NORMALIZED',
      feature: 'fvttPool',
      original: '{4d6,3d8}',
      normalized: '[4d6,3d8]',
    })
  })

  it('keeps single FVTT braces as existing env interpolation', () => {
    const result = roll('{attack}+1', {
      syntax: 'fvtt-compatible',
      env: { attack: '1d6' },
      random: sequenceRandom([4]),
    })

    expect(result.value).toBe(5)
    expect(result.diagnostics).toEqual([])
    expect(result.trace).toMatchObject({
      kind: 'binary',
      children: [
        { kind: 'interpolation', key: 'attack' },
        { kind: 'number', value: 1 },
      ],
    })
  })

  it('keeps comma-containing env keys as interpolation until non-dice pools are specified', () => {
    const result = roll('{attack,bonus}', {
      syntax: 'fvtt-compatible',
      env: { 'attack,bonus': '2' },
    })

    expect(result.value).toBe(2)
    expect(result.diagnostics).toEqual([])
    expect(result.trace).toMatchObject({
      kind: 'interpolation',
      key: 'attack,bonus',
    })
  })

  it('rejects non-dice FVTT pools with tuple operators structurally', () => {
    const error = expectOneDiceError(
      () => roll('{attack,bonus}kh', {
        syntax: 'fvtt-compatible',
        features: { tupleOperators: true },
        env: { 'attack,bonus': '2' },
      }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input: '{attack,bonus}kh',
      operator: '{}',
      actual: '{}',
      feature: 'fvttNonDicePool',
      featureEnabled: false,
      syntax: 'fvtt-compatible',
      range: { start: 0, end: 14 },
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })

  it('rejects FVTT-looking pools with tuple operators in default OneDice syntax', () => {
    const error = expectOneDiceError(
      () => roll('{attack,bonus}kh', {
        features: { tupleOperators: true },
        env: { 'attack,bonus': '2' },
      }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input: '{attack,bonus}kh',
      operator: '{}',
      actual: '{}',
      feature: 'fvttCompatibility',
      featureEnabled: false,
      syntax: 'onedice',
      range: { start: 0, end: 14 },
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })
})

describe('FVTT-compatible unsupported counting modifiers', () => {
  it.each([
    ['1d6cf<3', 'cf', 'fvttFailureCounting', { start: 3, end: 5 }],
    ['1d6cf', 'cf', 'fvttFailureCounting', { start: 3, end: 5 }],
    ['1d6df1', 'df', 'fvttDeductFailures', { start: 3, end: 5 }],
    ['1d6sf<3', 'sf', 'fvttSubtractFailures', { start: 3, end: 5 }],
    ['1d6ms10', 'ms', 'fvttMarginOfSuccess', { start: 3, end: 5 }],
    ['1d6even', 'even', 'fvttParityCounting', { start: 3, end: 7 }],
    ['1d6odd', 'odd', 'fvttParityCounting', { start: 3, end: 6 }],
  ])('rejects unsupported FVTT counting modifier %s structurally', (input, operator, feature, range) => {
    const error = expectOneDiceError(
      () => roll(input, {
        syntax: 'fvtt-compatible',
        features: { fvttSuccessCounting: true },
      }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input,
      operator,
      actual: operator,
      feature,
      featureEnabled: false,
      syntax: 'fvtt-compatible',
      range,
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })

  it.each([
    ['1d6cf<3', 'cf', 'fvttFailureCounting', { start: 3, end: 5 }],
    ['1d6df1', 'df', 'fvttDeductFailures', { start: 3, end: 5 }],
    ['1d6sf<3', 'sf', 'fvttSubtractFailures', { start: 3, end: 5 }],
    ['1d6ms10', 'ms', 'fvttMarginOfSuccess', { start: 3, end: 5 }],
    ['1d6even', 'even', 'fvttParityCounting', { start: 3, end: 7 }],
    ['1d6odd', 'odd', 'fvttParityCounting', { start: 3, end: 6 }],
  ])('rejects unsupported FVTT counting modifier %s in default OneDice syntax', (input, operator, feature, range) => {
    const error = expectOneDiceError(
      () => roll(input),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

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
})

describe('FVTT-compatible unsupported dice modifiers', () => {
  it.each([
    ['1d6x6', 'x', 'fvttExplode', { start: 3, end: 4 }],
    ['1d6xo', 'xo', 'fvttExplode', { start: 3, end: 5 }],
    ['1d6X6', 'X', 'fvttExplode', { start: 3, end: 4 }],
    ['1d6r<2', 'r', 'fvttReroll', { start: 3, end: 4 }],
    ['1d6r1', 'r', 'fvttReroll', { start: 3, end: 4 }],
    ['1d6rr1', 'rr', 'fvttReroll', { start: 3, end: 5 }],
  ])('rejects unsupported FVTT modifier %s structurally', (input, operator, feature, range) => {
    const error = expectOneDiceError(
      () => roll(input, { syntax: 'fvtt-compatible' }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input,
      operator,
      actual: operator,
      feature,
      featureEnabled: false,
      syntax: 'fvtt-compatible',
      range,
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })

  it.each([
    ['1d6x6', 'x', 'fvttExplode', { start: 3, end: 4 }],
    ['1d6xo', 'xo', 'fvttExplode', { start: 3, end: 5 }],
    ['1d6r<2', 'r', 'fvttReroll', { start: 3, end: 4 }],
    ['1d6rr1', 'rr', 'fvttReroll', { start: 3, end: 5 }],
  ])('rejects unsupported FVTT modifier %s in default OneDice syntax', (input, operator, feature, range) => {
    const error = expectOneDiceError(
      () => roll(input),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

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

  it('does not mistake scalar x multiplication for FVTT exploding dice', () => {
    const result = roll('2x3', { syntax: 'fvtt-compatible' })

    expect(result.value).toBe(6)
    expect(result.trace).toMatchObject({
      kind: 'binary',
      operator: 'x',
      left: 2,
      right: 3,
    })
  })
})

describe('FVTT-compatible unsupported runtime bindings', () => {
  it.each([
    ['/roll 1d20', '/roll', { start: 0, end: 5 }],
    ['/r 1d20', '/r', { start: 0, end: 2 }],
    ['/publicroll 1d20', '/publicroll', { start: 0, end: 11 }],
    ['/pr 1d20', '/pr', { start: 0, end: 3 }],
    ['/gmroll 1d20', '/gmroll', { start: 0, end: 7 }],
    ['/gmr 1d20', '/gmr', { start: 0, end: 4 }],
    ['/blindroll 1d20', '/blindroll', { start: 0, end: 10 }],
    ['/broll 1d20', '/broll', { start: 0, end: 6 }],
    ['/br 1d20', '/br', { start: 0, end: 3 }],
    ['/selfroll 1d20', '/selfroll', { start: 0, end: 9 }],
    ['/sr 1d20', '/sr', { start: 0, end: 3 }],
  ])('rejects unsupported Foundry roll mode %s structurally', (input, operator, range) => {
    const error = expectOneDiceError(
      () => roll(input, { syntax: 'fvtt-compatible' }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input,
      operator,
      actual: operator,
      feature: 'fvttRuntimeBinding',
      featureEnabled: false,
      syntax: 'fvtt-compatible',
      range,
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })

  it.each([
    ['/roll 1d20', '/roll', { start: 0, end: 5 }],
    ['/r 1d20', '/r', { start: 0, end: 2 }],
    ['/gmroll 1d20', '/gmroll', { start: 0, end: 7 }],
    ['/blindroll 1d20', '/blindroll', { start: 0, end: 10 }],
    ['/selfroll 1d20', '/selfroll', { start: 0, end: 9 }],
  ])('rejects unsupported Foundry roll mode %s in default OneDice syntax', (input, operator, range) => {
    const error = expectOneDiceError(
      () => roll(input),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input,
      operator,
      actual: operator,
      feature: 'fvttRuntimeBinding',
      featureEnabled: false,
      syntax: 'onedice',
      range,
    })
    expect(error.meta.hint).toEqual(expect.any(String))
  })
})

describe('FVTT-compatible success counting', () => {
  it.each(['1d20cs>15', '1d20cs'])(
    'does not enable success counting in default OneDice syntax for %s',
    (input) => {
    const error = expectOneDiceError(
      () => roll(input, { features: { fvttSuccessCounting: true } }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input,
      operator: 'cs',
      feature: 'fvttSuccessCounting',
      featureEnabled: false,
      syntax: 'onedice',
      range: { start: 4, end: 6 },
    })
  })

  it.each(['1d20cs>15', '1d20cs'])(
    'keeps success counting behind an explicit feature flag in compatibility mode for %s',
    (input) => {
    const error = expectOneDiceError(
      () => roll(input, { syntax: 'fvtt-compatible' }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input,
      operator: 'cs',
      feature: 'fvttSuccessCounting',
      featureEnabled: false,
      syntax: 'fvtt-compatible',
      range: { start: 4, end: 6 },
    })
  })

  it('counts dice above an explicit FVTT success threshold', () => {
    const result = roll('4d6cs>4', {
      syntax: 'fvtt-compatible',
      features: { fvttSuccessCounting: true },
      random: sequenceRandom([5, 4, 6, 1]),
    })

    expect(result.value).toBe(2)
    expect(result.raw).toEqual({
      kind: 'scalar',
      value: 2,
      source: 'operator',
    })
    expect(result.trace).toMatchObject({
      kind: 'success-count',
      operator: 'cs',
      comparator: '>',
      target: 4,
      value: 2,
      inputLength: 4,
      successIndexes: [0, 2],
      failureIndexes: [1, 3],
      range: { start: 0, end: 7 },
      children: [
        {
          kind: 'dice',
          rolls: [
            { index: 0, value: 5 },
            { index: 1, value: 4 },
            { index: 2, value: 6 },
            { index: 3, value: 1 },
          ],
        },
      ],
    })
  })

  it('supports inclusive and exact FVTT success comparators', () => {
    const inclusive = roll('3d6cs>=5', {
      syntax: 'fvtt-compatible',
      features: { fvttSuccessCounting: true },
      random: sequenceRandom([5, 4, 6]),
    })
    const exact = roll('3d6cs=1', {
      syntax: 'fvtt-compatible',
      features: { fvttSuccessCounting: true },
      random: sequenceRandom([1, 2, 1]),
    })
    const shorthandExact = roll('3d6cs1', {
      syntax: 'fvtt-compatible',
      features: { fvttSuccessCounting: true },
      random: sequenceRandom([1, 2, 1]),
    })

    expect(inclusive.value).toBe(2)
    expect(inclusive.trace).toMatchObject({
      kind: 'success-count',
      comparator: '>=',
      target: 5,
      successIndexes: [0, 2],
    })
    expect(exact.value).toBe(2)
    expect(exact.trace).toMatchObject({
      kind: 'success-count',
      comparator: '=',
      target: 1,
      successIndexes: [0, 2],
    })
    expect(shorthandExact.value).toBe(2)
    expect(shorthandExact.trace).toMatchObject({
      kind: 'success-count',
      comparator: '=',
      target: 1,
      successIndexes: [0, 2],
    })
  })

  it('requires an explicit target for this success-counting slice', () => {
    const error = expectOneDiceError(
      () => roll('1d20cs', {
        syntax: 'fvtt-compatible',
        features: { fvttSuccessCounting: true },
      }),
      'PARSE_UNEXPECTED_END',
    )

    expect(error.meta).toMatchObject({
      input: '1d20cs',
      actual: '$',
      range: { start: 6, end: 6 },
    })
    expect(error.meta.expected).toEqual(expect.arrayContaining(['num']))
  })

  it('consumes explicit tuples through the same success counting path', () => {
    const result = roll('[1,6,2]cs>3', {
      syntax: 'fvtt-compatible',
      features: {
        tupleLiterals: true,
        fvttSuccessCounting: true,
      },
    })

    expect(result.value).toBe(1)
    expect(result.trace).toMatchObject({
      kind: 'success-count',
      comparator: '>',
      target: 3,
      successIndexes: [1],
      failureIndexes: [0, 2],
      children: [
        {
          kind: 'tuple',
          value: 2,
        },
      ],
    })
  })
})
