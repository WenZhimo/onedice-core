import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function readText(path: string): string {
  return readFileSync(resolve(__dirname, '..', '..', path), 'utf8')
}

function exportedErrorCodes(): string[] {
  const source = readText('src/errors.ts')
  return Array.from(source.matchAll(/\|\s+'([^']+)'/g), match => match[1])
}

describe('README structured error documentation', () => {
  it('documents every public OneDiceErrorCode', () => {
    const readme = readText('README.md')
    const missing = exportedErrorCodes().filter(code => !readme.includes(`\`${code}\``))

    expect(missing).toEqual([])
  })
})
