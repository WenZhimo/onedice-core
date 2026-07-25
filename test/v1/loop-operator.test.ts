import { describe, expect, it } from 'vitest'
import { dice, OneDiceError, roll, rollProgram } from '../../src'
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

function scalarItems(raw: ReturnType<typeof roll>['raw']): number[] {
  expect(raw.kind).toBe('tuple')
  return raw.kind === 'tuple'
    ? raw.items.map(item => item.kind === 'scalar' ? item.value : NaN)
    : []
}

const loopFeatures = { loopOperator: true }

describe('loop operator', () => {
  it('rejects lp by default with a loopOperator feature hint', () => {
    const error = expectOneDiceError(
      () => dice('3lp[i]'),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      operator: 'lp',
      feature: 'loopOperator',
      featureEnabled: false,
      range: { start: 1, end: 3 },
    })
  })

  it('does not enable standalone tuple literals when only loopOperator is enabled', () => {
    const error = expectOneDiceError(
      () => dice('[1,2,3]', { features: loopFeatures }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      operator: '[',
      feature: 'tupleLiterals',
    })
  })

  it('does not let loop syntax enable unrelated tuple literals in the same expression', () => {
    const error = expectOneDiceError(
      () => dice('[1,2,3]+3lp[i]', { features: loopFeatures }),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      operator: '[',
      feature: 'tupleLiterals',
      range: { start: 0, end: 1 },
    })
  })

  it('loops over scalar bounds with a local i variable', () => {
    const result = roll('3lp[i]', { features: loopFeatures })

    expect(result.value).toBe(6)
    expect(result.raw).toMatchObject({
      kind: 'tuple',
      source: 'loop',
      projection: 'sum',
      operator: 'lp',
    })
    expect(scalarItems(result.raw)).toEqual([1, 2, 3])
    expect(result.trace).toMatchObject({
      kind: 'loop',
      bounds: { start: 1, end: 3, step: 1 },
      itemCount: 3,
      iterations: [
        { index: 0, variable: 'i', value: 1, body: { kind: 'tuple' } },
        { index: 1, variable: 'i', value: 2, body: { kind: 'tuple' } },
        { index: 2, variable: 'i', value: 3, body: { kind: 'tuple' } },
      ],
    })
  })

  it('normalizes tuple bounds before executing the loop body', () => {
    expect(scalarItems(roll('[3]lp[i]', { features: loopFeatures }).raw)).toEqual([1, 2, 3])
    expect(scalarItems(roll('[2,5]lp[i]', { features: loopFeatures }).raw)).toEqual([2, 3, 4, 5])
    expect(scalarItems(roll('[1,2,5]lp[i]', { features: loopFeatures }).raw)).toEqual([3, 5])
  })

  it('preserves random call order across loop iterations', () => {
    const result = roll('3lp[1d6]', {
      features: loopFeatures,
      random: sequenceRandom([2, 4, 6]),
    })

    expect(result.value).toBe(12)
    expect(scalarItems(result.raw)).toEqual([2, 4, 6])
    expect(result.trace).toMatchObject({
      kind: 'loop',
      iterations: [
        { body: { items: [{ kind: 'dice', rolls: [{ randomCall: 1, value: 2 }] }] } },
        { body: { items: [{ kind: 'dice', rolls: [{ randomCall: 2, value: 4 }] }] } },
        { body: { items: [{ kind: 'dice', rolls: [{ randomCall: 3, value: 6 }] }] } },
      ],
    })
  })

  it('keeps conditionals lazy inside loop bodies', () => {
    const result = roll('3lp[i>1?1d6:0]', {
      features: { loopOperator: true, conditionals: true },
      random: sequenceRandom([4, 5]),
    })

    expect(result.value).toBe(9)
    expect(scalarItems(result.raw)).toEqual([0, 4, 5])
    expect(result.trace).toMatchObject({
      kind: 'loop',
      iterations: [
        { value: 1, body: { items: [{ kind: 'conditional', selectedBranch: 'alternate' }] } },
        { value: 2, body: { items: [{ kind: 'conditional', selectedBranch: 'consequent' }] } },
        { value: 3, body: { items: [{ kind: 'conditional', selectedBranch: 'consequent' }] } },
      ],
    })
  })

  it('does not leak i outside the loop body', () => {
    const error = expectOneDiceError(
      () => rollProgram('3lp[i];i', { features: loopFeatures }),
      'VARIABLE_NOT_FOUND',
    )

    expect(error.meta).toMatchObject({
      variable: 'i',
      range: { start: 0, end: 1 },
    })
  })

  it('rejects invalid loop bounds before running the body', () => {
    expectOneDiceError(
      () => roll('[1,2,3,4]lp[1d6]', {
        features: loopFeatures,
        random: () => 1,
      }),
      'LOOP_INVALID_BOUNDS_ARITY',
    )
    expectOneDiceError(
      () => roll('1.5lp[1d6]', {
        features: loopFeatures,
        random: () => 1,
      }),
      'LOOP_INVALID_BOUND',
    )
    expectOneDiceError(
      () => roll('[1,0,5]lp[1d6]', {
        features: loopFeatures,
        random: () => 1,
      }),
      'LOOP_INVALID_STEP',
    )
    expectOneDiceError(
      () => roll('0lp[1d6]', {
        features: loopFeatures,
        random: () => 1,
      }),
      'LOOP_INVALID_RANGE',
    )
  })

  it('enforces loop iteration and depth budgets', () => {
    const iterationError = expectOneDiceError(
      () => roll('100lp[i]', {
        features: loopFeatures,
        maxLoopIterations: 10,
      }),
      'EVALUATION_BUDGET_EXCEEDED',
    )

    expect(iterationError.meta).toMatchObject({
      budgetKind: 'loopIterations',
      actual: 100,
      limit: 10,
    })

    const depthError = expectOneDiceError(
      () => roll('2lp[2lp[i]]', {
        features: loopFeatures,
        maxLoopDepth: 1,
      }),
      'EVALUATION_BUDGET_EXCEEDED',
    )

    expect(depthError.meta).toMatchObject({
      budgetKind: 'loopDepth',
      actual: 2,
      limit: 1,
    })
  })
})

