import { OneDiceError } from './errors'
import type { EvaluationBudget } from './evaluation/context'
import type { RollValue } from './evaluation/value'
import type { RollDiagnostic, RollResult, SourceRange } from './trace'

export interface ProgramVariableSnapshot {
  name: string
  range?: SourceRange
  raw: RollValue
  value: number
  assignedAtStatement: number
}

export interface ProgramStatementTrace {
  index: number
  expression: string
  range: SourceRange
  result: RollResult
  assignedVariable?: ProgramVariableSnapshot
  diagnostics: RollDiagnostic[]
}

export interface ProgramResult {
  input: string
  value: number
  raw: RollResult['raw']
  statements: ProgramStatementTrace[]
  variables: Record<string, ProgramVariableSnapshot>
  diagnostics: RollDiagnostic[]
  budget: EvaluationBudget
}

export interface ProgramStatement {
  index: number
  expression: string
  range: SourceRange
}

export interface ProgramAssignment {
  name: string
  nameRange: SourceRange
  expression: string
  expressionRange: SourceRange
}

export function parseProgramStatements(input: string): ProgramStatement[] {
  if (input.trim().length === 0) {
    throw new OneDiceError(
      'PARSE_UNEXPECTED_END',
      'Program input is empty',
      {
        input,
        actual: '$',
        expected: ['expression'],
        range: { start: input.length, end: input.length },
        hint: 'Add at least one dice expression.',
      },
    )
  }

  const statements: ProgramStatement[] = []
  let statementStart = 0
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (braceDepth > 0) {
      if (char === '}') braceDepth -= 1
      continue
    }

    if (char === '{') {
      braceDepth += 1
      continue
    }

    if (char === '(') {
      parenDepth += 1
      continue
    }

    if (char === ')') {
      if (parenDepth > 0) parenDepth -= 1
      continue
    }

    if (char === '[') {
      bracketDepth += 1
      continue
    }

    if (char === ']') {
      if (bracketDepth > 0) bracketDepth -= 1
      continue
    }

    if (char === ';' && parenDepth === 0 && bracketDepth === 0) {
      pushProgramStatement(input, statements, statementStart, index)
      statementStart = index + 1
    }
  }

  pushProgramStatement(input, statements, statementStart, input.length)
  return statements
}

export function parseProgramAssignment(statement: ProgramStatement): ProgramAssignment | null {
  const input = statement.expression
  const leadingWhitespace = input.match(/^\s*/)?.[0].length ?? 0
  const offset = statement.range.start + leadingWhitespace
  const body = input.slice(leadingWhitespace)
  const assignmentMatch = body.match(/^(\$(?:\d+|t[A-Za-z_]\w*?))e\(/)
  if (!assignmentMatch) return null

  const name = assignmentMatch[1]
  const assignmentStart = leadingWhitespace + name.length
  const bodyStart = assignmentStart + 2
  let depth = 1
  let closeIndex = -1
  for (let index = bodyStart; index < input.length; index += 1) {
    const char = input[index]
    if (char === '(') depth += 1
    if (char === ')') depth -= 1
    if (depth === 0) {
      closeIndex = index
      break
    }
  }

  if (closeIndex < 0) return null
  if (input.slice(closeIndex + 1).trim().length > 0) return null

  return {
    name,
    nameRange: { start: offset, end: offset + name.length },
    expression: input.slice(bodyStart, closeIndex),
    expressionRange: {
      start: statement.range.start + bodyStart,
      end: statement.range.start + closeIndex,
    },
  }
}

export function createProgramVariableSnapshot(
  name: string,
  range: SourceRange,
  result: RollResult,
  assignedAtStatement: number,
): ProgramVariableSnapshot {
  return {
    name,
    range,
    raw: cloneRollValue(result.raw),
    value: result.value,
    assignedAtStatement,
  }
}

function pushProgramStatement(
  input: string,
  statements: ProgramStatement[],
  start: number,
  end: number,
) {
  const expression = input.slice(start, end)
  const index = statements.length

  if (expression.trim().length === 0) {
    throw new OneDiceError(
      'PROGRAM_EMPTY_STATEMENT',
      'Program statements must not be empty',
      {
        input,
        index,
        range: { start, end },
        hint: 'Remove the extra semicolon or add an expression.',
      },
    )
  }

  statements.push({
    index,
    expression,
    range: { start, end },
  })
}

function cloneRollValue(value: RollValue): RollValue {
  if (value.kind === 'scalar') {
    return {
      ...value,
      ...(value.roll ? { roll: { ...value.roll } } : {}),
    }
  }

  return {
    ...value,
    items: value.items.map(cloneRollValue),
    ...(value.selected ? { selected: [...value.selected] } : {}),
    ...(value.dropped ? { dropped: [...value.dropped] } : {}),
  }
}
