import { describe, expect, it } from 'vitest'
import { OneDiceError, projectToNumber, RollValue } from '../../src'

describe('RollValue projection', () => {
  it('projects scalar values directly', () => {
    expect(projectToNumber({ kind: 'scalar', value: 7 })).toBe(7)
  })

  it('projects tuple values by sum', () => {
    const value: RollValue = {
      kind: 'tuple',
      projection: 'sum',
      source: 'dice-rolls',
      items: [
        { kind: 'scalar', value: 11 },
        { kind: 'scalar', value: 7 },
      ],
    }

    expect(projectToNumber(value)).toBe(18)
  })

  it('projects dice tuples using selected roll items only', () => {
    const value: RollValue = {
      kind: 'tuple',
      projection: 'sum',
      source: 'dice-rolls',
      items: [
        {
          kind: 'scalar',
          value: 11,
          roll: { index: 0, randomCall: 1, selected: true, dropped: false, source: 'base' },
        },
        {
          kind: 'scalar',
          value: 7,
          roll: { index: 1, randomCall: 2, selected: false, dropped: true, source: 'base' },
        },
      ],
    }

    expect(projectToNumber(value)).toBe(11)
  })
  it('projects tuple values by last item', () => {
    const value: RollValue = {
      kind: 'tuple',
      projection: 'last',
      items: [
        { kind: 'scalar', value: 11 },
        { kind: 'scalar', value: 7 },
      ],
    }

    expect(projectToNumber(value, 'last')).toBe(7)
  })

  it('rejects empty tuple projections with a stable error code', () => {
    const value: RollValue = {
      kind: 'tuple',
      projection: 'sum',
      items: [],
    }

    try {
      projectToNumber(value, 'sum', { start: 4, end: 6 })
      throw new Error('Expected projectToNumber to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('TUPLE_EMPTY_PROJECTION')
      expect((error as OneDiceError).meta).toMatchObject({
        operator: 'sum',
        range: { start: 4, end: 6 },
      })
    }
  })

  it('rejects identity projection through scalar consumers', () => {
    const value: RollValue = {
      kind: 'tuple',
      projection: 'identity',
      items: [{ kind: 'scalar', value: 1 }],
    }

    try {
      projectToNumber(value, 'identity', { start: 1, end: 8 })
      throw new Error('Expected projectToNumber to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('TUPLE_CANNOT_PROJECT')
      expect((error as OneDiceError).meta).toMatchObject({
        operator: 'identity',
        range: { start: 1, end: 8 },
      })
    }
  })

  it('propagates range through recursive last projection failures', () => {
    const value: RollValue = {
      kind: 'tuple',
      projection: 'last',
      items: [
        {
          kind: 'tuple',
          projection: 'sum',
          items: [],
        },
      ],
    }

    try {
      projectToNumber(value, 'last', { start: 2, end: 9 })
      throw new Error('Expected projectToNumber to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('TUPLE_EMPTY_PROJECTION')
      expect((error as OneDiceError).meta).toMatchObject({
        operator: 'sum',
        range: { start: 2, end: 9 },
      })
    }
  })

  it('propagates range through recursive sum projection failures', () => {
    const value: RollValue = {
      kind: 'tuple',
      projection: 'sum',
      items: [
        {
          kind: 'tuple',
          projection: 'sum',
          items: [],
        },
      ],
    }

    try {
      projectToNumber(value, 'sum', { start: 3, end: 12 })
      throw new Error('Expected projectToNumber to throw')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('TUPLE_EMPTY_PROJECTION')
      expect((error as OneDiceError).meta).toMatchObject({
        operator: 'sum',
        range: { start: 3, end: 12 },
      })
    }
  })
})
