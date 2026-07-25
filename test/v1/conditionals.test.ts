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

const conditionals = { conditionals: true }

describe('M9c comparison and boolean operators', () => {
  it('keeps conditionals behind a feature flag in the legacy API', () => {
    const error = expectOneDiceError(() => dice('3>2'), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      input: '3>2',
      operator: '>',
      feature: 'conditionals',
      featureEnabled: false,
      range: { start: 1, end: 2 },
    })
  })

  it('evaluates numeric comparisons as 1 or 0', () => {
    expect(roll('3>2', { features: conditionals }).trace).toMatchObject({
      kind: 'comparison',
      operator: '>',
      left: 3,
      right: 2,
      value: 1,
    })
    expect(roll('2>3', { features: conditionals }).value).toBe(0)
    expect(roll('2<3', { features: conditionals }).value).toBe(1)
    expect(roll('3=3', { features: conditionals }).value).toBe(1)
  })

  it('evaluates boolean operators with non-zero truthiness', () => {
    expect(roll('0|5', { features: conditionals }).trace).toMatchObject({
      kind: 'boolean',
      operator: '|',
      left: 0,
      right: 5,
      leftTruthy: false,
      rightTruthy: true,
      value: 1,
    })
    expect(roll('2&0', { features: conditionals }).value).toBe(0)
  })

  it('uses comparison and boolean precedence below arithmetic', () => {
    const result = roll('1+2>2&0|1', { features: conditionals })

    expect(result.value).toBe(1)
    expect(result.trace).toMatchObject({
      kind: 'boolean',
      operator: '|',
      value: 1,
      children: [
        {
          kind: 'boolean',
          operator: '&',
          value: 0,
          children: [
            {
              kind: 'comparison',
              operator: '>',
              left: 3,
              right: 2,
              value: 1,
            },
            { kind: 'number', value: 0 },
          ],
        },
        { kind: 'number', value: 1 },
      ],
    })
  })
})

describe('M9c ternary conditionals', () => {
  it('evaluates only the selected consequent branch', () => {
    const result = roll('1?1d8:$tMissing', {
      features: { conditionals: true, program: true },
      random: sequenceRandom([6]),
    })

    expect(result.value).toBe(6)
    expect(result.raw).toMatchObject({ kind: 'tuple', source: 'dice-rolls' })
    expect(result.trace).toMatchObject({
      kind: 'conditional',
      conditionValue: 1,
      selectedBranch: 'consequent',
      selectedTrace: {
        kind: 'dice',
        rolls: [{ randomCall: 1, value: 6 }],
      },
    })
  })

  it('evaluates only the selected alternate branch', () => {
    const result = roll('0?$tMissing:1d4', {
      features: { conditionals: true, program: true },
      random: sequenceRandom([3]),
    })

    expect(result.value).toBe(3)
    expect(result.trace).toMatchObject({
      kind: 'conditional',
      conditionValue: 0,
      selectedBranch: 'alternate',
      selectedTrace: {
        kind: 'dice',
        rolls: [{ randomCall: 1, value: 3 }],
      },
    })
  })

  it('works inside rollProgram with stored variables and shared random budget', () => {
    const result = rollProgram('$0e(2d6);($0>6)?1d8:1d4', {
      features: conditionals,
      random: sequenceRandom([4, 3, 6]),
    })

    expect(result.value).toBe(6)
    expect(result.budget.randomCalls).toBe(3)
    expect(result.statements[1].result.trace).toMatchObject({
      kind: 'conditional',
      conditionValue: 1,
      selectedBranch: 'consequent',
      conditionTrace: {
        kind: 'group',
        children: [
          {
            kind: 'comparison',
            operator: '>',
            left: 7,
            right: 6,
          },
        ],
      },
    })
  })
})