import { describe, expect, it } from 'vitest'
import { dice } from '../../src'
import { sequenceRandom } from '../helpers/random'

describe('V1 COC bonus and penalty dice p/b', () => {
  it('maps 00 plus 0 to 100', () => {
    const [value] = dice('b0', {
      random: sequenceRandom([0, 0]),
    })

    expect(value).toBe(100)
  })

  it('uses a bonus die to choose the better tens value', () => {
    const [value] = dice('b1', {
      random: sequenceRandom([3, 8, 2]),
    })

    expect(value).toBe(23)
  })

  it('uses a penalty die to choose the worse tens value', () => {
    const [value] = dice('p1', {
      random: sequenceRandom([3, 2, 8]),
    })

    expect(value).toBe(83)
  })
})
