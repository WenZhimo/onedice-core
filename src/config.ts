import type { RollValue } from './evaluation/value'

export type SyntaxMode = 'onedice' | 'fvtt-compatible'

export interface VariableResolverContext {
  syntax: 'fvtt-compatible'
  range?: { start: number; end: number }
  originalInput: string
}

export type VariableResolver = (
  path: string,
  context: VariableResolverContext,
) => string | number | RollValue | undefined

export interface RollFeatureFlags {
  tupleLiterals?: boolean
  tupleOperators?: boolean
  clampOperators?: boolean
  tupleProjection?: boolean
  tupleSlice?: boolean
  loopOperator?: boolean
  conditionals?: boolean
  program?: boolean
  fateAlias?: boolean
  fvttSuccessCounting?: boolean
  variableAliases?: boolean
}

export type NormalizedRollFeatureFlags = Required<RollFeatureFlags>

export const DEFAULT_FEATURES: NormalizedRollFeatureFlags = {
  tupleLiterals: false,
  tupleOperators: false,
  clampOperators: false,
  tupleProjection: false,
  tupleSlice: false,
  loopOperator: false,
  conditionals: false,
  program: false,
  fateAlias: false,
  fvttSuccessCounting: false,
  variableAliases: false,
}

export interface Config {
  random?: (min: number, max: number) => number
  maxRollCount?: number
  maxRandomCalls?: number
  maxEvaluationSteps?: number
  maxLoopIterations?: number
  maxLoopDepth?: number
  syntax?: SyntaxMode
  features?: RollFeatureFlags
  env?: Record<string, string | number>
  resolver?: VariableResolver
  d?: { a?: number, b?: number, c?: number, d?: number, e?: number }
  p?: { a?: number, b?: number }
  a?: { a?: number, b?: number, c?: number, d?: number, e?: number }
  c?: { a?: number, b?: number, c?: number }
  f?: { a?: number, b?: number }
}

export function normalizeSyntax(syntax: SyntaxMode = 'onedice'): SyntaxMode {
  return syntax
}

export function normalizeFeatureFlags(features: RollFeatureFlags = {}): NormalizedRollFeatureFlags {
  return {
    ...DEFAULT_FEATURES,
    ...features,
  }
}
