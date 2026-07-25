import type { Config } from '../config'
import { normalizeFeatureFlags, normalizeSyntax } from '../config'
import type { DiceNode } from '../ast'
import type { SuccessCountComparator } from '../ast/success-count'
import { SuccessCountNode } from '../ast/success-count'
import { OneDiceError } from '../errors'
import { parse } from './parser'

interface SuccessCountOperatorMatch {
  start: number
  end: number
  targetStart: number
  comparator: SuccessCountComparator
}

export function parseFvttSuccessCounting(input: string, config: Config): DiceNode | null {
  const syntax = normalizeSyntax(config.syntax)
  const features = normalizeFeatureFlags(config.features)
  if (syntax !== 'fvtt-compatible' || !features.fvttSuccessCounting) return null

  const operator = findTopLevelSuccessCountOperator(input)
  if (!operator) return null

  const targetInput = input.slice(operator.targetStart)
  if (!targetInput.trim()) {
    throwMissingSuccessTarget(input, operator.targetStart)
  }

  const left = parseWithRangeOffset(input.slice(0, operator.start), config, input, 0)
  const target = parseWithRangeOffset(targetInput, config, input, operator.targetStart)
  const node = new SuccessCountNode(operator.comparator, left, target)
  node.range = { start: 0, end: input.length }
  return node
}

function parseWithRangeOffset(
  segment: string,
  config: Config,
  originalInput: string,
  offset: number,
): DiceNode {
  try {
    return parse(segment, config) as DiceNode
  } catch (error) {
    if (error instanceof OneDiceError) {
      error.meta = {
        ...error.meta,
        input: originalInput,
        ...(error.meta.range
          ? {
            range: {
              start: error.meta.range.start + offset,
              end: error.meta.range.end + offset,
            },
          }
          : {}),
      }
    }
    throw error
  }
}

function findTopLevelSuccessCountOperator(input: string): SuccessCountOperatorMatch | null {
  let roundDepth = 0
  let squareDepth = 0
  let braceDepth = 0

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]

    if (char === '(') {
      roundDepth += 1
      continue
    }
    if (char === ')') {
      roundDepth = Math.max(0, roundDepth - 1)
      continue
    }
    if (char === '[') {
      squareDepth += 1
      continue
    }
    if (char === ']') {
      squareDepth = Math.max(0, squareDepth - 1)
      continue
    }
    if (char === '{') {
      braceDepth += 1
      continue
    }
    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1)
      continue
    }

    if (roundDepth !== 0 || squareDepth !== 0 || braceDepth !== 0) continue
    if (!input.startsWith('cs', index)) continue
    if (isIdentifierBoundaryBlocked(input[index - 1])) continue

    const match = successCountOperatorAt(input, index)
    if (!match) continue
    return match
  }

  return null
}

function successCountOperatorAt(input: string, start: number): SuccessCountOperatorMatch | null {
  const candidates: Array<[string, SuccessCountComparator]> = [
    ['cs>=', '>='],
    ['cs<=', '<='],
    ['cs>', '>'],
    ['cs<', '<'],
    ['cs=', '='],
    ['cs', '='],
  ]

  for (const [token, comparator] of candidates) {
    if (!input.startsWith(token, start)) continue

    const end = start + token.length
    const next = input[end]
    if (isIdentifierBoundaryBlocked(next)) return null
    return {
      start,
      end,
      targetStart: end,
      comparator,
    }
  }

  return null
}

function isIdentifierBoundaryBlocked(value: string | undefined): boolean {
  return value !== undefined && /[A-Za-z_]/.test(value)
}

function throwMissingSuccessTarget(input: string, index: number): never {
  throw new OneDiceError(
    'PARSE_UNEXPECTED_END',
    'Unexpected end of FVTT success-counting expression',
    {
      input,
      actual: '$',
      expected: ['num'],
      range: { start: index, end: index },
      operator: 'cs',
      feature: 'fvttSuccessCounting',
      hint: 'Provide an explicit success target such as cs>4, cs>=5, cs=1, or cs1.',
    },
  )
}
