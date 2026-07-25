import { describe, expect, it } from 'vitest'
import { dice } from '../../src'
import { sequenceRandom } from '../helpers/random'

describe('V1 ordinary polyhedral dice d', () => {
  it('rolls A dice with B faces and sums them', () => {
    const [value] = dice('2d6', {
      random: sequenceRandom([2, 5]),
    })

    expect(value).toBe(7)
  })

  it('defaults the dice count to one', () => {
    const [value] = dice('d6', {
      random: sequenceRandom([4]),
    })

    expect(value).toBe(4)
  })

  it('defaults the face count from config', () => {
    const [value] = dice('2d', {
      random: sequenceRandom([30, 40]),
    })

    expect(value).toBe(70)
  })

  it('keeps the highest C rolls with k', () => {
    const [value] = dice('2d20k1', {
      random: sequenceRandom([11, 7]),
    })

    expect(value).toBe(11)
  })

  it('keeps the lowest C rolls with q', () => {
    const [value] = dice('2d20q1', {
      random: sequenceRandom([11, 7]),
    })

    expect(value).toBe(7)
  })

  it('rejects keeping more dice than were rolled', () => {
    expect(() => dice('2d6k3', {
      random: sequenceRandom([]),
    })).toThrow()
  })

  it('rejects combining selection and bonus or penalty modifiers', () => {
    expect(() => dice('2d20k1b1', {
      random: sequenceRandom([]),
    })).toThrow()
  })
})
