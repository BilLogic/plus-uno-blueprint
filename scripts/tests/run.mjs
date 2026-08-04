#!/usr/bin/env node
/**
 * Run the script-level tests.
 *
 * Node 20 cannot import TypeScript, and this repo has no test runner. Rather
 * than add one for a handful of pure functions, the modules under test are
 * compiled with the esbuild that Vite already depends on, and `node --test`
 * runs against the output. No new dependency, and the tests import real source
 * rather than a copy that can drift from it.
 *
 * Run: npm test
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TESTS_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TESTS_DIR, '../..')

/** Source modules the tests import, by the specifier they use. */
const MODULES = [
  'src/lib/resourceUrl.ts',
  'src/lib/cellContentMutations.ts',
  'src/lib/dependencyValidation.ts',
  'src/lib/versionValidation.ts',
  'src/lib/storyboardUpload.ts',
  'src/lib/deletionSafety.ts',
  'src/lib/annotationCapture.ts',
  'src/lib/authoringSession.ts',
  'src/lib/sliceType.ts',
  'src/lib/cellPickGrammar.ts',
  'src/lib/mergeIntegratedBlueprint.ts',
]

const work = mkdtempSync(join(tmpdir(), 'uno-tests-'))

try {
  execFileSync(
    'npx',
    [
      'esbuild',
      ...MODULES,
      '--bundle',
      '--format=esm',
      '--platform=neutral',
      `--outdir=${work}`,
      '--external:@supabase/supabase-js',
    ],
    { cwd: REPO_ROOT, stdio: ['ignore', 'ignore', 'inherit'] },
  )

  const testFiles = readdirSync(TESTS_DIR).filter((name) =>
    name.endsWith('.test.mjs'),
  )
  if (testFiles.length === 0) {
    console.error('No test files found.')
    process.exit(1)
  }

  // Rewrite the source specifiers to the compiled output. The committed test
  // points at `../../src/...` so it stays readable and greppable.
  const rewritten = testFiles.map((name) => {
    let source = readFileSync(join(TESTS_DIR, name), 'utf8')
    for (const module of MODULES) {
      const built = join(work, `${module.split('/').pop().replace(/\.ts$/, '')}.js`)
      source = source.replaceAll(`../../${module}`, built)
    }
    const target = join(work, name)
    writeFileSync(target, source)
    return target
  })

  execFileSync(process.execPath, ['--test', ...rewritten], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  })
} finally {
  rmSync(work, { recursive: true, force: true })
}
