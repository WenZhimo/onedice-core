import { DiceNode } from './ast'
import { BracketNode } from './ast/bracket'
import { ClampNode } from './ast/clamp'
import { BooleanNode, ComparisonNode, ConditionalNode } from './ast/conditionals'
import { ANode, CNode, DNode, FNode, PNode } from './ast/dice'
import { InterpolationNode } from './ast/interpolation'
import { LoopNode } from './ast/loop'
import { NumberNode } from './ast/number'
import { SimpleNode } from './ast/simple'
import { SuccessCountNode } from './ast/success-count'
import { TupleNode } from './ast/tuple'
import { TupleProjectionNode } from './ast/tuple-projection'
import { TupleSelectionNode } from './ast/tuple-selection'
import { TupleSliceNode } from './ast/tuple-slice'
import { UnaryNode } from './ast/unary'
import { VariableReferenceNode } from './ast/variable'
import { createScalarValue, RollValue } from './evaluation/value'

export interface SourceRange {
  start: number
  end: number
}

interface TraceRange {
  range?: SourceRange
}

export type RollTrace =
  | GenericRollTrace
  | NumberTrace
  | UnaryTrace
  | BinaryTrace
  | ComparisonTrace
  | BooleanTrace
  | ConditionalTrace
  | ClampTrace
  | GroupTrace
  | TupleTrace
  | TupleProjectionTrace
  | TupleSelectionTrace
  | TupleSliceTrace
  | SuccessCountTrace
  | LoopTrace
  | InterpolationTrace
  | VariableTrace
  | DiceTrace
  | PercentileTrace
  | FateTrace
  | PoolTrace

export interface RollResult {
  value: number
  raw: RollValue
  root: DiceNode
  trace: RollTrace
  diagnostics: RollDiagnostic[]
}

export type RollDiagnosticCode = 'SYNTAX_NORMALIZED'

export interface RollDiagnostic {
  code: RollDiagnosticCode
  severity: 'info' | 'warning'
  message: string
  range?: SourceRange
  feature?: string
  original?: string
  normalized?: string
}

export interface GenericRollTrace extends TraceRange {
  kind: 'generic'
  expression: string
  value: number
  detail: string
}

export interface NumberTrace extends TraceRange {
  kind: 'number'
  expression: string
  value: number
}

export interface UnaryTrace extends TraceRange {
  kind: 'unary'
  operator: string
  expression: string
  value: number
  operand: number
  children: RollTrace[]
}

export interface BinaryTrace extends TraceRange {
  kind: 'binary'
  operator: string
  expression: string
  value: number
  left: number
  right: number
  children: RollTrace[]
}

export interface ComparisonTrace extends TraceRange {
  kind: 'comparison'
  operator: '>' | '<' | '='
  expression: string
  value: number
  left: number
  right: number
  children: RollTrace[]
}

export interface BooleanTrace extends TraceRange {
  kind: 'boolean'
  operator: '&' | '|'
  expression: string
  value: number
  left: number
  right: number
  leftTruthy: boolean
  rightTruthy: boolean
  children: RollTrace[]
}

export interface ConditionalTrace extends TraceRange {
  kind: 'conditional'
  expression: string
  value: number
  conditionValue: number
  selectedBranch: 'consequent' | 'alternate'
  conditionTrace: RollTrace
  selectedTrace: RollTrace
  consequentRange?: SourceRange
  alternateRange?: SourceRange
  raw: RollValue
}

export interface ClampTrace extends TraceRange {
  kind: 'clamp'
  operator: 'min' | 'max'
  expression: string
  value: number
  limit: number
  before: number[]
  after: number[]
  children: RollTrace[]
}

export interface GroupTrace extends TraceRange {
  kind: 'group'
  expression: string
  value: number
  children: RollTrace[]
}

export interface TupleTrace extends TraceRange {
  kind: 'tuple'
  expression: string
  value: number
  projection: 'last'
  items: RollTrace[]
}

export interface TupleSelectionTrace extends TraceRange {
  kind: 'tuple-selection'
  expression: string
  value: number
  operator: 'kh' | 'kl' | 'dh' | 'dl'
  count: number
  inputLength: number
  selectedIndexes: number[]
  droppedIndexes: number[]
  items: TupleSelectionItemTrace[]
  children: RollTrace[]
}

export interface TupleProjectionTrace extends TraceRange {
  kind: 'tuple-projection'
  expression: string
  value: number
  operator: 'tp'
  projection: 'sum' | 'last' | 'identity'
  sourceKind: RollValue['kind']
  sourceRange?: SourceRange
  itemCount: number
  items: TupleProjectionItemTrace[]
  children: RollTrace[]
}

export interface TupleProjectionItemTrace {
  index: number
  value: number
  selected?: boolean
  dropped?: boolean
  randomCall?: number
  source?: string
}

export interface TupleSelectionItemTrace {
  index: number
  value: number
  selected: boolean
  dropped: boolean
}

export interface TupleSliceTrace extends TraceRange {
  kind: 'tuple-slice'
  expression: string
  value: number
  operator: 'sp'
  arity: 1 | 2 | 3
  inputLength: number
  sourceIndexes: number[]
  resultIndexes: number[]
  start: number
  end: number
  step: number
  leftBoundary?: number
  items: TupleProjectionItemTrace[]
  children: RollTrace[]
}

export interface SuccessCountTrace extends TraceRange {
  kind: 'success-count'
  expression: string
  value: number
  operator: 'cs'
  comparator: '>' | '>=' | '<' | '<=' | '='
  target: number
  inputLength: number
  successIndexes: number[]
  failureIndexes: number[]
  items: SuccessCountItemTrace[]
  children: RollTrace[]
}

export interface SuccessCountItemTrace {
  index: number
  value: number
  success: boolean
  counted: boolean
}

export interface LoopTrace extends TraceRange {
  kind: 'loop'
  expression: string
  value: number
  operator: 'lp'
  boundsTrace: RollTrace
  bounds: { start: number; end: number; step: number }
  itemCount: number
  iterations: Array<{
    index: number
    variable: 'i'
    value: number
    body: RollTrace
    raw: RollValue
  }>
}
export interface InterpolationTrace extends TraceRange {
  kind: 'interpolation'
  key: string
  input: string
  childRangeSource: 'input'
  childInputRange: SourceRange
  expression: string
  value: number
  children: RollTrace[]
}

export interface VariableTrace extends TraceRange {
  kind: 'variable'
  name: string
  expression: string
  value: number
  assignedAtStatement: number
  raw: RollValue
}

export interface DiceTrace extends TraceRange {
  kind: 'dice'
  operator: 'd'
  expression: string
  value: number
  diceCount: number
  faceCount: number
  rolls: DiceRollTrace[]
  modifiers: DiceModifierTrace[]
  children?: RollTrace[]
}

export interface DiceRollTrace {
  index: number
  randomCall: number
  value: number
  selected: boolean
  dropped: boolean
  source: 'base' | 'bonus' | 'penalty' | 'exploded' | 'rerolled'
}

export interface DiceModifierTrace {
  kind: 'selection' | 'bonusPenalty' | 'pool'
  operator: string
  count?: number
  threshold?: number
}

export interface PercentileTrace extends TraceRange {
  kind: 'percentile'
  expression: string
  value: number
  mode: 'bonus' | 'penalty'
  ones: number
  onesRandomCall: number
  baseTens: number
  baseTensRandomCall: number
  extraTens: number[]
  extraTensRandomCalls: number[]
  candidates: PercentileCandidateTrace[]
  selectedTens: number
}

export interface PercentileCandidateTrace {
  tens: number
  value: number
  randomCall: number
  source: 'base' | 'bonus' | 'penalty'
  selected: boolean
}

export interface FateTrace extends TraceRange {
  kind: 'fate'
  operator: 'f'
  expression: string
  value: number
  diceCount: number
  faceCount: number
  rolls: FateRollTrace[]
}

export interface FateRollTrace {
  index: number
  randomCall: number
  value: -1 | 0 | 1
}

export interface PoolTrace extends TraceRange {
  kind: 'pool'
  operator: 'a' | 'c'
  expression: string
  value: number
  rounds: PoolRoundTrace[]
}

export interface PoolRoundTrace {
  index: number
  rolls: PoolRollTrace[]
}

export interface PoolRollTrace {
  index: number
  randomCall: number
  value: number
  rerolled: boolean
  selected: boolean
  source: 'base' | 'exploded'
}


export function createRollValue(root: DiceNode): RollValue {
  if (root instanceof ClampNode) {
    return root.evaluation.raw
  }

  if (root instanceof TupleSelectionNode) {
    return root.evaluation.raw
  }

  if (root instanceof TupleProjectionNode) {
    return root.evaluation.raw
  }

  if (root instanceof TupleSliceNode) {
    return root.evaluation.raw
  }

  if (root instanceof LoopNode) {
    return root.evaluation.raw
  }

  if (root instanceof VariableReferenceNode) {
    return root.evaluation.raw
  }

  if (root instanceof ConditionalNode) {
    return root.evaluation.raw
  }

  if (root instanceof SuccessCountNode) {
    return root.evaluation.raw
  }

  if (root instanceof TupleNode) {
    return root.evaluation.raw
  }

  if (
    root instanceof DNode
    && root.evaluation.roll
    && !root.evaluation.pb
    && root.evaluation.e === null
  ) {
    return {
      kind: 'tuple',
      items: [...root.evaluation.roll]
        .sort((left, right) => left.index - right.index)
        .map((roll) => createScalarValue(roll.value, 'literal', {
          index: roll.index,
          randomCall: roll.randomCall,
          selected: roll.selected,
          dropped: !roll.selected,
          source: 'base',
        })),
      projection: 'sum',
      source: 'dice-rolls',
    }
  }

  const value = typeof root.evaluation === 'object' && root.evaluation && 'value' in root.evaluation
    ? Number((root.evaluation as { value: number }).value)
    : NaN

  return createScalarValue(value, 'projection')
}
export function createTrace(root: DiceNode): RollTrace {
  if (root instanceof NumberNode) return createNumberTrace(root)
  if (root instanceof UnaryNode) return createUnaryTrace(root)
  if (root instanceof SimpleNode) return createBinaryTrace(root)
  if (root instanceof ComparisonNode) return createComparisonTrace(root)
  if (root instanceof BooleanNode) return createBooleanTrace(root)
  if (root instanceof ConditionalNode) return createConditionalTrace(root)
  if (root instanceof ClampNode) return createClampTrace(root)
  if (root instanceof BracketNode) return createGroupTrace(root)
  if (root instanceof TupleNode) return createTupleTrace(root)
  if (root instanceof TupleProjectionNode) return createTupleProjectionTrace(root)
  if (root instanceof TupleSelectionNode) return createTupleSelectionTrace(root)
  if (root instanceof TupleSliceNode) return createTupleSliceTrace(root)
  if (root instanceof SuccessCountNode) return createSuccessCountTrace(root)
  if (root instanceof LoopNode) return createLoopTrace(root)
  if (root instanceof VariableReferenceNode) return createVariableTrace(root)
  if (root instanceof InterpolationNode) return createInterpolationTrace(root)
  if (root instanceof DNode) return createDiceTrace(root)
  if (root instanceof PNode) return createPercentileTrace(root)
  if (root instanceof FNode) return createFateTrace(root)
  if (root instanceof ANode) return createPoolTrace(root, 'a')
  if (root instanceof CNode) return createPoolTrace(root, 'c')

  const value = typeof root.evaluation === 'object' && root.evaluation && 'value' in root.evaluation
    ? Number((root.evaluation as { value: number }).value)
    : NaN

  return {
    kind: 'generic',
    ...traceRange(root),
    expression: root.toString(),
    value,
    detail: root.toString(),
  }
}

function traceRange(node: DiceNode): { range?: SourceRange } {
  if (!node.range) return {}
  return {
    range: {
      start: node.range.start,
      end: node.range.end,
    },
  }
}
function createNumberTrace(node: NumberNode): NumberTrace {
  return {
    kind: 'number',
    ...traceRange(node),
    expression: node.toString(),
    value: node.evaluation.value,
  }
}

function createUnaryTrace(node: UnaryNode): UnaryTrace {
  return {
    kind: 'unary',
    ...traceRange(node),
    operator: node.evaluation.operator,
    expression: node.toString(),
    value: node.evaluation.value,
    operand: node.evaluation.right,
    children: [createTrace(node.right)],
  }
}

function createBinaryTrace(node: SimpleNode): BinaryTrace {
  return {
    kind: 'binary',
    ...traceRange(node),
    operator: node.evaluation.operator,
    expression: node.toString(),
    value: node.evaluation.value,
    left: node.evaluation.left,
    right: node.evaluation.right,
    children: [createTrace(node.left), createTrace(node.right)],
  }
}

function createComparisonTrace(node: ComparisonNode): ComparisonTrace {
  return {
    kind: 'comparison',
    ...traceRange(node),
    operator: node.evaluation.operator,
    expression: node.toString(),
    value: node.evaluation.value,
    left: node.evaluation.left,
    right: node.evaluation.right,
    children: [createTrace(node.left), createTrace(node.right)],
  }
}

function createBooleanTrace(node: BooleanNode): BooleanTrace {
  return {
    kind: 'boolean',
    ...traceRange(node),
    operator: node.evaluation.operator,
    expression: node.toString(),
    value: node.evaluation.value,
    left: node.evaluation.left,
    right: node.evaluation.right,
    leftTruthy: node.evaluation.leftTruthy,
    rightTruthy: node.evaluation.rightTruthy,
    children: [createTrace(node.left), createTrace(node.right)],
  }
}

function createConditionalTrace(node: ConditionalNode): ConditionalTrace {
  const selectedNode = node.evaluation.selectedBranch === 'consequent'
    ? node.consequent
    : node.alternate

  return {
    kind: 'conditional',
    ...traceRange(node),
    expression: node.toString(),
    value: node.evaluation.value,
    conditionValue: node.evaluation.conditionValue,
    selectedBranch: node.evaluation.selectedBranch,
    conditionTrace: createTrace(node.condition),
    selectedTrace: createTrace(selectedNode),
    ...(traceRange(node.consequent).range ? { consequentRange: traceRange(node.consequent).range } : {}),
    ...(traceRange(node.alternate).range ? { alternateRange: traceRange(node.alternate).range } : {}),
    raw: node.evaluation.raw,
  }
}
function createClampTrace(node: ClampNode): ClampTrace {
  return {
    kind: 'clamp',
    ...traceRange(node),
    operator: node.evaluation.operator,
    expression: node.toString(),
    value: node.evaluation.value,
    limit: node.evaluation.limit,
    before: node.evaluation.before,
    after: node.evaluation.after,
    children: [createTrace(node.left), createTrace(node.right)],
  }
}

function createGroupTrace(node: BracketNode): GroupTrace {
  return {
    kind: 'group',
    ...traceRange(node),
    expression: node.toString(),
    value: node.evaluation.value,
    children: [createTrace(node.inner)],
  }
}

function createTupleTrace(node: TupleNode): TupleTrace {
  return {
    kind: 'tuple',
    ...traceRange(node),
    expression: node.toString(),
    value: node.evaluation.value,
    projection: 'last',
    items: node.items.map(createTrace),
  }
}

function createTupleSelectionTrace(node: TupleSelectionNode): TupleSelectionTrace {
  const evaluation = node.evaluation
  return {
    kind: 'tuple-selection',
    ...traceRange(node),
    expression: node.toString(),
    value: evaluation.value,
    operator: evaluation.operator,
    count: evaluation.count,
    inputLength: evaluation.inputLength,
    selectedIndexes: evaluation.selectedIndexes,
    droppedIndexes: evaluation.droppedIndexes,
    items: evaluation.raw.items.map((item, index) => ({
      index,
      value: projectTraceItem(item),
      selected: Boolean(evaluation.raw.selected?.[index]),
      dropped: Boolean(evaluation.raw.dropped?.[index]),
    })),
    children: [createTrace(node.left)],
  }
}

function createTupleProjectionTrace(node: TupleProjectionNode): TupleProjectionTrace {
  const evaluation = node.evaluation
  return {
    kind: 'tuple-projection',
    ...traceRange(node),
    expression: node.toString(),
    value: evaluation.value,
    operator: 'tp',
    projection: evaluation.raw.projection,
    sourceKind: evaluation.sourceKind,
    sourceRange: traceRange(node.left).range,
    itemCount: evaluation.itemCount,
    items: evaluation.raw.items.map((item, index) => ({
      index,
      value: projectTraceItem(item),
      ...(evaluation.raw.selected ? { selected: Boolean(evaluation.raw.selected[index]) } : {}),
      ...(evaluation.raw.dropped ? { dropped: Boolean(evaluation.raw.dropped[index]) } : {}),
      ...(item.kind === 'scalar' && item.roll ? { randomCall: item.roll.randomCall, source: item.roll.source } : {}),
    })),
    children: [createTrace(node.left)],
  }
}

function createTupleSliceTrace(node: TupleSliceNode): TupleSliceTrace {
  const evaluation = node.evaluation
  return {
    kind: 'tuple-slice',
    ...traceRange(node),
    expression: node.toString(),
    value: evaluation.value,
    operator: 'sp',
    arity: evaluation.arity,
    inputLength: evaluation.inputLength,
    sourceIndexes: evaluation.sourceIndexes,
    resultIndexes: evaluation.resultIndexes,
    start: evaluation.start,
    end: evaluation.end,
    step: evaluation.step,
    ...(evaluation.leftBoundary !== undefined ? { leftBoundary: evaluation.leftBoundary } : {}),
    items: evaluation.raw.items.map((item, index) => ({
      index,
      value: projectTraceItem(item),
      ...(item.kind === 'scalar' && item.roll ? { randomCall: item.roll.randomCall, source: item.roll.source } : {}),
    })),
    children: [createTrace(node.left), createTrace(node.parameters)],
  }
}

function createSuccessCountTrace(node: SuccessCountNode): SuccessCountTrace {
  const evaluation = node.evaluation
  return {
    kind: 'success-count',
    ...traceRange(node),
    expression: node.toString(),
    value: evaluation.value,
    operator: 'cs',
    comparator: evaluation.comparator,
    target: evaluation.target,
    inputLength: evaluation.inputLength,
    successIndexes: evaluation.successIndexes,
    failureIndexes: evaluation.failureIndexes,
    items: evaluation.items,
    children: [createTrace(node.left)],
  }
}

function createLoopTrace(node: LoopNode): LoopTrace {
  const evaluation = node.evaluation
  return {
    kind: 'loop',
    ...traceRange(node),
    expression: node.toString(),
    value: evaluation.value,
    operator: 'lp',
    boundsTrace: createTrace(node.bounds),
    bounds: {
      start: evaluation.bounds.start,
      end: evaluation.bounds.end,
      step: evaluation.bounds.step,
    },
    itemCount: evaluation.raw.items.length,
    iterations: evaluation.iterations,
  }
}
function projectTraceItem(item: RollValue): number {
  return item.kind === 'scalar' ? item.value : Number.NaN
}

function createInterpolationTrace(node: InterpolationNode): InterpolationTrace {
  return {
    kind: 'interpolation',
    ...traceRange(node),
    key: node.key,
    input: node.evaluation.input,
    childRangeSource: 'input',
    childInputRange: { start: 0, end: node.evaluation.input.length },
    expression: `{${node.key}}`,
    value: node.evaluation.value,
    children: [createTrace(node.evaluation.node)],
  }
}

function createVariableTrace(node: VariableReferenceNode): VariableTrace {
  return {
    kind: 'variable',
    ...traceRange(node),
    name: node.evaluation.name,
    expression: node.toString(),
    value: node.evaluation.value,
    assignedAtStatement: node.evaluation.assignedAtStatement,
    raw: node.evaluation.raw,
  }
}

function createDiceTrace(node: DNode): DiceTrace {
  const evaluation = node.evaluation
  const modifiers: DiceModifierTrace[] = []

  if (evaluation.kq) {
    modifiers.push({
      kind: 'selection',
      operator: evaluation.kq,
      count: evaluation.c,
    })
  }

  if (evaluation.pb) {
    modifiers.push({
      kind: 'bonusPenalty',
      operator: evaluation.pb,
      count: evaluation.d,
    })
  }

  if (evaluation.e !== null) {
    modifiers.push({
      kind: 'pool',
      operator: 'a',
      threshold: evaluation.e,
    })
  }

  const children = [
    evaluation.aNode ? createTrace(evaluation.aNode) : null,
    ...(evaluation.pNodes || []).map(createTrace),
  ].filter(Boolean) as RollTrace[]

  return {
    kind: 'dice',
    ...traceRange(node),
    operator: 'd',
    expression: evaluation.expression,
    value: evaluation.value,
    diceCount: evaluation.a,
    faceCount: evaluation.b,
    rolls: (evaluation.roll || [])
      .slice()
      .sort((left, right) => left.index - right.index)
      .map((roll) => ({
        index: roll.index,
        randomCall: roll.randomCall,
        value: roll.value,
        selected: roll.selected,
        dropped: !roll.selected,
        source: 'base',
      })),
    modifiers,
    ...(children.length > 0 ? { children } : {}),
  }
}

function createFateTrace(node: FNode): FateTrace {
  return {
    kind: 'fate',
    ...traceRange(node),
    operator: 'f',
    expression: node.evaluation.expression,
    value: node.evaluation.value,
    diceCount: node.evaluation.a,
    faceCount: node.evaluation.b,
    rolls: (node.evaluation.roll || []).map((roll, index) => ({
      index,
      randomCall: roll.randomCall,
      value: roll.value,
    })),
  }
}

function createPoolTrace(node: ANode | CNode, operator: 'a' | 'c'): PoolTrace {
  return {
    kind: 'pool',
    ...traceRange(node),
    operator,
    expression: node.evaluation.expression,
    value: node.evaluation.value,
    rounds: (node.evaluation.rounds || []).map((round, roundIndex) => ({
      index: roundIndex,
      rolls: round.map(([value, rerolled, selected, randomCall], index) => ({
        index,
        randomCall,
        value,
        rerolled,
        selected,
        source: roundIndex === 0 ? 'base' : 'exploded',
      })),
    })),
  }
}

function createPercentileTrace(node: PNode): PercentileTrace {
  const evaluation = node.evaluation
  const extraTens = (evaluation.roll || []).map(([value]) => value)
  const extraTensRandomCalls = (evaluation.roll || []).map(([, , randomCall]) => randomCall)
  const extraSource: 'bonus' | 'penalty' = evaluation.pb === 'p' ? 'penalty' : 'bonus'
  const candidates: PercentileCandidateTrace[] = [
    {
      tens: evaluation.ten,
      value: percentileValue(evaluation.ten, evaluation.one),
      randomCall: evaluation.tenRandomCall,
      source: 'base',
      selected: evaluation.ten === evaluation.realTen,
    },
    ...(evaluation.roll || []).map(([tens, selected, randomCall]) => ({
      tens,
      value: percentileValue(tens, evaluation.one),
      randomCall,
      source: extraSource,
      selected,
    })),
  ]

  return {
    kind: 'percentile',
    ...traceRange(node),
    expression: evaluation.expression,
    value: evaluation.value,
    mode: evaluation.pb === 'p' ? 'penalty' : 'bonus',
    ones: evaluation.one,
    onesRandomCall: evaluation.oneRandomCall,
    baseTens: evaluation.ten,
    baseTensRandomCall: evaluation.tenRandomCall,
    extraTens,
    extraTensRandomCalls,
    candidates,
    selectedTens: evaluation.realTen,
  }
}

function percentileValue(ten: number, one: number) {
  const value = ten * 10 + one
  return value === 0 ? 100 : value
}


