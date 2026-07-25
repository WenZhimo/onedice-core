import { OneDiceError } from '../errors'
import type { SourceRange } from '../trace'

export type RollValue = ScalarValue | TupleValue

export interface ScalarValue {
  kind: 'scalar'
  value: number
  source?: 'literal' | 'dice-sum' | 'projection' | 'operator'
  roll?: DiceRollValueMeta
}

export interface DiceRollValueMeta {
  index: number
  randomCall: number
  selected: boolean
  dropped: boolean
  source: 'base' | 'bonus' | 'penalty' | 'exploded' | 'rerolled'
}

export interface TupleValue {
  kind: 'tuple'
  items: RollValue[]
  projection: 'sum' | 'last' | 'identity'
  source?: 'literal' | 'dice-rolls' | 'loop' | 'slice' | 'operator'
  operator?: string
  selected?: boolean[]
  dropped?: boolean[]
}

export function createScalarValue(
  value: number,
  source: ScalarValue['source'] = 'projection',
  roll?: DiceRollValueMeta,
): ScalarValue {
  return {
    kind: 'scalar',
    value,
    source,
    ...(roll ? { roll } : {}),
  }
}

export function projectToNumber(
  value: RollValue,
  mode: TupleValue['projection'] = 'sum',
  range?: SourceRange,
): number {
  if (value.kind === 'scalar') return value.value

  const rangeMeta = range ? { range } : {}

  if (mode === 'identity') {
    throw new OneDiceError(
      'TUPLE_CANNOT_PROJECT',
      'Tuple identity values cannot be projected to a number',
      {
        operator: 'identity',
        ...rangeMeta,
        hint: 'Use roll() and read result.raw instead of consuming this tuple through dice().',
      },
    )
  }

  if (value.items.length === 0) {
    throw new OneDiceError(
      'TUPLE_EMPTY_PROJECTION',
      'Empty tuples cannot be projected to a number',
      {
        operator: mode,
        ...rangeMeta,
        hint: 'Provide at least one tuple item before projecting to a scalar value.',
      },
    )
  }

  if (mode === 'last') {
    return projectToNumber(value.items[value.items.length - 1], 'sum', range)
  }

  return value.items.reduce((total, item, index) => {
    if (value.selected && !value.selected[index]) return total
    if (value.dropped && value.dropped[index]) return total
    if (item.kind === 'scalar' && item.roll && (!item.roll.selected || item.roll.dropped)) {
      return total
    }

    return total + projectToNumber(item, 'sum', range)
  }, 0)
}
