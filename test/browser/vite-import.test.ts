import { afterEach, describe, expect, it } from 'vitest'
import { build } from 'vite'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { pathToFileURL } from 'url'

const tempRoots: string[] = []

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop()
    if (root && existsSync(root)) {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

describe('browser package smoke test', () => {
  it('bundles the ESM build with Vite without Node polyfills', async () => {
    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { sideEffects?: unknown }
    expect(packageJson.sideEffects).toBe(false)

    const root = mkdtempSync(join(tmpdir(), 'onedice-vite-'))
    tempRoots.push(root)

    const srcDir = join(root, 'src')
    mkdirSync(srcDir)
    writeFileSync(join(root, 'index.html'), '<div id="app"></div><script type="module" src="/src/main.ts"></script>')
    writeFileSync(join(srcDir, 'main.ts'), `
      import { dice, OneDiceError, roll, rollProgram } from '@onedice/core'

      const sequence = [11, 7]
      const [value] = dice('2d20k1', {
        random(min, max) {
          const value = sequence.shift()
          if (value === undefined || value < min || value > max) {
            throw new Error('bad deterministic random value')
          }
          return value
        },
      })

      const result = roll('2d20', {
        random: () => 1,
      })

      const program = rollProgram('1d6;1d6', {
        random: () => 3,
      })

      const looped = roll('2lp[i]', {
        features: { loopOperator: true },
      })

      const fvtt = roll('@abilities.str.mod + 1', {
        syntax: 'fvtt-compatible',
        env: { 'abilities.str.mod': 3 },
      })

      const fvttResolved = roll('@actor.system.bonus + 1', {
        syntax: 'fvtt-compatible',
        env: { 'actor.system.bonus': 2 },
        resolver(path) {
          return path === 'actor.system.bonus' ? 4 : undefined
        },
      })

      const fvttPoolSequence = [6, 2, 3, 4, 7, 1, 2]
      const fvttPool = roll('{4d6,3d8}kh', {
        syntax: 'fvtt-compatible',
        features: { tupleOperators: true },
        random(min, max) {
          const value = fvttPoolSequence.shift()
          if (value === undefined || value < min || value > max) {
            throw new Error('bad deterministic FVTT pool random value')
          }
          return value
        },
      })

      const fateAlias = roll('4df', {
        features: { fateAlias: true },
        random: () => 0,
      })

      const fvttSuccesses = roll('4d6cs>4', {
        syntax: 'fvtt-compatible',
        features: { fvttSuccessCounting: true },
        random: () => 5,
      })

      const unsupportedFvtt = (() => {
        try {
          roll('@Compendium[world.spells.fireball] + 1', {
            syntax: 'fvtt-compatible',
            resolver() {
              throw new Error('document binding should not call resolver')
            },
          })
        } catch (error) {
          if (error instanceof OneDiceError) {
            return error.code + ':' + error.meta.feature + ':' + error.meta.operator
          }
          throw error
        }

        throw new Error('expected unsupported FVTT runtime binding')
      })()

      document.querySelector('#app')!.textContent =
        value + ':' + result.raw.kind + ':' + program.value + ':' + looped.raw.kind + ':' + looped.value + ':' + fvtt.value + ':' + fvttResolved.value + ':' + fvttPool.value + ':' + fvttPool.diagnostics[0].feature + ':' + fateAlias.value + ':' + fateAlias.diagnostics[0].code + ':' + fvttSuccesses.value + ':' + fvttSuccesses.trace.kind + ':' + unsupportedFvtt
    `)

    await build({
      root,
      logLevel: 'silent',
      resolve: {
        alias: {
          '@onedice/core': resolve('dist/index.mjs'),
        },
      },
      build: {
        outDir: 'build',
        emptyOutDir: true,
        modulePreload: false,
      },
    })

    expect(existsSync(join(root, 'build', 'index.html'))).toBe(true)

    const app = { textContent: '' }
    const previousDocument = globalThis.document
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        querySelector(selector: string) {
          return selector === '#app' ? app : null
        },
      },
    })

    try {
      const assetsDir = join(root, 'build', 'assets')
      const jsAsset = readdirSync(assetsDir).find(file => file.endsWith('.js'))
      expect(jsAsset).toBeDefined()

      const bundlePath = join(assetsDir, jsAsset!)
      const bundle = readFileSync(bundlePath, 'utf8')
      expect(bundle).not.toMatch(/\bfrom\s*["'](?:node:)?(?:fs|path|crypto|os)["']/)
      expect(bundle).not.toMatch(/\bimport\s*\(\s*["'](?:node:)?(?:fs|path|crypto|os)["']\s*\)/)
      expect(bundle).not.toMatch(/\brequire\s*\(\s*["'](?:node:)?(?:fs|path|crypto|os)["']\s*\)/)
      expect(bundle).not.toMatch(/\bprocess\./)
      expect(bundle).not.toMatch(/\bBuffer\b/)

      await import(pathToFileURL(bundlePath).href)

      expect(app.textContent).toContain(':fvttPool:')
      expect(app.textContent).toContain(':SYNTAX_NORMALIZED:')
      expect(app.textContent).toContain(':4:success-count:')
      expect(app.textContent).toContain(':PARSE_UNSUPPORTED_SYNTAX:fvttRuntimeBinding:@Compendium')
    } finally {
      Object.defineProperty(globalThis, 'document', {
        configurable: true,
        value: previousDocument,
      })
    }
  })
})

