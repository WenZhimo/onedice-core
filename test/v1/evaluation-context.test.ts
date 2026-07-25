import { describe, expect, it } from 'vitest'
import {
  attachEvaluationContext,
  createEvaluationContext,
  dice,
  getEvaluationContext,
  OneDiceError,
  roll,
} from '../../src'
import { sequenceRandom } from '../helpers/random'

describe('EvaluationContext bridge', () => {
  it('counts random calls through the budgeted random source', () => {
    const context = createEvaluationContext({
      random: () => 4,
      maxRollCount: 2,
    })

    expect(context.random.nextInt(1, 6)).toBe(4)
    expect(context.budget.randomCalls).toBe(1)
    expect(context.random.nextInt(1, 6)).toBe(4)
    expect(context.budget.randomCalls).toBe(2)
  })

  it('throws a stable error when the random budget is exceeded', () => {
    const context = createEvaluationContext({
      random: () => 4,
      maxRollCount: 1,
    })

    context.random.nextInt(1, 6)

    try {
      context.random.nextInt(1, 6)
      throw new Error('Expected random budget to be exceeded')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('EVALUATION_BUDGET_EXCEEDED')
      expect((error as OneDiceError).meta).toMatchObject({
        actual: 2,
        limit: 1,
      })
    }
  })

  it('attaches the context to a config-compatible object', () => {
    const context = createEvaluationContext({
      random: () => 3,
      maxRollCount: 10,
    })
    const config = attachEvaluationContext({
      random: () => 3,
      maxRollCount: 10,
    }, context)

    expect(config.random(1, 6)).toBe(3)
    expect(getEvaluationContext(config)).toBe(context)
    expect(context.budget.randomCalls).toBe(1)
  })

  it('keeps legacy maxRollCount prechecks at the default floor when explicit maxRandomCalls is lower', () => {
    const context = createEvaluationContext({
      random: () => 3,
      maxRandomCalls: 1,
    })
    const config = attachEvaluationContext({}, context)

    expect(config.maxRollCount).toBe(10000)
    expect(config.maxRandomCalls).toBe(1)
    expect(config.random(1, 6)).toBe(3)

    try {
      config.random(1, 6)
      throw new Error('Expected explicit maxRandomCalls to remain the runtime budget')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('EVALUATION_BUDGET_EXCEEDED')
      expect((error as OneDiceError).meta).toMatchObject({
        budgetKind: 'randomCalls',
        actual: 2,
        limit: 1,
      })
    }
  })

  it('raises legacy maxRollCount prechecks when explicit maxRandomCalls is above the default floor', () => {
    const context = createEvaluationContext({
      maxRandomCalls: 10001,
    })
    const config = attachEvaluationContext({}, context)

    expect(config.maxRollCount).toBe(10001)
    expect(config.maxRandomCalls).toBe(10001)
  })

  it('defaults syntax and feature flags to the safe OneDice mode', () => {
    const context = createEvaluationContext()

    expect(context.syntax).toBe('onedice')
    expect(context.features).toMatchObject({
      tupleLiterals: false,
      tupleOperators: false,
      clampOperators: false,
      tupleProjection: false,
      tupleSlice: false,
      loopOperator: false,
      conditionals: false,
      program: false,
      fateAlias: false,
      variableAliases: false,
    })
  })

  it('normalizes explicit syntax and feature flags into the shared context', () => {
    const context = createEvaluationContext({
      syntax: 'fvtt-compatible',
      features: {
        tupleOperators: true,
        program: true,
      },
    })

    expect(context.syntax).toBe('fvtt-compatible')
    expect(context.features).toMatchObject({
      tupleOperators: true,
      program: true,
      clampOperators: false,
      tupleProjection: false,
    })
  })

  it('does not mutate caller-provided feature flags during normalization', () => {
    const features = {
      tupleOperators: true,
    }

    createEvaluationContext({ features })
    roll('1', { features })

    expect(features).toEqual({
      tupleOperators: true,
    })
  })

  it('preserves syntax and feature flags when attaching a shared context', () => {
    const context = createEvaluationContext({
      syntax: 'fvtt-compatible',
      features: {
        tupleOperators: true,
      },
    })
    const config = attachEvaluationContext({}, context)

    expect(config.syntax).toBe('fvtt-compatible')
    expect(config.features.tupleOperators).toBe(true)
    expect(getEvaluationContext(config)).toBe(context)
  })

  it('reuses an attached context when dice() is called recursively or directly', () => {
    const context = createEvaluationContext({
      random: sequenceRandom([3, 4]),
      maxRollCount: 10,
    })
    context.random.nextInt(1, 6)

    const config = attachEvaluationContext({
      maxRollCount: 10,
    }, context)
    const [value, root] = dice('1d6', config)

    expect(value).toBe(4)
    expect(context.budget.randomCalls).toBe(2)
    expect((root.evaluation as any).roll[0].randomCall).toBe(2)
  })

  it('shares the random budget between interpolation children and outer expressions', () => {
    try {
      roll('{attack}+1d6', {
        env: { attack: '1d6' },
        random: sequenceRandom([4, 5]),
        maxRollCount: 1,
      })
      throw new Error('Expected shared random budget to be exceeded')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('EVALUATION_BUDGET_EXCEEDED')
      expect((error as OneDiceError).meta).toMatchObject({
        actual: 2,
        limit: 1,
      })
    }
  })

  it('rejects overwriting readonly variables with stable metadata', () => {
    const context = createEvaluationContext()

    context.variables.set('i', { name: 'i', value: 1 }, { readonly: true })

    expect(context.variables.isReadonly('i')).toBe(true)
    expect(context.variables.snapshot()).toMatchObject({
      i: { name: 'i', value: 1 },
    })

    try {
      context.variables.set('i', { name: 'i', value: 2 }, { range: { start: 4, end: 5 } })
      throw new Error('Expected readonly variable assignment to fail')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('VARIABLE_READONLY')
      expect((error as OneDiceError).meta).toMatchObject({
        variable: 'i',
        range: { start: 4, end: 5 },
      })
    }

    expect(context.variables.snapshot()).toMatchObject({
      i: { name: 'i', value: 1 },
    })

    context.variables.set('i', { name: 'i', value: 2 }, { force: true })
    expect(context.variables.isReadonly('i')).toBe(false)
    expect(context.variables.snapshot()).toMatchObject({
      i: { name: 'i', value: 2 },
    })
  })
})
