export type OneDiceErrorCode =
  | 'PARSE_UNEXPECTED_TOKEN'
  | 'PARSE_UNEXPECTED_END'
  | 'PARSE_UNSUPPORTED_SYNTAX'
  | 'PROGRAM_EMPTY_STATEMENT'
  | 'DICE_INVALID_FACE_COUNT'
  | 'DICE_INVALID_DICE_COUNT'
  | 'DICE_INVALID_KEEP_COUNT'
  | 'DICE_INCOMPATIBLE_MODIFIERS'
  | 'DICE_POOL_MODIFIER_EXCLUSIVE'
  | 'DICE_TOO_MANY_ROLLS'
  | 'PERCENTILE_INVALID_BONUS_PENALTY_COUNT'
  | 'EVALUATION_BUDGET_EXCEEDED'
  | 'VARIABLE_NOT_FOUND'
  | 'VARIABLE_INVALID_VALUE'
  | 'VARIABLE_RESOLVER_FAILED'
  | 'VARIABLE_READONLY'
  | 'TUPLE_REQUIRED'
  | 'TUPLE_EMPTY_PROJECTION'
  | 'TUPLE_CANNOT_PROJECT'
  | 'TUPLE_INVALID_SLICE_INDEX'
  | 'TUPLE_INVALID_SLICE_STEP'
  | 'TUPLE_INVALID_SLICE_ARITY'
  | 'TUPLE_SLICE_OUT_OF_RANGE'
  | 'TUPLE_INVALID_SLICE_RANGE'
  | 'LOOP_INVALID_BOUNDS_ARITY'
  | 'LOOP_INVALID_BOUND'
  | 'LOOP_INVALID_STEP'
  | 'LOOP_INVALID_RANGE'

export interface OneDiceErrorMeta {
  input?: string
  range?: { start: number; end: number }
  operator?: string
  feature?: string
  featureEnabled?: boolean
  syntax?: string
  expected?: string[] | number[]
  actual?: unknown
  limit?: number
  min?: number
  max?: number
  received?: unknown
  index?: number
  start?: number
  end?: number
  step?: number
  budgetKind?: string
  diceCount?: number
  faceCount?: number
  keepCount?: number
  bonusPenaltyCount?: number
  poolThreshold?: number
  modifier?: string
  conflictWith?: string
  leftModifier?: string
  rightModifier?: string
  poolModifier?: string
  conflictingModifier?: string
  variable?: string
  availableVariables?: string[]
  hint?: string
}

export class OneDiceError extends Error {
  name = 'OneDiceError'

  constructor(
    public code: OneDiceErrorCode,
    message: string,
    public meta: OneDiceErrorMeta = {},
  ) {
    super(message)
  }
}

