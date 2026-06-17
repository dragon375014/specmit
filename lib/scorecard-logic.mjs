// ============================================================================
// scorecard-logic — pure decision core for the idea-to-mvp pipeline scorecard
//
// CANONICAL HOME of the scorecard's pure logic. The Workflow sandbox forbids
// imports, so workflows/idea-to-mvp.js inlines a VERBATIM copy of the functions
// below (see its "scorecard (independent verifier)" block). The drift guard in
// scorecard-logic.test.mjs evals that inline region and asserts it still behaves
// identically — so the copy cannot silently rot.
//
// IRON LAW: the scorecard may only TIGHTEN a status, never loosen it. A post-hoc
// auditor that could promote work to "verified" would defeat its own purpose, so
// every path here is engineered to only equal-or-lower the claim.
// ============================================================================

// status desirability rank — higher = better outcome
export const RANK = { verified: 3, done: 2, blocked: 1, failed: 0 }

// Tier 1 — pure structural coherence. Returns an array of downgrade reasons
// (empty = claim is internally coherent). Only flags UNAMBIGUOUS self-
// contradictions, so it never false-downgrades legitimate work for free.
export function tier1Incoherence(claim) {
  const reasons = []
  if (claim.status === 'verified') {
    const passed = claim.verify && claim.verify.passed === true
    if (!passed) reasons.push('status=verified but verify.passed is not true')
    const ev = ((claim.verify && claim.verify.evidence) || '').trim()
    if (ev.length < 12) reasons.push(`status=verified but evidence is empty/trivial (${ev.length} chars)`)
  }
  return reasons
}

// Clamp a scorecard verdict so it can only equal or lower the claimed status.
// Even a misbehaving auditor that returns "verified" for a "done" claim is
// clamped back down to "done"; an unknown status is ignored (keep the claim).
export function pickTighter(claimStatus, verdictStatus) {
  if (!(verdictStatus in RANK)) return claimStatus
  return RANK[verdictStatus] < RANK[claimStatus] ? verdictStatus : claimStatus
}

// Should Tier-2 (the independent agent) even run for this claim? Never audit a
// negative self-report — agents don't falsely claim failure, so spending a
// second agent on blocked/failed is wasted tokens.
export function needsTier2(status) {
  return status === 'verified' || status === 'done'
}

// Build the downgraded result when Tier 1 finds incoherence (no agent spent).
export function mergeTier1Downgrade(claim, reasons) {
  return {
    ...claim,
    status: 'failed',
    verify: {
      passed: false,
      evidence: `[scorecard T1] self-contradictory claim downgraded: ${reasons.join('; ')}. Original self-report: ${(claim.verify && claim.verify.evidence) || ''}`,
    },
    scorecard: { upheld: false, tier: 1, discrepancies: reasons },
  }
}

// Merge an independent Tier-2 verdict into the claim, enforcing tighten-only.
// A null verdict here is a pure no-op (keep the claim) — the RUNNER owns the
// fail-closed policy on auditor death (see failClosedNoAudit); this primitive
// stays a clean merge so the truth table is easy to reason about.
export function mergeTier2(claim, verdict) {
  if (!verdict) return claim
  const status = pickTighter(claim.status, verdict.adjusted_status)
  return {
    ...claim,
    status,
    verify: { passed: status === 'verified', evidence: `[scorecard T2] ${verdict.scorecard_evidence || ''}` },
    scorecard: { upheld: !!verdict.upheld, tier: 2, discrepancies: verdict.discrepancies || [] },
  }
}

// Auditor unavailable (agent died / rate-limited). Fail-closed-but-calibrated:
// an unaudited "verified" is NOT independently verified, so it cannot keep
// "verified" — drop to "done" + flag for manual check. "done" already needs
// manual verification, so leave it untouched. Never escalate to "failed" on a
// mere auditor outage — the work was not refuted, only left unconfirmed.
export function failClosedNoAudit(claim) {
  if (claim.status !== 'verified') return claim
  return {
    ...claim,
    status: 'done',
    verify: {
      passed: false,
      evidence: `[scorecard T2] auditor unavailable — claim not independently verified, downgraded verified→done. Original self-report: ${(claim.verify && claim.verify.evidence) || ''}`,
    },
    scorecard: { upheld: false, tier: 2, discrepancies: ['auditor unavailable (fail-closed: unconfirmed ≠ verified)'] },
  }
}
