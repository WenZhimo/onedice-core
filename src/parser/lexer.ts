import type { Config, NormalizedRollFeatureFlags, SyntaxMode } from '../config'
import { normalizeFeatureFlags, normalizeSyntax } from '../config'
import { OneDiceError } from '../errors'
import { getEvaluationContext } from '../evaluation/context'
import { isFvttDicePool } from './fvtt-normalize'

export interface TokenRange {
  start: number
  end: number
}

export interface NumberToken {
  name: 'num'
  value: number
  raw: string
  range: TokenRange
}

export interface InterpolationToken {
  name: 'int'
  value: string
  raw: string
  range: TokenRange
}

export interface TermToken {
  name: 'term'
  value: string
  raw: string
  range: TokenRange
}

export interface VariableToken {
  name: 'var'
  value: string
  raw: string
  range: TokenRange
}

export type Token = NumberToken | InterpolationToken | TermToken | VariableToken

const unsupportedSyntax = /[\[\],<>=|&?:@$;!]/
const futureWordSyntax = [
  { operator: 'kh', feature: 'tupleOperators' },
  { operator: 'kl', feature: 'tupleOperators' },
  { operator: 'dh', feature: 'tupleOperators' },
  { operator: 'dl', feature: 'tupleOperators' },
  { operator: 'min', feature: 'clampOperators' },
  { operator: 'max', feature: 'clampOperators' },
  { operator: 'tp', feature: 'tupleProjection' },
  { operator: 'sp', feature: 'tupleSlice' },
  { operator: 'lp', feature: 'loopOperator' },
  { operator: 'df', feature: 'fateAlias' },
  { operator: 'cs', feature: 'fvttSuccessCounting' },
]

const fvttCountingModifiers = [
  { operator: 'even', feature: 'fvttParityCounting' },
  { operator: 'odd', feature: 'fvttParityCounting' },
  { operator: 'cf', feature: 'fvttFailureCounting' },
  { operator: 'df', feature: 'fvttDeductFailures' },
  { operator: 'sf', feature: 'fvttSubtractFailures' },
  { operator: 'ms', feature: 'fvttMarginOfSuccess' },
]

const fvttRollModeCommands = new Set([
  'roll',
  'r',
  'publicroll',
  'pr',
  'gmroll',
  'gmr',
  'blindroll',
  'broll',
  'br',
  'selfroll',
  'sr',
])

const fvttDocumentBindingPrefixes = new Set([
  'Actor',
  'Item',
  'UUID',
  'Compendium',
])

const futureSymbolFeatures: Record<string, string> = {
  '[': 'tupleLiterals',
  ']': 'tupleLiterals',
  ',': 'tupleLiterals',
  '<': 'conditionals',
  '>': 'conditionals',
  '=': 'conditionals',
  '|': 'conditionals',
  '&': 'conditionals',
  '?': 'conditionals',
  ':': 'conditionals',
  '!': 'factorialOrNotOperator',
  '@': 'fvttCompatibility',
  '$': 'program',
  ';': 'program',
}

interface UnsupportedSyntax {
  operator: string
  feature?: string
  range: TokenRange
  featureEnabled: boolean
  syntax: SyntaxMode
}

interface LexerOptions {
  syntax: SyntaxMode
  features: NormalizedRollFeatureFlags
}

export function lexer(input: string, config: Config = {}) {
  const options: LexerOptions = {
    syntax: normalizeSyntax(config.syntax),
    features: normalizeFeatureFlags(config.features),
  }
  const futureSyntax = findKnownUnsupportedSyntax(input, options)
  if (futureSyntax) throwUnsupportedSyntax(input, futureSyntax)

  const conditionTerms = options.features.conditionals ? '<>=|&?:' : ''
  const loopSyntaxEnabled = hasEnabledLoopSyntax(input, options)
  const tupleTerms = options.features.tupleLiterals || loopSyntaxEnabled ? '\\[\\],' : ''
  const terms = `\\+\\-\\*/x\\^\\(\\)${tupleTerms}${conditionTerms}dkqpbamcf`
  const wordTerms = [
    options.features.tupleOperators ? 'kh|kl|dh|dl' : '',
    options.features.clampOperators ? 'min|max' : '',
    options.features.tupleProjection ? 'tp' : '',
    options.features.tupleSlice ? 'sp' : '',
    options.features.loopOperator ? 'lp' : '',
    options.features.fateAlias ? 'df(?![A-Za-z_0-9])' : '',
    fvttSuccessCountingEnabled(options) ? 'cs>=|cs<=|cs>|cs<|cs=|cs(?![A-Za-z_0-9])' : '',
  ].filter(Boolean).join('|') || '(?!)'
  const variableTerms = [
    options.features.program ? '\\$(?:\\d+|t[A-Za-z_]\\w*)' : '',
    options.syntax === 'fvtt-compatible' ? '@[A-Za-z_][A-Za-z0-9_.]*' : '',
    options.features.loopOperator ? 'i(?![A-Za-z_0-9])' : '',
  ].filter(Boolean).join('|') || '(?!)'
  const variableTerm = variableTerms
  const regex = new RegExp(`(\\d+(\\.\\d+)?)|{([^}]+)}|(${wordTerms})|(${variableTerm})|([${terms}])|([^${terms} ]+)`, 'g')
  const match = input.matchAll(regex)
  return function next(): Token {
    const next = match.next()
    if (next.done) {
      return {
        name: 'term',
        value: '$',
        raw: '$',
        range: { start: input.length, end: input.length },
      }
    }

    const start = next.value.index ?? 0
    const raw = next.value[0]
    const range = { start, end: start + raw.length }

    if (next.value[1]) {
      return { name: 'num', value: +next.value[1], raw, range }
    } else if (next.value[3]) {
      return { name: 'int', value: next.value[3], raw, range }
    } else if (next.value[4]) {
      if (raw === 'df') {
        getEvaluationContext(config)?.diagnostics.push({
          code: 'SYNTAX_NORMALIZED',
          severity: 'info',
          message: 'Normalized df FATE alias to f.',
          range,
          feature: 'fateAlias',
          original: 'df',
          normalized: 'f',
        })
        return { name: 'term', value: 'f', raw, range }
      }
      return { name: 'term', value: next.value[4], raw, range }
    } else if (next.value[5]) {
      return { name: 'var', value: next.value[5], raw, range }
    } else if (next.value[6]) {
      return { name: 'term', value: next.value[6], raw, range }
    } else if (next.value[7]) {
      const value = next.value[7]
      const unsupported = value.match(unsupportedSyntax)
      if (unsupported) {
        const operator = unsupported[0]
        const operatorStart = start + value.indexOf(operator)
        const feature = futureSymbolFeatures[operator]
        throwUnsupportedSyntax(input, {
          operator,
          feature,
          featureEnabled: featureEnabled(feature, options),
          syntax: options.syntax,
          range: { start: operatorStart, end: operatorStart + operator.length },
        })
      }

      return { name: 'int', value, raw, range }
    }

    throw new OneDiceError(
      'PARSE_UNEXPECTED_TOKEN',
      `Unexpected token: ${raw}`,
      {
        input,
        actual: raw,
        range,
      },
    )
  }
}

function findKnownUnsupportedSyntax(input: string, options: LexerOptions): UnsupportedSyntax | null {
  const interpolationRanges = findInterpolationRanges(input)
  const loopSyntaxRanges = findLoopSyntaxRanges(input, options, interpolationRanges)
  const successCountingRanges = findSuccessCountingOperatorRanges(input, options, interpolationRanges)
  const candidates: UnsupportedSyntax[] = []

  const stepSumOperator = findPostfixStepSumOperator(input, options, interpolationRanges)
  if (stepSumOperator) candidates.push(stepSumOperator)

  const fvttRuntimeBinding = findFvttRuntimeBinding(input, options)
  if (fvttRuntimeBinding) candidates.push(fvttRuntimeBinding)

  const fvttDocumentBinding = findFvttDocumentBinding(input, options, interpolationRanges)
  if (fvttDocumentBinding) candidates.push(fvttDocumentBinding)

  const fvttCountingModifier = findFvttCountingModifier(input, options, interpolationRanges)
  if (fvttCountingModifier) candidates.push(fvttCountingModifier)

  const fvttDiceModifier = findFvttDiceModifier(input, options, interpolationRanges)
  if (fvttDiceModifier) candidates.push(fvttDiceModifier)

  const fvttPool = findFvttPool(input, options)
  if (fvttPool) candidates.push(fvttPool)

  for (const syntax of futureWordSyntax) {
    const range = findFutureWord(input, syntax.operator, interpolationRanges)
    if (range) {
      if (
        (
          syntax.feature === 'tupleOperators'
          || syntax.feature === 'clampOperators'
          || syntax.feature === 'tupleProjection'
          || syntax.feature === 'tupleSlice'
          || syntax.feature === 'loopOperator'
          || syntax.feature === 'fateAlias'
          || syntax.feature === 'fvttSuccessCounting'
        )
        && featureEnabled(syntax.feature, options)
      ) continue
      candidates.push({
        operator: syntax.operator,
        feature: syntax.feature,
        featureEnabled: featureEnabled(syntax.feature, options),
        syntax: options.syntax,
        range,
      })
    }
  }

  for (let index = 0; index < input.length; index += 1) {
    if (inAnyRange(index, interpolationRanges)) continue
    if (inAnyRange(index, successCountingRanges)) continue
    const operator = input[index]
    const feature = futureSymbolFeatures[operator]
    if (feature) {
      if (feature === 'tupleLiterals' && featureEnabled(feature, options)) continue
      if (feature === 'tupleLiterals' && inAnyRange(index, loopSyntaxRanges)) continue
      if (operator === '@' && feature === 'fvttCompatibility' && featureEnabled(feature, options)) continue
      if (operator === '$' && feature === 'program' && featureEnabled(feature, options)) continue
      if (feature === 'conditionals' && featureEnabled(feature, options)) continue
      candidates.push({
        operator,
        feature,
        featureEnabled: featureEnabled(feature, options),
        syntax: options.syntax,
        range: { start: index, end: index + 1 },
      })
    }
  }

  return candidates.sort((left, right) => left.range.start - right.range.start)[0] ?? null
}

function hasEnabledLoopSyntax(input: string, options: LexerOptions): boolean {
  if (!options.features.loopOperator) return false
  const interpolationRanges = findInterpolationRanges(input)
  return Boolean(findFutureWord(input, 'lp', interpolationRanges))
}

function findLoopSyntaxRanges(
  input: string,
  options: LexerOptions,
  interpolationRanges: TokenRange[],
): TokenRange[] {
  if (!options.features.loopOperator) return []

  const ranges: TokenRange[] = []
  let searchStart = 0
  while (searchStart < input.length) {
    const suffix = input.slice(searchStart)
    const relativeRange = findFutureWord(suffix, 'lp', [])
    if (!relativeRange) break

    const lpRange = {
      start: searchStart + relativeRange.start,
      end: searchStart + relativeRange.end,
    }
    searchStart = lpRange.end
    if (inAnyRange(lpRange.start, interpolationRanges)) continue

    const leftRange = findLoopLeftTupleRange(input, lpRange.start)
    if (leftRange) ranges.push(leftRange)

    const bodyRange = findLoopBodyTupleRange(input, lpRange.end)
    if (bodyRange) ranges.push(bodyRange)
  }

  return ranges
}

function findLoopLeftTupleRange(input: string, lpStart: number): TokenRange | null {
  let end = lpStart - 1
  while (end >= 0 && input[end] === ' ') end -= 1
  if (input[end] !== ']') return null

  let depth = 0
  for (let index = end; index >= 0; index -= 1) {
    if (input[index] === ']') depth += 1
    if (input[index] === '[') depth -= 1
    if (depth === 0) return { start: index, end: end + 1 }
  }
  return null
}

function findLoopBodyTupleRange(input: string, lpEnd: number): TokenRange | null {
  let start = lpEnd
  while (start < input.length && input[start] === ' ') start += 1
  if (input[start] !== '[') return null

  let depth = 0
  for (let index = start; index < input.length; index += 1) {
    if (input[index] === '[') depth += 1
    if (input[index] === ']') depth -= 1
    if (depth === 0) return { start, end: index + 1 }
  }
  return { start, end: input.length }
}

function findInterpolationRanges(input: string): TokenRange[] {
  const ranges: TokenRange[] = []
  const interpolation = /{[^}]*}/g
  for (const match of input.matchAll(interpolation)) {
    const start = match.index ?? 0
    ranges.push({ start, end: start + match[0].length })
  }
  return ranges
}

function findFvttPool(input: string, options: LexerOptions): UnsupportedSyntax | null {
  const interpolation = /{[^}]*,[^}]*}/g
  for (const match of input.matchAll(interpolation)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (futureWordSyntax.some(syntax => input.startsWith(syntax.operator, end))) {
      const feature = options.syntax === 'fvtt-compatible' && !isFvttDicePool(match[0].slice(1, -1))
        ? 'fvttNonDicePool'
        : 'fvttCompatibility'
      return {
        operator: '{}',
        feature,
        featureEnabled: featureEnabled(feature, options),
        syntax: options.syntax,
        range: { start, end },
      }
    }
  }
  return null
}

function findFvttRuntimeBinding(input: string, options: LexerOptions): UnsupportedSyntax | null {
  const match = input.match(/^(\s*)\/([A-Za-z]+)(?=$|\s)/)
  if (!match) return null

  const command = match[2].toLowerCase()
  if (!fvttRollModeCommands.has(command)) return null

  const operator = `/${match[2]}`
  const start = match[1].length
  return {
    operator,
    feature: 'fvttRuntimeBinding',
    featureEnabled: featureEnabled('fvttRuntimeBinding', options),
    syntax: options.syntax,
    range: { start, end: start + operator.length },
  }
}

function findFvttDocumentBinding(
  input: string,
  options: LexerOptions,
  interpolationRanges: TokenRange[],
): UnsupportedSyntax | null {
  const documentBinding = /@([A-Z][A-Za-z]+)\[/g
  for (const match of input.matchAll(documentBinding)) {
    const start = match.index ?? 0
    if (inAnyRange(start, interpolationRanges)) continue

    const prefix = match[1]
    if (!fvttDocumentBindingPrefixes.has(prefix)) continue

    const operator = `@${prefix}`
    return {
      operator,
      feature: 'fvttRuntimeBinding',
      featureEnabled: featureEnabled('fvttRuntimeBinding', options),
      syntax: options.syntax,
      range: { start, end: start + operator.length },
    }
  }

  return null
}

function findPostfixStepSumOperator(
  input: string,
  options: LexerOptions,
  interpolationRanges: TokenRange[],
): UnsupportedSyntax | null {
  for (let index = 0; index < input.length; index += 1) {
    if (input[index] !== '?') continue
    if (inAnyRange(index, interpolationRanges)) continue
    if (!isPostfixOperatorLeftBoundary(input[index - 1])) continue
    if (hasTopLevelColonAfter(input, index + 1)) continue

    return {
      operator: '?',
      feature: 'stepSumOperator',
      featureEnabled: featureEnabled('stepSumOperator', options),
      syntax: options.syntax,
      range: { start: index, end: index + 1 },
    }
  }

  return null
}

function findFvttCountingModifier(
  input: string,
  options: LexerOptions,
  interpolationRanges: TokenRange[],
): UnsupportedSyntax | null {
  for (let index = 0; index < input.length; index += 1) {
    if (inAnyRange(index, interpolationRanges)) continue

    const modifier = fvttCountingModifierAt(input, index)
    if (!modifier) continue
    if (!hasDiceExpressionImmediatelyBefore(input, index)) continue

    return {
      operator: modifier.operator,
      feature: modifier.feature,
      featureEnabled: featureEnabled(modifier.feature, options),
      syntax: options.syntax,
      range: { start: index, end: index + modifier.operator.length },
    }
  }

  return null
}

function fvttCountingModifierAt(
  input: string,
  index: number,
): { operator: string, feature: string } | null {
  for (const modifier of fvttCountingModifiers) {
    if (!input.startsWith(modifier.operator, index)) continue
    const afterOperator = input[index + modifier.operator.length]
    if (!isFvttCountingModifierSuffixStart(modifier.operator, afterOperator)) continue
    return modifier
  }

  return null
}

function isFvttCountingModifierSuffixStart(
  operator: string,
  value: string | undefined,
): boolean {
  if (value === undefined) return true
  if (operator === 'even' || operator === 'odd') return !/[A-Za-z_0-9]/.test(value)
  return !/[A-Za-z_]/.test(value)
}

function findFvttDiceModifier(
  input: string,
  options: LexerOptions,
  interpolationRanges: TokenRange[],
): UnsupportedSyntax | null {
  for (let index = 0; index < input.length; index += 1) {
    if (inAnyRange(index, interpolationRanges)) continue

    const operator = fvttDiceModifierAt(input, index)
    if (!operator) continue
    if (!hasDiceExpressionImmediatelyBefore(input, index)) continue

    const feature = operator.toLowerCase().startsWith('x') ? 'fvttExplode' : 'fvttReroll'
    return {
      operator,
      feature,
      featureEnabled: featureEnabled(feature, options),
      syntax: options.syntax,
      range: { start: index, end: index + operator.length },
    }
  }

  return null
}

function fvttDiceModifierAt(input: string, index: number): string | null {
  const nextTwo = input.slice(index, index + 2)
  const afterTwo = input[index + 2]
  if ((nextTwo === 'xo' || nextTwo === 'xO') && isFvttModifierSuffixStart(afterTwo)) {
    return nextTwo
  }
  if (nextTwo === 'rr' && isFvttModifierSuffixStart(afterTwo)) {
    return nextTwo
  }

  const operator = input[index]
  const afterOne = input[index + 1]
  if ((operator === 'x' || operator === 'X') && isFvttModifierSuffixStart(afterOne)) {
    return operator
  }
  if (operator === 'r' && isFvttModifierSuffixStart(afterOne)) {
    return operator
  }

  return null
}

function hasDiceExpressionImmediatelyBefore(input: string, modifierStart: number): boolean {
  const prefix = input.slice(0, modifierStart)
  return /(?:^|[^A-Za-z_0-9])(?:\d+(?:\.\d+)?)?(?:d\d+(?:\.\d+)?|df|f)$/i.test(prefix)
}

function isFvttModifierSuffixStart(value: string | undefined): boolean {
  return value === undefined || /\s|\d|[<>=]/.test(value)
}

function isPostfixOperatorLeftBoundary(value: string | undefined): boolean {
  return value !== undefined && /[\d)\]A-Za-z_]/.test(value)
}

function hasTopLevelColonAfter(input: string, start: number): boolean {
  let roundDepth = 0
  let squareDepth = 0
  let braceDepth = 0

  for (let index = start; index < input.length; index += 1) {
    const char = input[index]
    if (char === '(') roundDepth += 1
    if (char === ')') roundDepth -= 1
    if (char === '[') squareDepth += 1
    if (char === ']') squareDepth -= 1
    if (char === '{') braceDepth += 1
    if (char === '}') braceDepth -= 1
    if (char === ':' && roundDepth === 0 && squareDepth === 0 && braceDepth === 0) return true
  }

  return false
}

function findSuccessCountingOperatorRanges(
  input: string,
  options: LexerOptions,
  interpolationRanges: TokenRange[],
): TokenRange[] {
  if (!fvttSuccessCountingEnabled(options)) return []

  const ranges: TokenRange[] = []
  const successOperator = /cs(?:>=|<=|>|<|=)?/g
  for (const match of input.matchAll(successOperator)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (inAnyRange(start, interpolationRanges)) continue
    if (isIdentifierLetter(input[start - 1]) || isIdentifierLetter(input[end])) continue
    ranges.push({ start, end })
  }
  return ranges
}

function findFutureWord(input: string, operator: string, ignoredRanges: TokenRange[]): TokenRange | null {
  let start = input.indexOf(operator)
  while (start >= 0) {
    const end = start + operator.length
    if (
      !inAnyRange(start, ignoredRanges)
      && !isIdentifierLetter(input[start - 1])
      && !isIdentifierLetter(input[end])
    ) {
      return { start, end }
    }
    start = input.indexOf(operator, start + 1)
  }
  return null
}

function inAnyRange(index: number, ranges: TokenRange[]): boolean {
  return ranges.some(range => index >= range.start && index < range.end)
}

function isIdentifierLetter(value: string | undefined): boolean {
  return value !== undefined && /[A-Za-z_]/.test(value)
}

function featureEnabled(feature: string | undefined, options: LexerOptions): boolean {
  if (!feature) return false
  if (feature === 'fvttCompatibility') return options.syntax === 'fvtt-compatible'
  if (feature === 'fvttSuccessCounting') return fvttSuccessCountingEnabled(options)
  return Boolean(options.features[feature as keyof NormalizedRollFeatureFlags])
}

function fvttSuccessCountingEnabled(options: LexerOptions): boolean {
  return options.syntax === 'fvtt-compatible' && options.features.fvttSuccessCounting
}

function throwUnsupportedSyntax(input: string, syntax: UnsupportedSyntax): never {
  throw new OneDiceError(
    'PARSE_UNSUPPORTED_SYNTAX',
    `Unsupported OneDice syntax: ${syntax.operator}`,
    {
      input,
      operator: syntax.operator,
      actual: syntax.operator,
      feature: syntax.feature,
      featureEnabled: syntax.featureEnabled,
      syntax: syntax.syntax,
      range: syntax.range,
      hint: unsupportedSyntaxHint(syntax),
    },
  )
}

function unsupportedSyntaxHint(syntax: UnsupportedSyntax): string {
  switch (syntax.feature) {
    case 'tupleOperators':
      return `The ${syntax.operator} tuple operator is reserved for a future tuple-operator feature.`
    case 'clampOperators':
      return `The ${syntax.operator} clamp operator is reserved for a future clamp-operator feature.`
    case 'tupleProjection':
      return 'The tp tuple projection operator is reserved for a future tuple-projection feature.'
    case 'tupleSlice':
      return 'The sp tuple slice operator is reserved for a future tuple-slice feature.'
    case 'loopOperator':
      return 'The lp loop operator is reserved until loop evaluation budgets are implemented.'
    case 'fateAlias':
      return 'The df FATE alias is reserved until an alias compatibility decision is implemented.'
    case 'program':
      return 'Program syntax is only available through rollProgram(); dice() and roll() keep single-expression semantics.'
    case 'conditionals':
      return 'Comparison, boolean, and conditional syntax requires features.conditionals to be enabled.'
    case 'factorialOrNotOperator':
      return 'The ! operator is reserved until OneDice decides whether it means logical not, factorial, or both in separate contexts.'
    case 'stepSumOperator':
      return 'The postfix ? step-sum operator is reserved until its precedence and interaction with ternary conditionals are specified.'
    case 'fvttCompatibility':
      return 'FVTT-compatible syntax must be enabled through an explicit compatibility mode.'
    case 'fvttNonDicePool':
      return 'FVTT non-dice pool syntax is recognized but not implemented; keep comma-containing env keys as interpolation until non-dice pool semantics are specified.'
    case 'fvttSuccessCounting':
      return 'FVTT success-counting syntax requires syntax: \'fvtt-compatible\' and features.fvttSuccessCounting.'
    case 'fvttFailureCounting':
      return 'FVTT failure-counting syntax is recognized but not implemented; keep it rejected until failure semantics and trace fields are specified.'
    case 'fvttDeductFailures':
      return 'FVTT deduct-failure syntax is recognized but not implemented; keep it rejected until failure deduction semantics and trace fields are specified.'
    case 'fvttSubtractFailures':
      return 'FVTT subtract-failure syntax is recognized but not implemented; keep it rejected until subtraction semantics and trace fields are specified.'
    case 'fvttMarginOfSuccess':
      return 'FVTT margin-of-success syntax is recognized but not implemented; keep it rejected until margin semantics and trace fields are specified.'
    case 'fvttParityCounting':
      return 'FVTT even/odd counting syntax is recognized but not implemented; keep it rejected until parity counting semantics and trace fields are specified.'
    case 'fvttRuntimeBinding':
      return 'Foundry roll modes and runtime bindings require host application integration and are not implemented in the browser core.'
    case 'fvttExplode':
      return 'FVTT exploding dice syntax is recognized but not implemented; keep it rejected until explode budgets and trace semantics are specified.'
    case 'fvttReroll':
      return 'FVTT reroll syntax is recognized but not implemented; keep it rejected until reroll budgets and replacement semantics are specified.'
    case 'tupleLiterals':
      return 'Tuple literal syntax is reserved for a future tuple-literals feature.'
    default:
      return 'This syntax is reserved for a future OneDice/FVTT-compatible mode.'
  }
}
