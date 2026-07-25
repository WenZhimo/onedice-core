import { describe, expect, it } from 'vitest'
import { dice, NumberNode, OneDiceError, OneDiceErrorCode, resolve, SimpleNode, UnaryNode } from '../../src'
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

describe('V1 runtime errors use stable OneDiceError codes', () => {
  it('reports percentile dice budget failures with DICE_TOO_MANY_ROLLS', () => {
    const error = expectOneDiceError(() => dice('p1', {
      maxRollCount: 2,
      random: sequenceRandom([]),
    }), 'DICE_TOO_MANY_ROLLS')

    expect(error.meta).toMatchObject({
      operator: 'p',
      actual: 3,
      limit: 2,
      range: { start: 0, end: 2 },
    })
  })

  it('reports fate dice budget failures with DICE_TOO_MANY_ROLLS', () => {
    const error = expectOneDiceError(() => dice('3f', {
      maxRollCount: 2,
      random: sequenceRandom([]),
    }), 'DICE_TOO_MANY_ROLLS')

    expect(error.meta).toMatchObject({
      operator: 'f',
      actual: 3,
      limit: 2,
      range: { start: 0, end: 2 },
    })
  })

  it('reports missing a-pool dice count with DICE_INVALID_DICE_COUNT', () => {
    const error = expectOneDiceError(() => dice('a2'), 'DICE_INVALID_DICE_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'a',
      actual: null,
      range: { start: 0, end: 2 },
    })
  })

  it('reports invalid a-pool face count with DICE_INVALID_FACE_COUNT', () => {
    const error = expectOneDiceError(() => dice('1a1'), 'DICE_INVALID_FACE_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'a',
      actual: 1,
      range: { start: 0, end: 3 },
    })
  })

  it('reports missing c-pool dice count with DICE_INVALID_DICE_COUNT', () => {
    const error = expectOneDiceError(() => dice('c2'), 'DICE_INVALID_DICE_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'c',
      actual: null,
      range: { start: 0, end: 2 },
    })
  })

  it('reports invalid c-pool face count with DICE_INVALID_FACE_COUNT', () => {
    const error = expectOneDiceError(() => dice('1c1'), 'DICE_INVALID_FACE_COUNT')

    expect(error.meta).toMatchObject({
      operator: 'c',
      actual: 1,
      range: { start: 0, end: 3 },
    })
  })

  it('reports missing interpolation values with VARIABLE_NOT_FOUND', () => {
    const error = expectOneDiceError(() => dice('{attack}'), 'VARIABLE_NOT_FOUND')

    expect(error.meta).toMatchObject({
      actual: 'attack',
    })
  })
  it('reports unsupported internal binary operators with PARSE_UNSUPPORTED_SYNTAX', () => {
    const node = new SimpleNode('??', new NumberNode(1), new NumberNode(2))
    const error = expectOneDiceError(() => node.eval({}), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      operator: '??',
    })
  })

  it('reports unsupported internal unary operators with PARSE_UNSUPPORTED_SYNTAX', () => {
    const node = new UnaryNode('!', new NumberNode(1))
    const error = expectOneDiceError(() => node.eval({}), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      operator: '!',
    })
  })

  it('reports unknown parser productions with PARSE_UNSUPPORTED_SYNTAX', () => {
    const error = expectOneDiceError(() => resolve({ id: 999, name: 'X', tokens: [] }, []), 'PARSE_UNSUPPORTED_SYNTAX')

    expect(error.meta).toMatchObject({
      actual: 999,
    })
  })
})
