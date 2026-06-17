// Zero-dependency proof that the scorecard's pure core obeys the iron law
// ("only tighten, never loosen"), the fake/honest-executor truth table, and the
// fail-closed-on-auditor-death policy. Run: node lib/scorecard-logic.test.mjs
import assert from 'node:assert/strict'
import {
  tier1Incoherence, pickTighter, needsTier2, mergeTier1Downgrade, mergeTier2, failClosedNoAudit,
} from './scorecard-logic.mjs'

let n = 0
const ok = (cond, msg) => { n++; assert.ok(cond, msg) }

// --- Tier 1: catches self-contradictory "verified" claims for free ---------
ok(tier1Incoherence({ status: 'verified', verify: { passed: false, evidence: 'tests pass 4/4' } }).length > 0,
   'verified + passed:false must be flagged')
ok(tier1Incoherence({ status: 'verified', verify: { passed: true, evidence: '' } }).length > 0,
   'verified + empty evidence must be flagged')
ok(tier1Incoherence({ status: 'verified', verify: { passed: true, evidence: 'ok' } }).length > 0,
   'verified + trivially short evidence must be flagged')
ok(tier1Incoherence({ status: 'verified', verify: { passed: true, evidence: 'node test/g1.test.js -> 4/4 pass' } }).length === 0,
   'honest verified claim passes Tier 1 clean')
ok(tier1Incoherence({ status: 'done', verify: { passed: false, evidence: 'built, e2e env unavailable' } }).length === 0,
   'done is not held to the verified-evidence bar')

// --- pickTighter: only tightens, never loosens -----------------------------
ok(pickTighter('verified', 'failed') === 'failed', 'verified can be downgraded to failed')
ok(pickTighter('verified', 'verified') === 'verified', 'confirmed verified stays verified')
ok(pickTighter('done', 'verified') === 'done', 'auditor cannot upgrade done->verified (clamped)')
ok(pickTighter('verified', 'done') === 'done', 'verified can be lowered to done')
ok(pickTighter('failed', 'verified') === 'failed', 'auditor cannot resurrect failed')
ok(pickTighter('verified', 'garbage') === 'verified', 'unknown verdict ignored (keep claim)')

// --- needsTier2: never audit a negative self-report ------------------------
ok(needsTier2('verified') && needsTier2('done'), 'positive claims get audited')
ok(!needsTier2('blocked') && !needsTier2('failed'), 'negative claims skip the auditor')

// --- end-to-end: lying executor downgraded, honest survives ----------------
// 1. Lying via self-contradiction (verified + empty evidence) -> Tier 1 fails it
const liar = { goal_id: 'G1', status: 'verified', verify: { passed: true, evidence: '' }, files_touched: ['x.js'] }
const liarResult = mergeTier1Downgrade(liar, tier1Incoherence(liar))
ok(liarResult.status === 'failed' && liarResult.scorecard.upheld === false,
   'lying executor (verified+no evidence) downgraded to failed')

// 2. Tier-2 ground-truth refutation: claim verified, files unchanged -> failed
const claim2 = { goal_id: 'G2', status: 'verified', verify: { passed: true, evidence: 'node test -> pass' }, files_touched: ['room.js'] }
const refute = { goal_id: 'G2', upheld: false, adjusted_status: 'failed',
  scorecard_evidence: 'git diff --stat room.js -> no changes; re-ran node test -> exit 1',
  discrepancies: ['room.js claimed touched but git shows no diff'] }
ok(mergeTier2(claim2, refute).status === 'failed', 'Tier-2 refutation downgrades to failed')

// 3. Honest verified, auditor confirms -> stays verified
const confirm = { goal_id: 'G2', upheld: true, adjusted_status: 'verified',
  scorecard_evidence: 'git diff --stat room.js -> 1 file changed; re-ran node test -> 4/4 pass', discrepancies: [] }
ok(mergeTier2(claim2, confirm).status === 'verified', 'honest claim survives scorecard')

// 4. mergeTier2 with null verdict is a pure no-op (keep claim) — fail-open policy
//    lives in the RUNNER (failClosedNoAudit), not in this primitive
ok(mergeTier2(claim2, null).status === 'verified', 'mergeTier2(null) is a no-op (keep claim)')

// 5. Tier-2 cannot loosen a "done" claim even if it tries to say verified
ok(mergeTier2({ goal_id: 'G3', status: 'done', verify: { passed: false, evidence: '' }, files_touched: ['a.js'] },
   { goal_id: 'G3', upheld: true, adjusted_status: 'verified', scorecard_evidence: 'looks fine' }).status === 'done',
   'Tier-2 cannot promote done->verified')

// --- failClosedNoAudit: auditor outage must not let "verified" through ------
ok(failClosedNoAudit(claim2).status === 'done', 'auditor death downgrades verified->done (fail-closed)')
ok(failClosedNoAudit(claim2).verify.passed === false, 'fail-closed clears verify.passed')
ok(failClosedNoAudit(claim2).scorecard.upheld === false, 'fail-closed marks scorecard not upheld')
ok(failClosedNoAudit({ status: 'done', verify: { passed: false, evidence: 'x' } }).status === 'done',
   'fail-closed leaves done untouched (already needs manual verification)')
ok(failClosedNoAudit({ status: 'failed', verify: { passed: false, evidence: 'x' } }).status === 'failed',
   'fail-closed never escalates failed (auditor outage ≠ refutation)')

// --- anti-drift: the VERBATIM copy inlined in workflows/idea-to-mvp.js must
//     behave identically to this canonical module (the sandbox forbids import,
//     so the engine carries a copy — prove the copy hasn't rotted) -----------
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const engineSrc = readFileSync(join(here, '..', 'workflows', 'idea-to-mvp.js'), 'utf8')
// slice the pure-function region: from `const RANK =` up to (not incl.) `const VERDICT`
const start = engineSrc.indexOf('const RANK =')
const end = engineSrc.indexOf('const VERDICT =')
ok(start > 0 && end > start, 'engine inline scorecard region must be locatable')
const region = engineSrc.slice(start, end)
const inline = new Function(`${region}; return { tier1Incoherence, pickTighter, needsTier2, mergeTier1Downgrade, mergeTier2, failClosedNoAudit };`)()
ok(JSON.stringify(inline.tier1Incoherence(liar)) === JSON.stringify(tier1Incoherence(liar)), 'inline tier1Incoherence matches canonical')
ok(inline.pickTighter('done', 'verified') === pickTighter('done', 'verified'), 'inline pickTighter matches canonical (clamp)')
ok(inline.pickTighter('verified', 'failed') === 'failed', 'inline pickTighter tightens')
ok(inline.needsTier2('failed') === needsTier2('failed'), 'inline needsTier2 matches canonical')
ok(inline.mergeTier1Downgrade(liar, ['x']).status === 'failed', 'inline mergeTier1Downgrade downgrades')
ok(inline.mergeTier2(claim2, null).status === 'verified', 'inline mergeTier2 no-op matches canonical')
ok(inline.failClosedNoAudit(claim2).status === 'done', 'inline failClosedNoAudit matches canonical (fail-closed)')

console.log(`scorecard-logic: ${n} assertions passed`)
