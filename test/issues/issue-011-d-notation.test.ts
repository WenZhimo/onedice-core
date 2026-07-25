import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { dice, OneDiceError } from '../../src'
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

describe('issue #11: d syntax validation produces stable error codes', () => {
  it('keeps the README d syntax slots and modifier matrix explicit', () => {
    const readme = readText('README.md')

    for (const contract of [
      '[骰数]d[面数][骰池参数 | 选取线参数 奖惩数参数]',
      '骰池参数：a[点数阈值]',
      '选取线参数：(k|q)[选取个数]',
      '奖惩数参数：(p|b)[奖惩个数]',
      '`AdBkC`',
      '`AdBqC`',
      '`AdBpD`',
      '`AdBbD`',
      '`AdBaE`',
      '`k/q` 不得与 `p/b` 同时使用',
      '`a` 骰池模式应当作为独占模式处理',
      '骰数和面数必须在 `1` 到 `10000` 之间',
    ]) {
      expect(readme).toContain(contract)
    }
  })

  it('rejects face counts below one with DICE_INVALID_FACE_COUNT', () => {
    const error = expectOneDiceError(() => dice('1d0', {
      random: sequenceRandom([]),
    }), 'DICE_INVALID_FACE_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'd',
      actual: 0,
      range: { start: 0, end: 3 },
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
      limit: 2,
      range: { start: 0, end: 5 },
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
      range: { start: 0, end: 8 },
      hint: expect.any(String),
    })
  })

  it('rejects pool mode combined with selection modifiers', () => {
    const error = expectOneDiceError(() => dice('2d6a5k1', {
      random: sequenceRandom([]),
    }), 'DICE_POOL_MODIFIER_EXCLUSIVE')

    expect(error.meta).toMatchObject({
      operator: 'd',
      actual: '2d6k1a5',
      range: { start: 0, end: 7 },
      hint: expect.any(String),
    })
  })

  it('rejects pool mode combined with bonus/penalty modifiers', () => {
    const error = expectOneDiceError(() => dice('2d6a5b1', {
      random: sequenceRandom([]),
    }), 'DICE_POOL_MODIFIER_EXCLUSIVE')

    expect(error.meta).toMatchObject({
      operator: 'd',
      actual: '2d6b1a5',
      range: { start: 0, end: 7 },
      hint: expect.any(String),
    })
  })
})
