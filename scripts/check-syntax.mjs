// check-syntax — the CORRECT syntax check for the Workflow runner.
//
// ⛔ DO NOT use `node --check workflows/idea-to-mvp.js`. It will FALSELY report
//    "Illegal return statement" / "await is only valid in async functions".
//    Why: this repo is `type: module`, so node treats the .js as an ES module,
//    where top-level `return` / `await` are illegal. But the runner is NOT a
//    standalone module — the Claude Code Workflow engine strips the `export` and
//    wraps the whole body in an ASYNC function, injecting agent/log/phase/
//    parallel/pipeline/args as parameters. So top-level await + return are
//    legal *as the engine runs it*. `node --check` checks the wrong shape.
//
// This script reproduces the engine's wrap (AsyncFunction) to validate syntax
// the way it actually runs. Run: `npm run check`.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const here = dirname(fileURLToPath(import.meta.url))
const INJECTED = ['args', 'agent', 'log', 'phase', 'parallel', 'pipeline']
const FILES = ['workflows/idea-to-mvp.js']

let failed = 0
for (const f of FILES) {
  const src = readFileSync(join(here, '..', f), 'utf8').replace(/^export const meta/m, 'const meta')
  try {
    new AsyncFunction(...INJECTED, src) // parse only — never invoked
    console.log(`✓ ${f} parses OK (wrapped as the Workflow engine runs it)`)
  } catch (e) {
    console.error(`✗ ${f} SYNTAX ERROR: ${e.message}`)
    failed++
  }
}
if (failed) process.exit(1)
console.log(`check-syntax: ${FILES.length} workflow file(s) OK`)
