#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { cmdAwaken } from './awaken.js'

const VERSION = '0.4.1'

// ANSI colours (no deps)
const B  = s => `\x1b[1m${s}\x1b[0m`
const G  = s => `\x1b[32m${s}\x1b[0m`
const Y  = s => `\x1b[33m${s}\x1b[0m`
const R  = s => `\x1b[31m${s}\x1b[0m`
const D  = s => `\x1b[2m${s}\x1b[0m`

const ok   = msg => console.log(`${G('✅')} ${msg}`)
const skip = msg => console.log(D(`   skip (exists): ${msg}`))
const warn = msg => console.log(`${Y('⚠ ')} ${msg}`)
const fail = msg => { console.error(`${R('✗ ')} ${msg}`); process.exit(1) }
const h    = msg => console.log(`\n${B(msg)}`)

// ─── manifest ────────────────────────────────────────────────────────────────
// [repo, src-path-in-repo, dest-path-relative-to-base]
const GLOBAL_BASE = join(homedir(), '.claude', 'skills')
const GLOBAL = [
  // spec-sonar: converge + decompose
  ['dragon375014/spec-sonar', 'skills/idea-to-spec/SKILL.md',                              'idea-to-spec/SKILL.md'],
  ['dragon375014/spec-sonar', 'skills/idea-to-spec/references/dark-zone-baseline.md',       'idea-to-spec/references/dark-zone-baseline.md'],
  ['dragon375014/spec-sonar', 'skills/idea-to-spec/references/output-templates.md',         'idea-to-spec/references/output-templates.md'],
  ['dragon375014/spec-sonar', 'skills/goal-decomposer/SKILL.md',                           'goal-decomposer/SKILL.md'],
  ['dragon375014/spec-sonar', 'skills/goal-decomposer/references/goal-graph.schema.json',   'goal-decomposer/references/goal-graph.schema.json'],
  ['dragon375014/spec-sonar', 'skills/goal-decomposer/references/output-directory-spec.md', 'goal-decomposer/references/output-directory-spec.md'],
  // specmit: bridge skill global so Claude finds it in every project
  ['dragon375014/specmit', 'skills/specmit/SKILL.md',                        'specmit/SKILL.md'],
]
const PROJECT = [
  // workflow stays project-local: scriptPath '.claude/workflows/idea-to-mvp.js' is relative to project cwd
  ['dragon375014/specmit', 'workflows/idea-to-mvp.js', '.claude/workflows/idea-to-mvp.js'],
  // deterministic stage-handoff hook (Claude Code only; the skill's soft AskUserQuestion offer is the portable fallback)
  ['dragon375014/specmit', 'hooks/pipeline-stage-notifier.mjs', '.claude/hooks/pipeline-stage-notifier.mjs'],
]
const DIRS = ['spec', 'spec/goals', 'spec/contracts', 'runs']

// ─── helpers ─────────────────────────────────────────────────────────────────
async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'dragon375014-pipeline-cli' } })
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}\n  ${url}`)
  return res.text()
}

async function installFile(repo, src, destAbs, force, dry) {
  if (dry) { console.log(D(`   would install: ${destAbs}`)); return }
  if (!force && existsSync(destAbs)) { skip(destAbs); return }
  const url = `https://raw.githubusercontent.com/${repo}/main/${src}`
  const content = await fetchText(url)
  mkdirSync(dirname(destAbs), { recursive: true })
  writeFileSync(destAbs, content, 'utf8')
  ok(destAbs)
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':')
    if (i < 0) continue
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

// Merge the deterministic stage-handoff hook into the project's .claude/settings.json.
// Idempotent: skips if already present; never clobbers existing settings.
function mergeHookSettings(cwd, dry) {
  const settingsPath = join(cwd, '.claude', 'settings.json')
  const hookEntry = {
    matcher: 'Write',
    hooks: [{ type: 'command', command: 'node', args: ['./.claude/hooks/pipeline-stage-notifier.mjs'], timeout: 10 }],
  }
  let settings = {}
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, 'utf8')) }
    catch { warn('.claude/settings.json is not valid JSON — skipping hook merge (add it manually)'); return }
  }
  settings.hooks ??= {}
  settings.hooks.PostToolUse ??= []
  const already = settings.hooks.PostToolUse.some(e =>
    (e?.hooks || []).some(hh => (hh?.args || []).some(a => String(a).includes('pipeline-stage-notifier'))))
  if (already) { skip('.claude/settings.json (stage-handoff hook already present)'); return }
  if (dry) { console.log(D('   would merge PostToolUse stage-handoff hook into .claude/settings.json')); return }
  settings.hooks.PostToolUse.push(hookEntry)
  mkdirSync(dirname(settingsPath), { recursive: true })
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8')
  ok('.claude/settings.json (stage-handoff hook merged)')
}

// ─── commands ────────────────────────────────────────────────────────────────
async function cmdInit(argv) {
  const force = argv.includes('--force')
  const dry = argv.includes('--dry') || argv.includes('--dry-run')
  const cwd = process.cwd()
  console.log(`\n${B('specmit')} — init  (v${VERSION})${force ? Y(' [--force]') : ''}${dry ? Y(' [--dry]') : ''}`)

  h('1/4  Global skills  →  ' + GLOBAL_BASE)
  for (const [repo, src, rel] of GLOBAL) {
    await installFile(repo, src, join(GLOBAL_BASE, rel), force, dry)
  }

  h('2/4  Project skills + 階段交接 hook  →  ' + cwd + '/.claude/')
  for (const [repo, src, rel] of PROJECT) {
    await installFile(repo, src, join(cwd, rel), force, dry)
  }
  mergeHookSettings(cwd, dry)

  h('3/4  Folder structure')
  for (const dir of DIRS) {
    const abs = join(cwd, dir)
    if (dry) { console.log(D(`   would create: ${dir}/`)); continue }
    if (!existsSync(abs)) { mkdirSync(abs, { recursive: true }); ok(dir + '/') }
    else skip(dir + '/')
  }

  // 4/4 — the half init was missing: write the always-loaded resource index so
  // this machine actually "wakes up". Without this, init drops files Claude
  // never sees on its load path and a fresh machine still feels dumb.
  h('4/4  Awaken this machine  →  resource index Claude reads every session')
  await cmdAwaken(dry ? ['--dry'] : [])

  console.log(`\n${G(B('All done.'))}`)
  console.log('\nNext:')
  console.log('  1. Open a NEW Claude Code chat here and say 「嗨」 → it should report what this machine has')
  console.log('  2. Say  「我想做一個...」          → idea-to-spec  (5–7 輪收斂)')
  console.log(`  3. 每一站做完會${G('自動提議下一棒')}（階段交接 hook）— 按一下就接，不必再打「分解」「跑管線」`)
  console.log(D('     hook 只在 Claude Code 生效；其他平台仍走 skill 的軟提議（可攜不掉）\n'))
}

async function cmdContrib() {
  const cwd = process.cwd()
  const skillsDir = join(cwd, '.claude', 'skills')
  if (!existsSync(skillsDir)) fail('No .claude/skills/ found. Run `pipeline init` first.')

  console.log(`\n${B('specmit')} — contrib  (v${VERSION})\n`)
  console.log('Scanning .claude/skills/ for non-canonical skills...\n')

  const entries = readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())

  let found = 0
  for (const d of entries) {
    const skillPath = join(skillsDir, d.name, 'SKILL.md')
    if (!existsSync(skillPath)) continue
    const local = readFileSync(skillPath, 'utf8')
    const fm = parseFrontmatter(local)
    if (fm.canonical !== 'false') continue
    found++

    const repoUrl = fm.canonical_repo
    if (!repoUrl) { warn(`${d.name}: canonical: false but no canonical_repo field — skipped`); continue }

    const m = repoUrl.match(/github\.com\/([^/]+\/[^/\s]+?)(?:\.git)?$/)
    if (!m) { warn(`${d.name}: cannot parse canonical_repo "${repoUrl}" — skipped`); continue }
    const ownerRepo = m[1]
    const canonicalUrl = `https://raw.githubusercontent.com/${ownerRepo}/main/skills/${d.name}/SKILL.md`

    let canonical
    try { canonical = await fetchText(canonicalUrl) }
    catch (e) { warn(`${d.name}: cannot fetch canonical (${e.message}) — skipped`); continue }

    if (local === canonical) {
      console.log(D(`   ${d.name}: in sync ✓`))
    } else {
      console.log(Y(B(`   ${d.name}: differs from canonical`)))
      console.log(`   canonical: ${canonicalUrl}`)
      console.log(`   local:     ${skillPath}`)
      console.log('')
      console.log('   To contribute back:')
      console.log(`     gh repo clone ${ownerRepo} /tmp/${d.name}-pr`)
      console.log(`     cp "${skillPath}" /tmp/${d.name}-pr/skills/${d.name}/SKILL.md`)
      console.log(`     cd /tmp/${d.name}-pr && git checkout -b "skill(${d.name})-update"`)
      console.log(`     git add -A && git commit -m "skill(${d.name}): describe your change"`)
      console.log(`     gh pr create --repo ${ownerRepo} --title "skill(${d.name}): <describe change>"`)
      console.log('')
    }
  }

  if (found === 0) console.log(D('   No non-canonical skills found.'))
}

async function cmdSync(argv) {
  console.log(`\n${B('specmit')} — sync  (v${VERSION})`)
  console.log(Y('Updating all skills to latest canonical (overwriting local copies)...\n'))
  await cmdInit(['--force'])
}

// ─── router ──────────────────────────────────────────────────────────────────
const [,, cmd, ...rest] = process.argv
const run = fn => fn(rest).catch(e => fail(e.message))

switch (cmd) {
  case 'init':    run(cmdInit);    break
  case 'contrib': run(cmdContrib); break
  case 'sync':    run(cmdSync);    break
  case 'awaken':  run(cmdAwaken);  break
  default:
    console.log(`\n${B('specmit')}  v${VERSION}\n`)
    console.log('Usage:')
    console.log('  npx specmit init               — install skills + folders, then awaken this machine (one-command cold start)')
    console.log('  npx specmit init --dry         — preview the full init (skills + awaken), write nothing')
    console.log('  npx specmit awaken             — (re)scan this machine (~/.claude) and write the resource index Claude reads every session')
    console.log('  npx specmit awaken --project   — same, but scope to the current project folder')
    console.log('  npx specmit awaken --dry       — preview what would be written, change nothing')
    console.log('  npx specmit sync               — update all skills to latest (--force)')
    console.log('  npx specmit contrib            — show diff for non-canonical skills, print PR steps')
    console.log('')
    process.exit(cmd ? 1 : 0)
}
