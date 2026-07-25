import { parse } from './parser'
import { createRollValue, createTrace, RollResult } from './trace'
import { attachEvaluationContext, createEvaluationContext, getEvaluationContext } from './evaluation/context'
import { random } from './utils'
import { DiceNode } from './ast'
import { Config, normalizeFeatureFlags, normalizeSyntax } from './config'
import {
  createProgramVariableSnapshot,
  parseProgramAssignment,
  parseProgramStatements,
  ProgramResult,
  ProgramVariableSnapshot,
} from './program'

export * from './ast'
export * from './parser'
export * from './utils'
export * from './errors'
export * from './trace'
export * from './evaluation/value'
export * from './evaluation/context'
export * from './config'
export * from './program'

export function dice(input: string, config: Config = {}): [number, DiceNode] {
  const { value, root } = evaluate(input, config)
  return [value, root]
}
export function roll(input: string, config: Config = {}): RollResult {
  const { value, root, diagnostics } = evaluate(input, config)
  return {
    value,
    raw: createRollValue(root),
    root,
    trace: createTrace(root),
    diagnostics,
  }
}

function evaluate(input: string, config: Config = {}) {
  const normalizedConfig = getConfig(config)
  const context = getEvaluationContext(config) ?? createEvaluationContext(normalizedConfig)
  const diagnosticsStart = context.diagnostics.length
  const previousInput = context.currentInput
  context.currentInput = input
  const evaluationConfig = attachEvaluationContext(normalizedConfig, context)

  try {
    const root = parse(input, evaluationConfig) as DiceNode
    const value = root.eval(evaluationConfig)
    return {
      value,
      root,
      context,
      diagnostics: context.diagnostics.slice(diagnosticsStart),
    }
  } finally {
    context.currentInput = previousInput
  }
}

function getConfig(config: Config = {}): Config {
  return {
    random,
    maxRollCount: 10000,
    env: {},
    ...config,
    syntax: normalizeSyntax(config.syntax),
    features: normalizeFeatureFlags(config.features),
    d: {
      a: 1, b: 100, c: null, d: 0, e: null,
      ...config.d
    },
    p: {
      a: null, b: 1,
      ...config.p
    },
    a: {
      a: null, b: null, c: 8, d: null, e: 10,
      ...config.a
    },
    c: {
      a: null, b: null, c: 10,
      ...config.c
    },
    f: {
      a: 4, b: 3,
      ...config.f
    },
  }
}

export function rollProgram(input: string, config: Config = {}): ProgramResult {
  const normalizedConfig = getConfig({
    ...config,
    features: {
      ...config.features,
      program: true,
    },
  })
  const context = getEvaluationContext(config) ?? createEvaluationContext(normalizedConfig)
  const statements = parseProgramStatements(input)
  const statementTraces = statements.map((statement) => {
    const assignment = parseProgramAssignment(statement)
    const result = roll(
      assignment?.expression ?? statement.expression,
      attachEvaluationContext(normalizedConfig, context),
    )
    const assignedVariable = assignment
      ? createProgramVariableSnapshot(
        assignment.name,
        assignment.nameRange,
        result,
        statement.index,
      )
      : undefined

    if (assignedVariable) {
      context.variables.set(assignedVariable.name, assignedVariable, {
        range: assignedVariable.range,
      })
    }

    return {
      index: statement.index,
      expression: statement.expression,
      range: statement.range,
      result,
      ...(assignedVariable ? { assignedVariable } : {}),
      diagnostics: result.diagnostics,
    }
  })
  const finalStatement = statementTraces[statementTraces.length - 1]

  return {
    input,
    value: finalStatement.result.value,
    raw: finalStatement.result.raw,
    statements: statementTraces,
    variables: context.variables.snapshot() as Record<string, ProgramVariableSnapshot>,
    diagnostics: [...context.diagnostics],
    budget: { ...context.budget },
  }
}