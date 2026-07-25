import { describe, expect, it } from 'vitest'
import { dice, OneDiceError, OneDiceErrorCode, rollProgram } from '../../src'
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

describe('rollProgram M9a statement shell', () => {
  it('evaluates semicolon-separated statements and returns the final statement result', () => {
    const result = rollProgram('1d6;2d6', {
      random: sequenceRandom([4, 2, 5]),
    })

    expect(result.value).toBe(7)
    expect(result.raw.kind).toBe('tuple')
    expect(result.statements).toHaveLength(2)
    expect(result.statements[0]).toMatchObject({
      index: 0,
      expression: '1d6',
      range: { start: 0, end: 3 },
      result: { value: 4 },
    })
    expect(result.statements[1]).toMatchObject({
      index: 1,
      expression: '2d6',
      range: { start: 4, end: 7 },
      result: { value: 7 },
    })
    expect(result.budget.randomCalls).toBe(3)
    expect(result.diagnostics).toEqual([])
  })

  it('shares the random budget across all statements', () => {
    const error = expectOneDiceError(
      () => rollProgram('1d6;1d6;1d6', {
        random: sequenceRandom([1, 2, 3]),
        maxRollCount: 2,
      }),
      'EVALUATION_BUDGET_EXCEEDED',
    )

    expect(error.meta).toMatchObject({
      actual: 3,
      limit: 2,
    })
  })

  it('does not split semicolons inside interpolation braces', () => {
    const result = rollProgram('{attack;bonus};1d6', {
      env: {
        'attack;bonus': '2',
      },
      random: sequenceRandom([5]),
    })

    expect(result.value).toBe(5)
    expect(result.statements).toHaveLength(2)
    expect(result.statements[0]).toMatchObject({
      expression: '{attack;bonus}',
      range: { start: 0, end: 14 },
      result: { value: 2 },
    })
    expect(result.statements[1]).toMatchObject({
      expression: '1d6',
      range: { start: 15, end: 18 },
      result: { value: 5 },
    })
  })

  it('keeps semicolon syntax out of the legacy dice API', () => {
    const error = expectOneDiceError(
      () => dice('1;2'),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input: '1;2',
      operator: ';',
      feature: 'program',
      featureEnabled: false,
      range: { start: 1, end: 2 },
    })
  })
  it('rejects empty program input', () => {
    const error = expectOneDiceError(
      () => rollProgram(''),
      'PARSE_UNEXPECTED_END',
    )

    expect(error.meta).toMatchObject({
      input: '',
      actual: '$',
      range: { start: 0, end: 0 },
    })
  })

  it('rejects empty statements instead of silently skipping them', () => {
    const error = expectOneDiceError(
      () => rollProgram('1d6;'),
      'PROGRAM_EMPTY_STATEMENT',
    )

    expect(error.meta).toMatchObject({
      input: '1d6;',
      index: 1,
      range: { start: 4, end: 4 },
    })
  })

  it('rejects consecutive semicolons with the empty statement index', () => {
    const error = expectOneDiceError(
      () => rollProgram('1d6;;2d6'),
      'PROGRAM_EMPTY_STATEMENT',
    )

    expect(error.meta).toMatchObject({
      input: '1d6;;2d6',
      index: 1,
      range: { start: 4, end: 4 },
    })
  })
})

describe('rollProgram M9b program variables', () => {
  it('assigns a dice tuple to a numeric register and reads it in a later statement', () => {
    const result = rollProgram('$0e(2d6);$0+1', {
      random: sequenceRandom([2, 5]),
    })

    expect(result.value).toBe(8)
    expect(result.statements).toHaveLength(2)
    expect(result.statements[0].assignedVariable).toMatchObject({
      name: '$0',
      value: 7,
      assignedAtStatement: 0,
      raw: {
        kind: 'tuple',
        projection: 'sum',
        source: 'dice-rolls',
      },
    })
    expect(result.variables['$0']).toMatchObject({
      name: '$0',
      value: 7,
      assignedAtStatement: 0,
      raw: {
        kind: 'tuple',
        projection: 'sum',
        source: 'dice-rolls',
      },
    })
    expect(result.variables['$0'].raw.kind).toBe('tuple')
    if (result.variables['$0'].raw.kind === 'tuple') {
      expect(result.variables['$0'].raw.items.map(item => item.kind === 'scalar' ? item.value : NaN)).toEqual([2, 5])
    }
    expect(result.statements[1].result.trace).toMatchObject({
      kind: 'binary',
      operator: '+',
      left: 7,
      right: 1,
      value: 8,
    })
    expect(result.statements[1].result.trace.kind).toBe('binary')
    if (result.statements[1].result.trace.kind === 'binary') {
      expect(result.statements[1].result.trace.children[0]).toMatchObject({
        kind: 'variable',
        name: '$0',
        value: 7,
        assignedAtStatement: 0,
        raw: { kind: 'tuple' },
      })
    }
  })

  it('overwrites a register and exposes the latest variable snapshot', () => {
    const result = rollProgram('$0e(1);$0e(2);$0')

    expect(result.value).toBe(2)
    expect(result.variables['$0']).toMatchObject({
      name: '$0',
      value: 2,
      assignedAtStatement: 1,
      raw: { kind: 'scalar', value: 2 },
    })
    expect(result.statements[0].assignedVariable).toMatchObject({
      name: '$0',
      value: 1,
      assignedAtStatement: 0,
    })
  })

  it('assigns and reads a named temporary variable', () => {
    const result = rollProgram('$tTotale(2d6);$tTotal', {
      random: sequenceRandom([3, 4]),
    })

    expect(result.value).toBe(7)
    expect(result.variables['$tTotal']).toMatchObject({
      name: '$tTotal',
      value: 7,
      assignedAtStatement: 0,
      raw: { kind: 'tuple' },
    })
    expect(result.statements[1].result.trace).toMatchObject({
      kind: 'variable',
      name: '$tTotal',
      value: 7,
      assignedAtStatement: 0,
    })
  })

  it('throws a structured error when reading a missing program variable', () => {
    const error = expectOneDiceError(
      () => rollProgram('$0'),
      'VARIABLE_NOT_FOUND',
    )

    expect(error.meta).toMatchObject({
      actual: '$0',
      variable: '$0',
      availableVariables: [],
      range: { start: 0, end: 2 },
    })
  })

  it('keeps program variables out of the legacy dice API', () => {
    const error = expectOneDiceError(
      () => dice('$0'),
      'PARSE_UNSUPPORTED_SYNTAX',
    )

    expect(error.meta).toMatchObject({
      input: '$0',
      operator: '$',
      feature: 'program',
      featureEnabled: false,
      range: { start: 0, end: 1 },
    })
  })
})

describe('rollProgram M9b variable raw consumers', () => {
  it('lets tuple operators consume a stored variable raw value', () => {
    const result = rollProgram('$0e(2d6);$0kh1', {
      random: sequenceRandom([2, 5]),
      features: { tupleOperators: true },
    })

    expect(result.value).toBe(5)
    expect(result.variables['$0']).toMatchObject({
      value: 7,
      raw: { kind: 'tuple', source: 'dice-rolls' },
    })
    expect(result.statements[1].result.trace).toMatchObject({
      kind: 'tuple-selection',
      operator: 'kh',
      selectedIndexes: [1],
      droppedIndexes: [0],
      value: 5,
    })
  })

  it('returns cloned raw values when reading variables', () => {
    const result = rollProgram('$0e(2d6);$0', {
      random: sequenceRandom([2, 5]),
    })

    const storedRaw = result.variables['$0'].raw
    const readRaw = result.statements[1].result.raw

    expect(readRaw).toEqual(storedRaw)
    expect(readRaw).not.toBe(storedRaw)
    expect(result.statements[1].result.trace).toMatchObject({
      kind: 'variable',
      raw: storedRaw,
    })

    if (result.statements[1].result.trace.kind === 'variable') {
      expect(result.statements[1].result.trace.raw).toEqual(storedRaw)
      expect(result.statements[1].result.trace.raw).not.toBe(storedRaw)
    }
  })
})
