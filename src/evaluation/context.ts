import type { Config, NormalizedRollFeatureFlags, SyntaxMode } from '../config'
import { normalizeFeatureFlags, normalizeSyntax } from '../config'
import { OneDiceError } from '../errors'
import { random as defaultRandom } from '../utils'

const DEFAULT_RANDOM_CALL_LIMIT = 10000

export interface EvaluationContext {
  random: RandomSource
  budget: EvaluationBudget
  variables: VariableStore
  diagnostics: EvaluationDiagnostic[]
  syntax: SyntaxMode
  features: NormalizedRollFeatureFlags
  currentInput: string
  currentRange?: { start: number; end: number }
  randomBudgetSource: RandomBudgetSource
}

export type RandomBudgetSource = 'maxRandomCalls' | 'maxRollCount'

export interface RandomSource {
  nextInt(min: number, max: number): number
}

export interface EvaluationBudget {
  maxRandomCalls: number
  randomCalls: number
  maxEvaluationSteps: number
  evaluationSteps: number
  maxLoopIterations: number
  loopIterations: number
  maxLoopDepth: number
  loopDepth: number
}

export interface VariableStore {
  get(name: string): unknown
  set(name: string, value: unknown, options?: VariableMutationOptions): void
  delete(name: string, options?: VariableMutationOptions): void
  isReadonly(name: string): boolean
  snapshot(): Record<string, unknown>
}

export interface VariableMutationOptions {
  readonly?: boolean
  force?: boolean
  range?: { start: number; end: number }
}

export interface EvaluationDiagnostic {
  code: 'SYNTAX_NORMALIZED'
  severity: 'info' | 'warning'
  message: string
  range?: { start: number; end: number }
  feature?: string
  original?: string
  normalized?: string
}

export interface ConfigWithEvaluationContext extends Config {
  __context?: EvaluationContext
}

export function createEvaluationContext(config: Config = {}): EvaluationContext {
  const budget: EvaluationBudget = {
    maxRandomCalls: config.maxRandomCalls ?? config.maxRollCount ?? DEFAULT_RANDOM_CALL_LIMIT,
    randomCalls: 0,
    maxEvaluationSteps: config.maxEvaluationSteps ?? Number.MAX_SAFE_INTEGER,
    evaluationSteps: 0,
    maxLoopIterations: config.maxLoopIterations ?? 10000,
    loopIterations: 0,
    maxLoopDepth: config.maxLoopDepth ?? 32,
    loopDepth: 0,
  }
  const context: EvaluationContext = {
    random: null as unknown as RandomSource,
    budget,
    variables: createVariableStore(),
    diagnostics: [],
    syntax: normalizeSyntax(config.syntax),
    features: normalizeFeatureFlags(config.features),
    currentInput: '',
    currentRange: undefined,
    randomBudgetSource: config.maxRandomCalls === undefined ? 'maxRollCount' : 'maxRandomCalls',
  }

  context.random = createBudgetedRandomSource(config.random ?? defaultRandom, budget, () => context.currentRange)
  return context
}

export function attachEvaluationContext<TConfig extends Config>(
  config: TConfig,
  context: EvaluationContext = createEvaluationContext(config),
): TConfig & ConfigWithEvaluationContext {
  const maxRollCount = context.randomBudgetSource === 'maxRandomCalls'
    ? Math.max(DEFAULT_RANDOM_CALL_LIMIT, context.budget.maxRandomCalls)
    : config.maxRollCount ?? context.budget.maxRandomCalls

  return {
    ...config,
    random: (min: number, max: number) => context.random.nextInt(min, max),
    maxRollCount,
    maxRandomCalls: context.budget.maxRandomCalls,
    maxEvaluationSteps: context.budget.maxEvaluationSteps,
    maxLoopIterations: context.budget.maxLoopIterations,
    maxLoopDepth: context.budget.maxLoopDepth,
    syntax: context.syntax,
    features: context.features,
    __context: context,
  }
}

export function getEvaluationContext(config: Config): EvaluationContext | undefined {
  return (config as ConfigWithEvaluationContext).__context
}

export function withEvaluationRange<T>(
  config: Config,
  range: { start: number; end: number } | undefined,
  callback: () => T,
): T {
  const context = getEvaluationContext(config)
  if (!context || !range || context.currentRange) return callback()

  const previousRange = context.currentRange
  context.currentRange = range
  try {
    return callback()
  } finally {
    context.currentRange = previousRange
  }
}

function createBudgetedRandomSource(
  random: (min: number, max: number) => number,
  budget: EvaluationBudget,
  getCurrentRange: () => { start: number; end: number } | undefined,
): RandomSource {
  return {
    nextInt(min: number, max: number) {
      if (budget.randomCalls + 1 > budget.maxRandomCalls) {
        throw new OneDiceError(
          'EVALUATION_BUDGET_EXCEEDED',
          'Random call budget exceeded',
          {
            operator: 'random',
            budgetKind: 'randomCalls',
            actual: budget.randomCalls + 1,
            limit: budget.maxRandomCalls,
            ...(getCurrentRange() ? { range: getCurrentRange() } : {}),
            hint: 'Reduce the number of dice or increase maxRandomCalls/maxRollCount.',
          },
        )
      }

      budget.randomCalls += 1
      return random(min, max)
    },
  }
}

function createVariableStore(): VariableStore {
  const values: Record<string, unknown> = {}
  const readonlyNames = new Set<string>()

  return {
    get(name: string) {
      return values[name]
    },
    set(name: string, value: unknown, options: VariableMutationOptions = {}) {
      if (readonlyNames.has(name) && !options.force) {
        throw new OneDiceError(
          'VARIABLE_READONLY',
          `Variable is readonly: ${name}`,
          {
            variable: name,
            ...(options.range ? { range: options.range } : {}),
            hint: 'This variable is maintained by an operator and cannot be overwritten.',
          },
        )
      }

      values[name] = value
      if (options.readonly) {
        readonlyNames.add(name)
      } else {
        readonlyNames.delete(name)
      }
    },
    delete(name: string, options: VariableMutationOptions = {}) {
      if (readonlyNames.has(name) && !options.force) {
        throw new OneDiceError(
          'VARIABLE_READONLY',
          `Variable is readonly: ${name}`,
          {
            variable: name,
            ...(options.range ? { range: options.range } : {}),
            hint: 'This variable is maintained by an operator and cannot be deleted.',
          },
        )
      }

      delete values[name]
      readonlyNames.delete(name)
    },
    isReadonly(name: string) {
      return readonlyNames.has(name)
    },
    snapshot() {
      return { ...values }
    },
  }
}

export type EvaluationBudgetKind =
  | 'randomCalls'
  | 'evaluationSteps'
  | 'loopIterations'
  | 'loopDepth'

export function consumeEvaluationStep(
  context: EvaluationContext,
  operator = 'eval',
  range?: { start: number; end: number },
): void {
  const actual = context.budget.evaluationSteps + 1
  if (actual > context.budget.maxEvaluationSteps) {
    throwBudgetExceeded('evaluationSteps', operator, actual, context.budget.maxEvaluationSteps, range)
  }

  context.budget.evaluationSteps = actual
}

export function reserveLoopIterations(
  context: EvaluationContext,
  count: number,
  range?: { start: number; end: number },
): void {
  const actual = context.budget.loopIterations + count
  if (actual > context.budget.maxLoopIterations) {
    throwBudgetExceeded('loopIterations', 'lp', actual, context.budget.maxLoopIterations, range)
  }

  context.budget.loopIterations = actual
}

export function enterLoop(context: EvaluationContext, range?: { start: number; end: number }): void {
  const actual = context.budget.loopDepth + 1
  if (actual > context.budget.maxLoopDepth) {
    throwBudgetExceeded('loopDepth', 'lp', actual, context.budget.maxLoopDepth, range)
  }

  context.budget.loopDepth = actual
}

export function exitLoop(context: EvaluationContext): void {
  context.budget.loopDepth = Math.max(0, context.budget.loopDepth - 1)
}

function throwBudgetExceeded(
  budgetKind: EvaluationBudgetKind,
  operator: string,
  actual: number,
  limit: number,
  range?: { start: number; end: number },
): never {
  throw new OneDiceError(
    'EVALUATION_BUDGET_EXCEEDED',
    `${budgetKind} budget exceeded`,
    {
      operator,
      budgetKind,
      actual,
      limit,
      ...(range ? { range } : {}),
      hint: budgetHint(budgetKind),
    },
  )
}

function budgetHint(budgetKind: EvaluationBudgetKind): string {
  switch (budgetKind) {
    case 'randomCalls':
      return 'Reduce the number of dice or increase maxRandomCalls/maxRollCount.'
    case 'evaluationSteps':
      return 'Reduce expression complexity or increase maxEvaluationSteps.'
    case 'loopIterations':
      return 'Reduce the loop bounds or increase maxLoopIterations.'
    case 'loopDepth':
      return 'Reduce nested lp loops or increase maxLoopDepth.'
  }
}
