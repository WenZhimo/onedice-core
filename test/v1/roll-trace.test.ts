import { describe, expect, it } from 'vitest'
import { OneDiceError, projectToNumber, roll } from '../../src'
import { sequenceRandom } from '../helpers/random'

describe('structured roll trace API', () => {
  it('returns a JSON-friendly trace and raw value for ordinary d rolls', () => {
    const result = roll('2d20k1', {
      random: sequenceRandom([11, 7]),
    })

    expect(result.value).toBe(11)
    expect(result.raw).toEqual({
      kind: 'tuple',
      items: [
        {
          kind: 'scalar',
          value: 11,
          source: 'literal',
          roll: { index: 0, randomCall: 1, selected: true, dropped: false, source: 'base' },
        },
        {
          kind: 'scalar',
          value: 7,
          source: 'literal',
          roll: { index: 1, randomCall: 2, selected: false, dropped: true, source: 'base' },
        },
      ],
      projection: 'sum',
      source: 'dice-rolls',
    })
    expect(projectToNumber(result.raw)).toBe(11)
    expect(result.diagnostics).toEqual([])
    expect(result.trace).toMatchObject({
      kind: 'dice',
      operator: 'd',
      expression: '2d20k1',
      value: 11,
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
    if (result.trace.kind !== 'dice' || result.raw.kind !== 'tuple') {
      throw new Error('Expected dice trace and tuple raw value')
    }
    expect(result.trace.rolls.map(roll => roll.index)).toEqual(
      result.raw.items.map(item => item.kind === 'scalar' ? item.roll?.index : null),
    )
  })

  it('exposes unmodified d rolls as raw dice tuples', () => {
    const result = roll('2d20', {
      random: sequenceRandom([11, 7]),
    })

    expect(result.value).toBe(18)
    expect(result.raw).toEqual({
      kind: 'tuple',
      items: [
        {
          kind: 'scalar',
          value: 11,
          source: 'literal',
          roll: { index: 0, randomCall: 1, selected: true, dropped: false, source: 'base' },
        },
        {
          kind: 'scalar',
          value: 7,
          source: 'literal',
          roll: { index: 1, randomCall: 2, selected: true, dropped: false, source: 'base' },
        },
      ],
      projection: 'sum',
      source: 'dice-rolls',
    })
    expect(projectToNumber(result.raw)).toBe(18)
  })
  it('returns percentile candidates for COC bonus dice', () => {
    const result = roll('b1', {
      random: sequenceRandom([3, 8, 2]),
    })

    expect(result.value).toBe(23)
    expect(result.trace).toMatchObject({
      kind: 'percentile',
      expression: 'b1',
      value: 23,
      mode: 'bonus',
      ones: 3,
      onesRandomCall: 1,
      baseTens: 8,
      baseTensRandomCall: 2,
      extraTens: [2],
      extraTensRandomCalls: [3],
      candidates: [
        { tens: 8, value: 83, randomCall: 2, source: 'base', selected: false },
        { tens: 2, value: 23, randomCall: 3, source: 'bonus', selected: true },
      ],
      selectedTens: 2,
    })
  })

  it('serializes trace and raw values as JSON', () => {
    const result = roll('b1', {
      random: sequenceRandom([0, 0, 1]),
    })

    const serialized = JSON.parse(JSON.stringify({
      raw: result.raw,
      trace: result.trace,
      diagnostics: result.diagnostics,
    }))

    expect(serialized.raw).toEqual({
      kind: 'scalar',
      value: 10,
      source: 'projection',
    })
    expect(serialized.trace).toMatchObject({
      kind: 'percentile',
      value: 10,
      onesRandomCall: 1,
      baseTensRandomCall: 2,
      extraTensRandomCalls: [3],
      candidates: [
        { tens: 0, value: 100, randomCall: 2, source: 'base', selected: false },
        { tens: 1, value: 10, randomCall: 3, source: 'bonus', selected: true },
      ],
      selectedTens: 1,
    })
    expect(serialized.diagnostics).toEqual([])
  })

  it('returns binary, group, and number traces for arithmetic expressions', () => {
    const result = roll('(1+2)*3')

    expect(result.value).toBe(9)
    expect(result.trace).toMatchObject({
      kind: 'binary',
      operator: '*',
      value: 9,
      left: 3,
      right: 3,
      children: [
        {
          kind: 'group',
          value: 3,
          children: [
            {
              kind: 'binary',
              operator: '+',
              value: 3,
              children: [
                { kind: 'number', value: 1 },
                { kind: 'number', value: 2 },
              ],
            },
          ],
        },
        { kind: 'number', value: 3 },
      ],
    })
  })

  it('returns interpolation traces with the expanded child expression', () => {
    const result = roll('{attack}+1', {
      env: { attack: '1d6' },
      random: sequenceRandom([4]),
    })

    expect(result.value).toBe(5)
    expect(result.trace).toMatchObject({
      kind: 'binary',
      operator: '+',
      value: 5,
      children: [
        {
          kind: 'interpolation',
          key: 'attack',
          input: '1d6',
          expression: '{attack}',
          value: 4,
          children: [
            {
              kind: 'dice',
              expression: '1d6',
              value: 4,
            },
          ],
        },
        { kind: 'number', value: 1 },
      ],
    })
  })

  it('returns a fate trace for f dice', () => {
    const result = roll('3f', {
      random: sequenceRandom([0, 1, 2]),
    })

    expect(result.value).toBe(0)
    expect(result.trace).toMatchObject({
      kind: 'fate',
      operator: 'f',
      expression: '3f3',
      value: 0,
      diceCount: 3,
      faceCount: 3,
      rolls: [
        { index: 0, randomCall: 1, value: 1 },
        { index: 1, randomCall: 2, value: -1 },
        { index: 2, randomCall: 3, value: 0 },
      ],
    })
  })

  it('uses global random call numbers for fate dice after interpolation', () => {
    const result = roll('{seed}+3f', {
      env: { seed: '1d6' },
      random: sequenceRandom([4, 0, 1, 2]),
    })

    expect(result.trace).toMatchObject({
      kind: 'binary',
      children: [
        {
          kind: 'interpolation',
          children: [
            {
              kind: 'dice',
              rolls: [
                { randomCall: 1, value: 4 },
              ],
            },
          ],
        },
        {
          kind: 'fate',
          rolls: [
            { index: 0, randomCall: 2, value: 1 },
            { index: 1, randomCall: 3, value: -1 },
            { index: 2, randomCall: 4, value: 0 },
          ],
        },
      ],
    })
  })

  it('returns pool round traces for a dice pools', () => {
    const result = roll('1a2k1m2', {
      random: sequenceRandom([2, 1]),
    })

    expect(result.value).toBe(2)
    expect(result.trace).toMatchObject({
      kind: 'pool',
      operator: 'a',
      expression: '1a2k1m2',
      value: 2,
      rounds: [
        {
          index: 0,
          rolls: [
            { index: 0, randomCall: 1, value: 2, rerolled: true, selected: true, source: 'base' },
          ],
        },
        {
          index: 1,
          rolls: [
            { index: 0, randomCall: 2, value: 1, rerolled: false, selected: true, source: 'exploded' },
          ],
        },
      ],
    })
  })

  it('uses global random call numbers for a dice pools after interpolation', () => {
    const result = roll('{seed}+1a2k1m2', {
      env: { seed: '1d6' },
      random: sequenceRandom([4, 2, 1]),
    })

    expect(result.trace).toMatchObject({
      kind: 'binary',
      children: [
        {
          kind: 'interpolation',
          children: [
            {
              kind: 'dice',
              rolls: [
                { randomCall: 1, value: 4 },
              ],
            },
          ],
        },
        {
          kind: 'pool',
          operator: 'a',
          rounds: [
            {
              rolls: [
                { randomCall: 2, value: 2 },
              ],
            },
            {
              rolls: [
                { randomCall: 3, value: 1 },
              ],
            },
          ],
        },
      ],
    })
  })
  it('returns unary traces', () => {
    const result = roll('-1')

    expect(result.value).toBe(-1)
    expect(result.trace).toMatchObject({
      kind: 'unary',
      operator: '-',
      value: -1,
      operand: 1,
      children: [
        { kind: 'number', value: 1 },
      ],
    })
  })

  it('returns pool round traces for c dice pools', () => {
    const result = roll('1c2m2', {
      random: sequenceRandom([2, 1]),
    })

    expect(result.value).toBe(3)
    expect(result.trace).toMatchObject({
      kind: 'pool',
      operator: 'c',
      expression: '1c2m2',
      value: 3,
      rounds: [
        {
          index: 0,
          rolls: [
            { index: 0, randomCall: 1, value: 2, rerolled: true, selected: false, source: 'base' },
          ],
        },
        {
          index: 1,
          rolls: [
            { index: 0, randomCall: 2, value: 1, rerolled: false, selected: true, source: 'exploded' },
          ],
        },
      ],
    })
  })

  it('uses global random call numbers for c dice pools after interpolation', () => {
    const result = roll('{seed}+1c2m2', {
      env: { seed: '1d6' },
      random: sequenceRandom([4, 2, 1]),
    })

    expect(result.trace).toMatchObject({
      kind: 'binary',
      children: [
        {
          kind: 'interpolation',
          children: [
            {
              kind: 'dice',
              rolls: [
                { randomCall: 1, value: 4 },
              ],
            },
          ],
        },
        {
          kind: 'pool',
          operator: 'c',
          rounds: [
            {
              rolls: [
                { randomCall: 2, value: 2 },
              ],
            },
            {
              rolls: [
                { randomCall: 3, value: 1 },
              ],
            },
          ],
        },
      ],
    })
  })
  it('includes source ranges in arithmetic traces', () => {
    const result = roll('(1+2)*3')

    expect(result.trace).toMatchObject({
      kind: 'binary',
      range: { start: 0, end: 7 },
      children: [
        {
          kind: 'group',
          range: { start: 0, end: 5 },
          children: [
            {
              kind: 'binary',
              range: { start: 1, end: 4 },
              children: [
                { kind: 'number', range: { start: 1, end: 2 } },
                { kind: 'number', range: { start: 3, end: 4 } },
              ],
            },
          ],
        },
        { kind: 'number', range: { start: 6, end: 7 } },
      ],
    })
  })

  it('includes source ranges in dice-family and interpolation traces', () => {
    expect(roll('2d20k1', {
      random: sequenceRandom([11, 7]),
    }).trace).toMatchObject({
      kind: 'dice',
      range: { start: 0, end: 6 },
    })

    expect(roll('b1', {
      random: sequenceRandom([3, 8, 2]),
    }).trace).toMatchObject({
      kind: 'percentile',
      range: { start: 0, end: 2 },
    })

    expect(roll('3f', {
      random: sequenceRandom([0, 1, 2]),
    }).trace).toMatchObject({
      kind: 'fate',
      range: { start: 0, end: 2 },
    })

    expect(roll('1a2k1m2', {
      random: sequenceRandom([2, 1]),
    }).trace).toMatchObject({
      kind: 'pool',
      range: { start: 0, end: 7 },
    })

    expect(roll('1c2m2', {
      random: sequenceRandom([2, 1]),
    }).trace).toMatchObject({
      kind: 'pool',
      range: { start: 0, end: 5 },
    })

    expect(roll('{attack}+1', {
      env: { attack: '1d6' },
      random: sequenceRandom([4]),
    }).trace).toMatchObject({
      kind: 'binary',
      range: { start: 0, end: 10 },
      children: [
        {
          kind: 'interpolation',
          range: { start: 0, end: 8 },
          children: [
            {
              kind: 'dice',
              range: { start: 0, end: 3 },
            },
          ],
        },
        { kind: 'number', range: { start: 9, end: 10 } },
      ],
    })
  })

  it('records parent and child coordinate systems for interpolation traces', () => {
    const result = roll('{attack}+1', {
      env: { attack: '(1d6+2)' },
      random: sequenceRandom([4]),
    })

    expect(result.value).toBe(7)
    expect(result.trace).toMatchObject({
      kind: 'binary',
      range: { start: 0, end: 10 },
      children: [
        {
          kind: 'interpolation',
          range: { start: 0, end: 8 },
          input: '(1d6+2)',
          childRangeSource: 'input',
          childInputRange: { start: 0, end: 7 },
          children: [
            {
              kind: 'group',
              range: { start: 0, end: 7 },
              children: [
                {
                  kind: 'binary',
                  range: { start: 1, end: 6 },
                  children: [
                    { kind: 'dice', range: { start: 1, end: 4 } },
                    { kind: 'number', range: { start: 5, end: 6 } },
                  ],
                },
              ],
            },
          ],
        },
        { kind: 'number', range: { start: 9, end: 10 } },
      ],
    })
  })

  it('reports missing interpolation values with the outer input range', () => {
    try {
      roll('{attack}+1')
    } catch (error) {
      expect(error).toBeInstanceOf(OneDiceError)
      expect((error as OneDiceError).code).toBe('VARIABLE_NOT_FOUND')
      expect((error as OneDiceError).meta).toMatchObject({
        actual: 'attack',
        range: { start: 0, end: 8 },
      })
      return
    }

    throw new Error('Expected VARIABLE_NOT_FOUND')
  })
})
