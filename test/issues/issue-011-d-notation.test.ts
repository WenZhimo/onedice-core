import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
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

function readText(path: string): string {
  return readFileSync(resolve(__dirname, '..', '..', path), 'utf8')
}

describe('issue #11: d expression contract', () => {
  it('keeps the README d slots, defaults, modifier matrix, and browser contract explicit', () => {
    const readme = readText('README.md')

    for (const contract of [
      '[骰数]d[面数][骰池参数 | 选取线参数 奖惩数参数]',
      'DExpression =',
      '[DiceCount] "d" [FaceCount] DModifier*',
      '骰池参数：a[点数阈值]',
      '选取线参数：(k|q)[选取个数]',
      '奖惩数参数：(p|b)[奖惩个数]',
      '`d` 等价于 `1d100`',
      '| `d20` | 掷 `1d20`，省略骰数 |',
      '| `2d` | 掷 `2d100`，省略面数 |',
      '`AdBkC`',
      '`AdBqC`',
      '`AdBpD`',
      '`AdBbD`',
      '`AdBaE`',
      '`DICE_INVALID_DICE_COUNT`',
      '`DICE_INVALID_FACE_COUNT`',
      '`DICE_INVALID_KEEP_COUNT`',
      '`DICE_INCOMPATIBLE_MODIFIERS`',
      '`DICE_POOL_MODIFIER_EXCLUSIVE`',
      '`PARSE_UNEXPECTED_END`',
      '`PARSE_UNSUPPORTED_SYNTAX`',
      '`raw.kind` 是 `tuple`',
      '`trace.kind` 是 `dice`',
      '`error.meta.range`',
      '`k/q` 不得与 `p/b` 同时使用',
      '`a` 骰池模式应当作为独占模式处理',
      '骰数和面数必须在 `1` 到 `10000` 之间',
      './docs/decisions/0010-d-expression-contract.md',
    ]) {
      expect(readme).toContain(contract)
    }
  })

  it('keeps ADR-010 aligned with the d expression engineering contract', () => {
    const adr = readText('docs/decisions/0010-d-expression-contract.md')

    for (const contract of [
      '# ADR-010: 普通 `d` 表达式合同',
      'DExpression =',
      '`2d` 等价于 `2d100`',
      '`DICE_INCOMPATIBLE_MODIFIERS`',
      '`DICE_POOL_MODIFIER_EXCLUSIVE`',
      '后出现的冲突 modifier',
      "raw.kind='tuple'",
      "trace.kind='dice'",
      'dice(input, config): [number, DiceNode]',
    ]) {
      expect(adr).toContain(contract)
    }
  })

  it('accepts implicit dice and face defaults without changing dice() shape', () => {
    const [defaultBoth] = dice('d', {
      random: sequenceRandom([42]),
    })
    const [defaultDice] = dice('d20', {
      random: sequenceRandom([11]),
    })
    const [defaultFaces] = dice('2d', {
      random: sequenceRandom([30, 40]),
    })

    expect(defaultBoth).toBe(42)
    expect(defaultDice).toBe(11)
    expect(defaultFaces).toBe(70)
  })

  it('accepts the documented d modifier families on success paths', () => {
    expect(dice('2d20k1', {
      random: sequenceRandom([11, 7]),
    })[0]).toBe(11)
    expect(dice('2d20q1', {
      random: sequenceRandom([11, 7]),
    })[0]).toBe(7)
    expect(dice('1d20b1', {
      random: sequenceRandom([0, 0, 1]),
    })[0]).toBe(10)
    expect(dice('1d20p1', {
      random: sequenceRandom([0, 1, 0]),
    })[0]).toBe(100)
    expect(dice('1d6a5', {
      random: sequenceRandom([6, 4]),
    })[0]).toBe(1)
  })

  it('exposes ordinary d raw and trace data for browser UI rendering', () => {
    const result = roll('2d20k1', {
      random: sequenceRandom([11, 7]),
    })

    expect(result.raw).toMatchObject({
      kind: 'tuple',
      projection: 'sum',
      source: 'dice-rolls',
      items: [
        { kind: 'scalar', value: 11, roll: { index: 0, randomCall: 1, selected: true, dropped: false } },
        { kind: 'scalar', value: 7, roll: { index: 1, randomCall: 2, selected: false, dropped: true } },
      ],
    })
    expect(result.trace).toMatchObject({
      kind: 'dice',
      operator: 'd',
      expression: '2d20k1',
      range: { start: 0, end: 6 },
      diceCount: 2,
      faceCount: 20,
      rolls: [
        { index: 0, randomCall: 1, value: 11, selected: true, dropped: false, source: 'base' },
        { index: 1, randomCall: 2, value: 7, selected: false, dropped: true, source: 'base' },
      ],
      modifiers: [
        { kind: 'selection', operator: 'k', count: 1 },
      ],
    })
    expect(result.diagnostics).toEqual([])
  })

  it('rejects dice counts outside the formal semantic range', () => {
    const below = expectOneDiceError(() => dice('0d6', {
      random: sequenceRandom([]),
    }), 'DICE_INVALID_DICE_COUNT')
    const above = expectOneDiceError(() => dice('10001d1', {
      random: sequenceRandom([]),
    }), 'DICE_INVALID_DICE_COUNT')

    expect(below.meta).toMatchObject({
      operator: 'd',
      actual: 0,
      diceCount: 0,
      min: 1,
      max: 10000,
      range: { start: 0, end: 1 },
      hint: expect.any(String),
    })
    expect(above.meta).toMatchObject({
      operator: 'd',
      actual: 10001,
      diceCount: 10001,
      limit: 10000,
      min: 1,
      max: 10000,
      range: { start: 0, end: 5 },
      hint: expect.any(String),
    })
  })

  it('rejects face counts below one with DICE_INVALID_FACE_COUNT', () => {
    const error = expectOneDiceError(() => dice('1d0', {
      random: sequenceRandom([]),
    }), 'DICE_INVALID_FACE_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'd',
      actual: 0,
      faceCount: 0,
      min: 1,
      max: 10000,
      range: { start: 2, end: 3 },
      hint: expect.any(String),
    })
  })

  it('rejects face counts above 10000 with DICE_INVALID_FACE_COUNT', () => {
    const error = expectOneDiceError(() => dice('1d10001', {
      random: sequenceRandom([]),
    }), 'DICE_INVALID_FACE_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'd',
      actual: 10001,
      faceCount: 10001,
      limit: 10000,
      min: 1,
      max: 10000,
      range: { start: 2, end: 7 },
      hint: expect.any(String),
    })
  })

  it('rejects keep counts larger than dice count with DICE_INVALID_KEEP_COUNT', () => {
    const error = expectOneDiceError(() => dice('2d6k3', {
      random: sequenceRandom([]),
    }), 'DICE_INVALID_KEEP_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'k',
      actual: 3,
      modifier: 'k',
      keepCount: 3,
      diceCount: 2,
      limit: 2,
      min: 1,
      max: 2,
      range: { start: 3, end: 5 },
      hint: expect.any(String),
    })
  })

  it('rejects low selection counts with modifier-local range metadata', () => {
    const error = expectOneDiceError(() => dice('2d6q0', {
      random: sequenceRandom([]),
    }), 'DICE_INVALID_KEEP_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'q',
      actual: 0,
      keepCount: 0,
      diceCount: 2,
      range: { start: 3, end: 5 },
      hint: expect.any(String),
    })
  })

  it('rejects selection and bonus/penalty modifiers together', () => {
    const error = expectOneDiceError(() => dice('2d20k1b1', {
      random: sequenceRandom([]),
    }), 'DICE_INCOMPATIBLE_MODIFIERS')

    expect(error.meta).toMatchObject({
      operator: 'd',
      actual: '2d20k1b1',
      modifier: 'b',
      leftModifier: 'k',
      rightModifier: 'b',
      conflictWith: 'k',
      range: { start: 6, end: 8 },
      hint: expect.any(String),
    })
  })

  it('highlights the later selection modifier when bonus/penalty appears first', () => {
    const error = expectOneDiceError(() => dice('2d20p1k1', {
      random: sequenceRandom([]),
    }), 'DICE_INCOMPATIBLE_MODIFIERS')

    expect(error.meta).toMatchObject({
      modifier: 'k',
      leftModifier: 'k',
      rightModifier: 'p',
      conflictWith: 'p',
      range: { start: 6, end: 8 },
    })
  })

  it('rejects pool mode combined with selection modifiers', () => {
    const error = expectOneDiceError(() => dice('2d6a5k1', {
      random: sequenceRandom([]),
    }), 'DICE_POOL_MODIFIER_EXCLUSIVE')

    expect(error.meta).toMatchObject({
      operator: 'd',
      actual: '2d6k1a5',
      modifier: 'k',
      poolModifier: 'a',
      conflictingModifier: 'k',
      conflictWith: 'a',
      range: { start: 5, end: 7 },
      hint: expect.any(String),
    })
  })

  it('highlights the later pool modifier when selection appears first', () => {
    const error = expectOneDiceError(() => dice('2d6k1a5', {
      random: sequenceRandom([]),
    }), 'DICE_POOL_MODIFIER_EXCLUSIVE')

    expect(error.meta).toMatchObject({
      modifier: 'a',
      poolModifier: 'a',
      conflictingModifier: 'k',
      conflictWith: 'k',
      range: { start: 5, end: 7 },
    })
  })

  it('rejects pool mode combined with bonus/penalty modifiers', () => {
    const error = expectOneDiceError(() => dice('2d6a5b1', {
      random: sequenceRandom([]),
    }), 'DICE_POOL_MODIFIER_EXCLUSIVE')

    expect(error.meta).toMatchObject({
      operator: 'd',
      actual: '2d6b1a5',
      modifier: 'b',
      poolModifier: 'a',
      conflictingModifier: 'b',
      conflictWith: 'a',
      range: { start: 5, end: 7 },
      hint: expect.any(String),
    })
  })

  it('reports parser range for a genuinely missing right operand after a d expression', () => {
    const error = expectOneDiceError(() => dice('1d6+'), 'PARSE_UNEXPECTED_END')

    expect(error.meta).toMatchObject({
      actual: '$',
      range: { start: 4, end: 4 },
      expected: expect.arrayContaining(['num', 'int', '(']),
      hint: expect.any(String),
    })
  })

  it('reports unsupported d suffixes as structured unsupported syntax', () => {
    const error = expectOneDiceError(() => dice('1d6!'), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      operator: '!',
      actual: '!',
      feature: 'factorialOrNotOperator',
      featureEnabled: false,
      range: { start: 3, end: 4 },
      hint: expect.any(String),
    })
  })
})
