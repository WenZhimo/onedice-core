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

describe('runtime error model', () => {
  it('keeps source failures on OneDiceError instead of plain Error', () => {
    const root = resolve(__dirname, '..', '..')
    const offenders = tsFiles(resolve(root, 'src')).flatMap(file => {
      const source = readFileSync(file, 'utf8')
      return source.match(/throw\s+new\s+Error\b/)
        ? [relative(root, file).replace(/\\/g, '/')]
        : []
    })

    expect(offenders).toEqual([])
  })
})
