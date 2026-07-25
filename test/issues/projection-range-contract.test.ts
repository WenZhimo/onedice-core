import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

function tsFiles(root: string): string[] {
  return readdirSync(root).flatMap(entry => {
    const path = join(root, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      return tsFiles(path)
    }

    return entry.endsWith('.ts') ? [path] : []
  })
}

describe('projection range contract', () => {
  it('keeps source projectToNumber consumers range-aware', () => {
    const root = resolve(__dirname, '..', '..')
    const offenders: string[] = []

    for (const file of tsFiles(resolve(root, 'src'))) {
      const source = readFileSync(file, 'utf8')
      const lines = source.split(/\r?\n/)

      lines.forEach((line, index) => {
        if (!line.includes('projectToNumber(')) return
        if (line.includes('export function projectToNumber')) return

        const call = line.trim()
        const hasExplicitRangeArgument = /projectToNumber\([^,\n]+,\s*[^,\n]+,\s*[^)]/.test(call)
        if (!hasExplicitRangeArgument) {
          offenders.push(`${relative(root, file).replace(/\\/g, '/')}:${index + 1}:${call}`)
        }
      })
    }

    expect(offenders).toEqual([])
  })
})
