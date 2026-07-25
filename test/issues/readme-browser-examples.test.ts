import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function readText(path: string): string {
  return readFileSync(resolve(__dirname, '..', '..', path), 'utf8')
}

describe('README browser examples', () => {
  it('documents framework-specific browser entry points and UI contracts', () => {
    const readme = readText('README.md')

    for (const heading of [
      '#### 纯 TypeScript',
      '#### Vite',
      '#### React',
      '#### Vue',
    ]) {
      expect(readme).toContain(heading)
    }

    for (const contract of [
      'BrowserRollOutcome',
      'OneDiceError',
      'error.code',
      'error.meta',
      'result.diagnostics',
      'sequenceRandom([11, 7])',
      'type RollResult',
      'JSON.stringify(outcome, null, 2)',
    ]) {
      expect(readme).toContain(contract)
    }
  })
})
