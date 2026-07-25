import { execFileSync } from 'child_process'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { createRequire } from 'module'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

interface PackFile {
  path: string
}

interface PackResult {
  files: PackFile[]
}

const EXPECTED_PACK_FILES = [
  'README.md',
  'dist/index.cjs',
  'dist/index.cjs.map',
  'dist/index.d.mts',
  'dist/index.d.ts',
  'dist/index.mjs',
  'dist/index.mjs.map',
  'package.json',
]

interface PackageJson {
  main?: unknown
  module?: unknown
  types?: unknown
  exports?: unknown
  files?: unknown
  sideEffects?: unknown
}

function runPackDryRun(): PackResult {
  const npmExecPath = process.env.npm_execpath
  const command = npmExecPath ? process.execPath : process.platform === 'win32' ? 'cmd.exe' : 'npm'
  const args = npmExecPath
    ? [npmExecPath, 'pack', '--dry-run', '--json']
    : process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npm.cmd pack --dry-run --json']
    : ['pack', '--dry-run', '--json']
  const output = execFileSync(command, args, {
    cwd: resolve(__dirname, '..', '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const packages = JSON.parse(output) as PackResult[]

  expect(packages).toHaveLength(1)
  return packages[0]
}

describe('package contents', () => {
  it('declares stable ESM, CJS, and type entrypoints', () => {
    const root = resolve(__dirname, '..', '..')
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as PackageJson

    expect(packageJson.main).toBe('./dist/index.cjs')
    expect(packageJson.module).toBe('./dist/index.mjs')
    expect(packageJson.types).toBe('./dist/index.d.ts')
    expect(packageJson.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.mjs',
        require: './dist/index.cjs',
      },
    })
    expect(packageJson.sideEffects).toBe(false)

    for (const entry of ['dist/index.cjs', 'dist/index.mjs', 'dist/index.d.ts']) {
      expect(existsSync(resolve(root, entry))).toBe(true)
    }
  })

  it('keeps the CommonJS build callable and the declaration file exporting the public API', () => {
    const root = resolve(__dirname, '..', '..')
    const requireFromRoot = createRequire(resolve(root, 'package.json'))
    const cjs = requireFromRoot(resolve(root, 'dist/index.cjs')) as {
      dice: (input: string, config?: { random?: (min: number, max: number) => number }) => [number, unknown]
      roll: (input: string, config?: { random?: (min: number, max: number) => number }) => { value: number }
      rollProgram: (input: string, config?: { random?: (min: number, max: number) => number }) => { value: number }
      OneDiceError: unknown
    }

    expect(typeof cjs.dice).toBe('function')
    expect(typeof cjs.roll).toBe('function')
    expect(typeof cjs.rollProgram).toBe('function')
    expect(typeof cjs.OneDiceError).toBe('function')
    expect(cjs.dice('1d6', { random: () => 4 })[0]).toBe(4)
    expect(cjs.roll('1d6', { random: () => 5 }).value).toBe(5)
    expect(cjs.rollProgram('1d6;1d6', {
      random: (() => {
        const values = [2, 6]
        return () => values.shift() ?? 1
      })(),
    }).value).toBe(6)

    const declarations = readFileSync(resolve(root, 'dist/index.d.ts'), 'utf8')
    for (const declaration of [
      'declare function dice(input: string',
      'declare function roll(input: string',
      'declare function rollProgram(input: string',
      'declare class OneDiceError extends Error',
      'interface Config',
      'interface RollFeatureFlags',
      'type SyntaxMode',
      'type RollResult',
      'type RollValue',
      'type RollTrace',
      'interface RollDiagnostic',
      'interface ProgramResult',
    ]) {
      expect(declarations).toContain(declaration)
    }

    for (const exportedName of [
      'dice,',
      'roll,',
      'rollProgram,',
      'OneDiceError,',
      'type Config,',
      'type RollFeatureFlags,',
      'type SyntaxMode,',
      'type RollResult,',
      'type RollValue,',
      'type RollTrace,',
      'type RollDiagnostic,',
      'type ProgramResult,',
    ]) {
      expect(declarations).toContain(exportedName)
    }
  })

  it('publishes only runtime artifacts and package metadata', () => {
    const root = resolve(__dirname, '..', '..')
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as PackageJson

    expect(packageJson.files).toEqual(['dist'])

    const packed = runPackDryRun()
    const paths = packed.files.map(file => file.path).sort()

    expect(paths).toEqual(EXPECTED_PACK_FILES)

    for (const path of paths) {
      expect(path).toMatch(/^(README\.md|package\.json|dist\/.+)$/)
      expect(path).not.toMatch(/^(?:src|test|docs|node_modules)\//)
      expect(path).not.toMatch(/\.tgz$/)
      expect(path).not.toMatch(/\.(?:wasm|node)$/)
    }

    expect(readdirSync(root).filter(entry => entry.endsWith('.tgz'))).toEqual([])
  })
})
