import { Config } from '..'
import { DiceNode } from '.'
import { getEvaluationContext } from '../evaluation/context'
import { createScalarValue, projectToNumber, type RollValue } from '../evaluation/value'
import { OneDiceError } from '../errors'

export interface VariableReferenceEvaluation {
  name: string
  value: number
  raw: RollValue
  assignedAtStatement: number
}

interface StoredProgramVariable {
  name: string
  raw: RollValue
  value: number
  assignedAtStatement: number
}

export class VariableReferenceNode implements DiceNode<VariableReferenceEvaluation> {
  evaluation: VariableReferenceEvaluation
  range?: DiceNode['range']

  constructor(public name: string) {}

  eval(config: Config): number {
    const context = getEvaluationContext(config)

    if (this.name.startsWith('@') && context?.syntax === 'fvtt-compatible') {
      return this.evalFvttPath(config)
    }

    const stored = context?.variables.get(this.name)

    if (!isStoredProgramVariable(stored)) {
      throw new OneDiceError(
        'VARIABLE_NOT_FOUND',
        `Program variable not found: ${this.name}`,
        {
          actual: this.name,
          variable: this.name,
          availableVariables: Object.keys(context?.variables.snapshot() ?? {}),
          range: this.range,
          hint: 'Assign the variable in an earlier rollProgram() statement before reading it.',
        },
      )
    }

    this.evaluation = {
      name: this.name,
      value: stored.value,
      raw: cloneRollValue(stored.raw),
      assignedAtStatement: stored.assignedAtStatement,
    }
    return stored.value
  }

  pure(): boolean {
    return true
  }

  toString(): string {
    return this.name
  }

  private evalFvttPath(config: Config): number {
    const path = this.name.slice(1)
    const context = getEvaluationContext(config)
    const env = config.env ?? {}
    const rawValue = resolveFvttPathValue(path, this.name, this.range, config, context?.currentInput ?? '')

    if (rawValue === undefined) {
      throw new OneDiceError(
        'VARIABLE_NOT_FOUND',
        `FVTT variable not found: ${this.name}`,
        {
          actual: this.name,
          variable: path,
          availableVariables: Object.keys(env),
          range: this.range,
          hint: 'Provide this FVTT @path value through resolver or env before calling roll().',
        },
      )
    }

    if (isRollValue(rawValue)) {
      const raw = cloneRollValue(rawValue)
      const value = projectToNumber(raw, raw.kind === 'tuple' ? raw.projection : 'sum', this.range)
      this.evaluation = {
        name: this.name,
        value,
        raw,
        assignedAtStatement: -1,
      }
      return value
    }

    const value = Number(rawValue)
    if (!Number.isFinite(value)) {
      throw new OneDiceError(
        'VARIABLE_INVALID_VALUE',
        `FVTT variable is not numeric: ${this.name}`,
        {
          actual: rawValue,
          variable: path,
          range: this.range,
          hint: 'FVTT @path values must resolve to finite numeric values in this compatibility slice.',
        },
      )
    }

    this.evaluation = {
      name: this.name,
      value,
      raw: createScalarValue(value, 'operator'),
      assignedAtStatement: -1,
    }
    return value
  }
}

function resolveFvttPathValue(
  path: string,
  name: string,
  range: DiceNode['range'],
  config: Config,
  originalInput: string,
): string | number | RollValue | undefined {
  if (config.resolver) {
    try {
      const resolved = config.resolver(path, {
        syntax: 'fvtt-compatible',
        range,
        originalInput,
      })
      if (resolved !== undefined) return resolved
    } catch (error) {
      if (error instanceof OneDiceError) throw error

      throw new OneDiceError(
        'VARIABLE_RESOLVER_FAILED',
        `FVTT variable resolver failed: ${name}`,
        {
          actual: error instanceof Error ? error.message : String(error),
          variable: path,
          range,
          hint: 'Handle resolver errors before calling roll(), or throw OneDiceError with a stable code/meta contract.',
        },
      )
    }
  }

  return config.env?.[path]
}

function isRollValue(value: unknown): value is RollValue {
  if (!value || typeof value !== 'object' || !('kind' in value)) return false
  const kind = (value as { kind?: unknown }).kind
  return kind === 'scalar' || kind === 'tuple'
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

function isStoredProgramVariable(value: unknown): value is StoredProgramVariable {
  return Boolean(
    value
    && typeof value === 'object'
    && 'name' in value
    && 'raw' in value
    && 'value' in value
    && 'assignedAtStatement' in value,
  )
}
