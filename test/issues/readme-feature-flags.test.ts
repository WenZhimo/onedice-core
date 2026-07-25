import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function readText(path: string): string {
  return readFileSync(resolve(__dirname, '..', '..', path), 'utf8')
}

function featureFlagNames(): string[] {
  const source = readText('src/config.ts')
  const match = source.match(/export interface RollFeatureFlags \{([\s\S]*?)\n\}/)
  expect(match).not.toBeNull()

  return Array.from(match![1].matchAll(/^\s+(\w+)\?: boolean$/gm), flag => flag[1]).sort()
}

function defaultFeatureEntries(): Record<string, boolean> {
  const source = readText('src/config.ts')
  const match = source.match(/export const DEFAULT_FEATURES: NormalizedRollFeatureFlags = \{([\s\S]*?)\n\}/)
  expect(match).not.toBeNull()

  return Object.fromEntries(
    Array.from(match![1].matchAll(/^\s+(\w+): (true|false),?$/gm), entry => [
      entry[1],
      entry[2] === 'true',
    ]),
  )
}

describe('README feature flag documentation', () => {
  it('keeps RollFeatureFlags, DEFAULT_FEATURES, README, and the plan aligned', () => {
    const flags = featureFlagNames()
    const defaults = defaultFeatureEntries()
    const readme = readText('README.md')
    const plan = readText('docs/improvement-plan.md')

    expect(Object.keys(defaults).sort()).toEqual(flags)

    for (const flag of flags) {
      expect(defaults[flag]).toBe(false)
      expect(readme).toContain(`${flag}?: boolean`)
      expect(readme).toContain(`features.${flag}`)
      expect(plan).toContain(`${flag}: boolean`)
    }
  })
})
