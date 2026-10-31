import { test } from 'vitest'
import { execFileSync } from 'node:child_process'

// Keep the command's dependency-free tests runnable before a package install,
// and include the same suite in the repository's normal test gate.
test('changeset command read-back contracts', () => {
  execFileSync(process.execPath, ['--test', 'scripts/changesets/runner.test.mjs'], { stdio: 'pipe' })
})
