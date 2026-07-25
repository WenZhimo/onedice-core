import type { NormalizedRollFeatureFlags, SyntaxMode } from '../config'
import type { EvaluationContext } from '../evaluation/context'

export interface FvttNormalizationOptions {
  syntax: SyntaxMode
  features: NormalizedRollFeatureFlags
  context?: EvaluationContext
}

export interface FvttNormalizationResult {
  input: string
  features: NormalizedRollFeatureFlags
  changed: boolean
}

const allowedPoolWords = new Set([
  'd',
  'df',
  'f',
  'k',
  'q',
  'p',
  'b',
  'a',
  'm',
  'c',
  'x',
  'kh',
  'kl',
  'dh',
  'dl',
  'min',
  'max',
  'tp',
  'sp',
  'lp',
])

const diceLikeTerm = /(?:^|[^A-Za-z_0-9])(?:\d+(?:\.\d+)?\s*)?(?:d\s*\d|df(?![A-Za-z_0-9])|f(?![A-Za-z_0-9])|[pbac](?![A-Za-z_]))/

export function normalizeFvttCompatibleInput(
  input: string,
  options: FvttNormalizationOptions,
): FvttNormalizationResult {
  if (options.syntax !== 'fvtt-compatible') {
    return {
      input,
      features: options.features,
      changed: false,
    }
  }

  let output = ''
  let index = 0
  let changed = false

  while (index < input.length) {
    if (input[index] !== '{') {
      output += input[index]
      index += 1
      continue
    }

    const pool = readBraceRange(input, index)
    if (!pool) {
      output += input[index]
      index += 1
      continue
    }

    if (!isFvttDicePool(pool.content)) {
      output += input.slice(index, pool.end)
      index = pool.end
      continue
    }

    const original = input.slice(index, pool.end)
    const normalized = `[${pool.content}]`
    output += normalized
    changed = true
    options.context?.diagnostics.push({
      code: 'SYNTAX_NORMALIZED',
      severity: 'info',
      message: 'Normalized FVTT dice pool to tuple literal.',
      range: { start: index, end: pool.end },
      feature: 'fvttPool',
      original,
      normalized,
    })
    index = pool.end
  }

  return {
    input: changed ? output : input,
    features: changed
      ? { ...options.features, tupleLiterals: true }
      : options.features,
    changed,
  }
}

function readBraceRange(input: string, start: number): { content: string; end: number } | null {
  const end = input.indexOf('}', start + 1)
  if (end < 0) return null

  return {
    content: input.slice(start + 1, end),
    end: end + 1,
  }
}

export function isFvttDicePool(content: string): boolean {
  const items = splitTopLevelPoolItems(content)
  return items.length >= 2 && items.every(isDiceExpressionItem)
}

function splitTopLevelPoolItems(content: string): string[] {
  const items: string[] = []
  let start = 0
  let roundDepth = 0
  let squareDepth = 0

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    if (char === '(') roundDepth += 1
    if (char === ')') roundDepth = Math.max(0, roundDepth - 1)
    if (char === '[') squareDepth += 1
    if (char === ']') squareDepth = Math.max(0, squareDepth - 1)
    if (char === ',' && roundDepth === 0 && squareDepth === 0) {
      items.push(content.slice(start, index))
      start = index + 1
    }
  }

  items.push(content.slice(start))
  return items
}

function isDiceExpressionItem(item: string): boolean {
  const trimmed = item.trim()
  if (!trimmed) return false
  if (!/^[0-9A-Za-z_.+\-*/^x()[\]\s]+$/.test(trimmed)) return false

  const words = trimmed.match(/[A-Za-z_]+/g) ?? []
  if (words.some(word => !allowedPoolWords.has(word))) return false

  return diceLikeTerm.test(trimmed)
}
