import { describe, expect, it } from 'vitest'
import { dice } from '../../src'

describe('V1 arithmetic expressions', () => {
  it('respects multiplication precedence over addition', () => {
    const [value] = dice('1+2*3')

    expect(value).toBe(7)
  })

  it('treats x as a V1 multiplication operator', () => {
    const [value] = dice('2x3')

    expect(value).toBe(6)
  })

  it('respects parentheses before multiplication', () => {
    const [value] = dice('(1+2)*3')

    expect(value).toBe(9)
  })

  it('evaluates exponentiation', () => {
    const [value] = dice('2^3')

    expect(value).toBe(8)
  })

  it('evaluates unary signs', () => {
    const [value] = dice('-1+3')

    expect(value).toBe(2)
  })

  it('uses integer division as defined by the OneDice V1 standard', () => {
    const [value] = dice('8/3')

    expect(value).toBe(2)
  })
})
