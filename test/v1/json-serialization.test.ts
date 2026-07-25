import { describe, expect, it } from 'vitest'
import { roll, rollProgram } from '../../src'
import { sequenceRandom } from '../helpers/random'

function collectGenericTracePaths(value: unknown): string[] {
  const paths: string[] = []

  function visit(node: unknown, path: string) {
    if (!node || typeof node !== 'object') return

    if ((node as { kind?: unknown }).kind === 'generic') {
      paths.push(path)
    }

    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`))
      return
    }

    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      visit(child, `${path}.${key}`)
    }
  }

  visit(value, 'result')
  return paths
}

describe('public result JSON serialization', () => {
  it.each([
    [
      'tuple selection',
      () => roll('2d20kh1', {
        features: { tupleOperators: true },
        random: sequenceRandom([7, 19]),
      }),
      { value: 19, traceKind: 'tuple-selection', rawKind: 'tuple' },
    ],
    [
      'tuple slice',
      () => roll('[1,2,3,4]sp[2,3]', {
        features: { tupleLiterals: true, tupleSlice: true },
      }),
      { value: 5, traceKind: 'tuple-slice', rawKind: 'tuple' },
    ],
    [
      'loop',
      () => roll('3lp[i]', {
        features: { loopOperator: true },
      }),
      { value: 6, traceKind: 'loop', rawKind: 'tuple' },
    ],
    [
      'FVTT pool',
      () => roll('{4d6,3d8}kh', {
        syntax: 'fvtt-compatible',
        features: { tupleOperators: true },
        random: sequenceRandom([6, 2, 3, 4, 7, 1, 2]),
      }),
      { value: 15, traceKind: 'tuple-selection', rawKind: 'tuple', diagnosticFeature: 'fvttPool' },
    ],
    [
      'FVTT success counting',
      () => roll('4d6cs>4', {
        syntax: 'fvtt-compatible',
        features: { fvttSuccessCounting: true },
        random: sequenceRandom([5, 4, 6, 1]),
      }),
      { value: 2, traceKind: 'success-count', rawKind: 'scalar' },
    ],
  ])('serializes %s roll result without circular references', (_label, createResult, expected) => {
    const parsed = JSON.parse(JSON.stringify(createResult()))

    expect(parsed.value).toBe(expected.value)
    expect(parsed.raw.kind).toBe(expected.rawKind)
    expect(parsed.trace.kind).toBe(expected.traceKind)
    if (expected.diagnosticFeature) {
      expect(parsed.diagnostics[0].feature).toBe(expected.diagnosticFeature)
    }
  })

  it('serializes rollProgram results including statements, variables, diagnostics, and budget', () => {
    const parsed = JSON.parse(JSON.stringify(
      rollProgram('$0e(2d6);$0+1', {
        random: sequenceRandom([2, 5]),
      }),
    ))

    expect(parsed.value).toBe(8)
    expect(parsed.raw.kind).toBe('scalar')
    expect(parsed.statements).toHaveLength(2)
    expect(parsed.statements[0].assignedVariable.raw.kind).toBe('tuple')
    expect(parsed.variables.$0.raw.kind).toBe('tuple')
    expect(parsed.diagnostics).toEqual([])
    expect(parsed.budget.randomCalls).toBe(2)
  })

  it('serializes rollProgram diagnostics from normalized statements', () => {
    const parsed = JSON.parse(JSON.stringify(
      rollProgram('$0e(4df);$0+1', {
        features: { fateAlias: true },
        random: sequenceRandom([0, 1, 2, 0]),
      }),
    ))

    expect(parsed.value).toBe(2)
    expect(parsed.statements).toHaveLength(2)
    expect(parsed.diagnostics).toEqual([
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
    expect(parsed.statements[0].diagnostics).toEqual(parsed.diagnostics)
    expect(parsed.statements[0].result.diagnostics).toEqual(parsed.diagnostics)
    expect(parsed.statements[1].diagnostics).toEqual([])
    expect(parsed.variables.$0.raw.kind).toBe('scalar')
    expect(parsed.budget.randomCalls).toBe(4)
  })

  it.each([
    ['number', () => roll('42')],
    ['unary', () => roll('-1')],
    ['binary and group', () => roll('(1+2)*3')],
    ['ordinary d', () => roll('2d20k1', { random: sequenceRandom([11, 7]) })],
    ['percentile bonus', () => roll('b1', { random: sequenceRandom([3, 8, 2]) })],
    ['fate dice', () => roll('3f', { random: sequenceRandom([0, 1, 2]) })],
    ['a pool', () => roll('1a2k1m2', { random: sequenceRandom([2, 1]) })],
    ['c pool', () => roll('1c2m2', { random: sequenceRandom([2, 1]) })],
    ['interpolation', () => roll('{attack}+1', {
      env: { attack: '(1d6+2)' },
      random: sequenceRandom([4]),
    })],
    ['tuple literal', () => roll('[1,2,3]', { features: { tupleLiterals: true } })],
    ['tuple selection', () => roll('2d20kh1', {
      features: { tupleOperators: true },
      random: sequenceRandom([7, 19]),
    })],
    ['tuple projection', () => roll('[1,2,3]tp', {
      features: { tupleLiterals: true, tupleProjection: true },
    })],
    ['tuple slice', () => roll('[1,2,3]sp[1,2]', {
      features: { tupleLiterals: true, tupleSlice: true },
    })],
    ['clamp', () => roll('[7,4]max5', {
      features: { tupleLiterals: true, clampOperators: true },
    })],
    ['conditionals', () => roll('1?1d8:1d4', {
      features: { conditionals: true },
      random: sequenceRandom([6]),
    })],
    ['loop', () => roll('3lp[i]', { features: { loopOperator: true } })],
    ['FVTT @path variable', () => roll('@abilities.str.mod + 1', {
      syntax: 'fvtt-compatible',
      env: { 'abilities.str.mod': 3 },
    })],
    ['FVTT pool', () => roll('{4d6,3d8}kh', {
      syntax: 'fvtt-compatible',
      features: { tupleOperators: true },
      random: sequenceRandom([6, 2, 3, 4, 7, 1, 2]),
    })],
    ['FVTT success counting', () => roll('4d6cs>4', {
      syntax: 'fvtt-compatible',
      features: { fvttSuccessCounting: true },
      random: sequenceRandom([5, 4, 6, 1]),
    })],
    ['program variables', () => rollProgram('$0e(2d6);$0+1', {
      random: sequenceRandom([2, 5]),
    })],
  ])('does not fall back to generic trace for supported public path: %s', (_label, createResult) => {
    const parsed = JSON.parse(JSON.stringify(createResult()))

    expect(collectGenericTracePaths(parsed)).toEqual([])
  })
})
