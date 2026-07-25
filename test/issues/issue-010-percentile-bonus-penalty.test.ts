import { describe, expect, it } from 'vitest'
import { dice } from '../../src'
import { sequenceRandom } from '../helpers/random'

describe('issue #10: COC bonus and penalty percentile dice', () => {
  it('treats base tens 00 and ones 0 as 100', () => {
    const [value] = dice('b0', {
      random: sequenceRandom([0, 0]),
    })

    expect(value).toBe(100)
  })

  it('chooses 10 over 100 for a bonus die boundary case', () => {
    const [value] = dice('b1', {
      random: sequenceRandom([0, 0, 1]),
    })

    expect(value).toBe(10)
  })

  it('chooses 100 over 10 for a penalty die boundary case', () => {
    const [value] = dice('p1', {
      random: sequenceRandom([0, 1, 0]),
    })

    expect(value).toBe(100)
  })

  it('chooses the best tens value from multiple bonus dice', () => {
    const [value] = dice('b3', {
      random: sequenceRandom([4, 7, 3, 9, 1]),
    })

    expect(value).toBe(14)
  })

  it('chooses the worst tens value from multiple penalty dice', () => {
    const [value] = dice('p3', {
      random: sequenceRandom([4, 7, 3, 9, 1]),
    })

    expect(value).toBe(94)
  })
})
