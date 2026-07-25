import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

const FUTURE_DIAGNOSTIC_CODES = [
  'FEATURE_FLAG_REQUIRED',
  'COMPATIBILITY_PROJECTION',
  'BUDGET_NEAR_LIMIT',
]

function readText(path: string): string {
  return readFileSync(resolve(__dirname, '..', '..', path), 'utf8')
}

function listFiles(root: string): string[] {
  const absoluteRoot = resolve(__dirname, '..', '..', root)
  if (!existsSync(absoluteRoot)) return []

  const files: string[] = []

  function visit(directory: string) {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry)
      const stat = statSync(path)

      if (stat.isDirectory()) {
        visit(path)
        continue
      }

      files.push(path)
    }
  }

  visit(absoluteRoot)
  return files
}

describe('public diagnostic boundary', () => {
  it('keeps RollDiagnostic code narrowed to the currently public diagnostic', () => {
    const trace = readText('src/trace.ts')
    const context = readText('src/evaluation/context.ts')

    expect(trace).toContain("export type RollDiagnosticCode = 'SYNTAX_NORMALIZED'")
    expect(trace).toContain('code: RollDiagnosticCode')
    expect(context).toContain("code: 'SYNTAX_NORMALIZED'")
  })

  it('keeps future diagnostic codes out of source and README contracts', () => {
    const publicContractSources = [
      readText('README.md'),
      ...listFiles('src')
        .filter(path => path.endsWith('.ts'))
        .map(path => readFileSync(path, 'utf8')),
    ]

    for (const source of publicContractSources) {
      for (const code of FUTURE_DIAGNOSTIC_CODES) {
        expect(source).not.toContain(code)
      }
    }
  })
})
