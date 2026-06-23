# specmit

> **Auto spec → MVP, Made in Taiwan, MIT licensed.**
> 把「人工搬運」的管線升級成一個指令跑完——工具之間仍然鬆耦合，只靠檔案格式溝通。
>
> *specmit = spec + submit + MIT（Made in Taiwan）*

## The pipeline

```
  vague idea
      │  idea-to-spec (spec-sonar) — 5–7 round convergence
      ▼
  spec/project-spec.md + STATE_FINAL.json
      │  goal-decomposer (spec-sonar) — dependency inference + pre-adjudication
      ▼
  spec/goal-graph.json + spec/goals/G*.md + spec/contracts/C*.md
      │
      │  ╔══════════════ THIS REPO ══════════════╗
      │  ║ specmit (L3b bridge skill)            ║  reads graph, launches runner,
      │  ║   └─▶ workflows/idea-to-mvp.js (L3)   ║  batch-parallel executors — then a
      │  ║         governed by                   ║  fresh, read-only scorecard agent
      │  ║   PIPELINE-CONTRACT.md (L2)           ║  re-audits each result (tighten-only)
      │  ╚═══════════════════════════════════════╝
      ▼
  working code + runs/<run-id>/run-report.json (+ scorecard verdicts) + status writeback
```

## Loose coupling is the law

- The runner **imports nothing and calls no repo code**. The only interface is files: `goal-graph.json` (canonical schema owned by spec-sonar), `goals/G*.md` (self-contained, passed verbatim to executor agents), and `run-report.json` (owned here).
- [PIPELINE-CONTRACT.md](./PIPELINE-CONTRACT.md) is a **consumer contract**, not a format definition — it pins `schema_version 1.0`, lists the minimal field subset the runner reads (tolerant to everything else), and the one mutation allowed upstream (`goals[].status` writeback). The producer keeps owning the format.
- Every tool in the chain stays independently usable. Delete this repo and nothing upstream breaks.

## The verification ratchet — loop engineering's safety valve

An executor that self-reports `verified` is 球員兼裁判 (a player refereeing their own game). The real risk in any autonomous loop isn't slowness — it's the agent telling you it's done when it isn't. So every positive result passes an independent, read-only **scorecard** before it counts:

- **Tier-1** (pure JS, zero tokens): catches self-contradictions — `status:verified` with `verify.passed:false` or empty evidence is downgraded instantly.
- **Tier-2** (a fresh, read-only auditor agent): re-derives ground truth — `git diff` to confirm claimed files actually changed, re-runs the goal's *idempotent* verification commands for the real exit codes. It never trusts the executor's words and never mutates state.
- **One-way ratchet** (`pickTighter`): the scorecard can only **lower** confidence, never raise it. Even a misbehaving auditor that returns `verified` for a `done` claim is clamped back down. Confidence rises only by passing a real check, never by assertion.
- **Auditor tier ≥ executor**: a weak judge auditing strong work is a structural hole, so the auditor runs at the goal's own model tier.
- **Fail-closed on auditor outage**: if the auditor can't run, an unaudited `verified` is *not* independently verified → downgraded to `done` + flagged for manual check (never escalated to `failed` — an outage is not a refutation).

Modes via `args.scorecard`: `full` (default — Tier-1 + Tier-2), `cheap` (Tier-1 only, free), `off` (regression escape hatch). Pure core + truth-table tests: [lib/scorecard-logic.mjs](./lib/scorecard-logic.mjs).

## The autofix dial — turning the line into a loop

The scorecard alone is a **verification gate on a linear pipeline**: do once → audit → if it fails, surface to you. What makes something a *loop* (not a line) is the missing edge: *fail → fix → re-audit → repeat*. `args.autofix` adds exactly that edge — as a dial, off by default:

| `autofix` | repair attempts | behaviour |
|---|---|---|
| `off` (default) | 0 | audit-only; a refuted goal is downgraded and surfaced to you |
| `normal` | 1 | one fix attempt, then re-audit |
| `aggressive` | up to 3 | fix → re-audit, up to 3 cycles |

Why the dial is safe to crank up:

- **Separation of powers**: the fixer is a *re-spawned executor* (write-capable); the auditor stays *read-only*; the fixer **never certifies its own repair** — every fix goes back through the same independent scorecard (球員兼裁判 protection, one level up).
- **The ratchet still holds**: a bad fix can only be *tightened*, never let through. So turning the dial up costs tokens/time, **never correctness**.
- **Bounded + hard-stop**: on exhaustion the goal is surfaced to you with the auditor's outstanding findings — the loop never spins or fakes success. Auditor *outages* are never autofixed (a dead auditor isn't a refutation).
- **Tune from data**: the run report carries `autofix_attempts / autofix_repaired / autofix_exhausted` so you climb the dial empirically, not on vibes.

`autofix` needs `scorecard` on (it's driven by the auditor's refutation signal). Evaluator always-on; optimizer opt-in.

## Inner loop vs outer loop — where the machine stops and you start

- **Inner loop** (automated, per goal, in the runner): executor implements → Tier-1 → Tier-2 audit → ratchet → **(opt-in) autofix回邊**: if the auditor refutes, a re-spawned executor repairs the listed defects and the *same independent auditor* re-checks, bounded by the dial. Ground-truth-checked, only-tightening. This回邊 is what turns the line into a loop — see "The autofix dial" below.
- **Outer loop** (human-gated, per run, surfaced by the bridge): BLOCKED questions, `failed`/downgraded goals, "is this a goal-file fix or a spec fix?", accepting `done` (not-fully-verified) work, the `only:` resume decision.
- **The boundary rule**: anything that changes **scope / spec / accepts unverified work → you**. Making a defined goal pass its *own* defined verification → the machine. The scorecard never touches spec, never changes scope, never accepts unverified work on your behalf.

## How to use

1. Install — one command (installs the spec-sonar skills, this repo's bridge skill + workflow, and scaffolds `spec/` + `runs/`):
   ```bash
   npx specmit init
   ```
   Or copy manually:
   ```
   skills/specmit/  →  .claude/skills/specmit/
   workflows/idea-to-mvp.js →  .claude/workflows/idea-to-mvp.js
   ```
2. In a Claude Code session: say **「跑完整管線」 / "run the pipeline"**. The skill routes by what exists:
   - no spec → defers to `idea-to-spec`
   - spec but no goal graph → defers to `goal-decomposer`
   - graph + goals present → pre-flight checks, then launches the workflow
3. Read `runs/<run-id>/run-report.json`. BLOCKED questions come back to you (executors never guess); answer them and resume with `only: [ids]`.

## Cold-start: `specmit awaken`

`init` installs files — but a fresh machine still feels *dumb*, because those files aren't on Claude's every-session load path (project `CLAUDE.md` / project `.claude/skills` / memory). `awaken` fixes exactly that: it scans a scope and writes a compact, **active** resource index into the one file Claude reads at the start of every conversation (`CLAUDE.md`), plus a fuller `RESOURCES.md` drill-down.

冷啟動喚醒：`init` 只搬檔案，新機器仍「不精明」，因為那些檔不在 Claude 每次必載的路徑上。`awaken` 掃描範圍後，把一份精簡、會驅動行為的資源索引寫進 `CLAUDE.md`（每次對話必載），讓下一個 session 一開口就知道自己有哪些資源可用。

```bash
npx specmit awaken            # scan this machine (~/.claude): global skills, ecosystem repos, MCP servers, memory
npx specmit awaken --project  # scan the current project: its .claude/skills, docs, SSOT registries, migrations…
npx specmit awaken --dry      # preview exactly what would be written, change nothing
```

- **Idempotent** — re-running replaces the `<!-- AWAKEN:… -->` block in place, never duplicates. Re-run any time to refresh.
- **Reports gaps** — missing expected global skills and un-cloned ecosystem repos are flagged with the one-liner to fix them.
- **Acceptance test (「有感」)** — after running it, open a *new* Claude session and say 「嗨」: it should open by telling you what resources this machine / project has, instead of a blank stare. If nothing changed, it didn't land — that's the bar.

It's Tier-1 and deterministic (zero LLM, re-runnable); a Tier-2 curation skill that enriches the raw index is a separate, later piece.

## Repo layout

```
ECOSYSTEM.md                  the canonical map of the whole toolchain (all repos link here)
PIPELINE-CONTRACT.md          L2 — file-format protocol (consumer contract)
workflows/idea-to-mvp.js      L3 — Dynamic Workflow runner (validate → execute → scorecard → report)
lib/scorecard-logic.mjs       pure decision core SSOT (inlined verbatim into the runner; drift-guarded)
lib/scorecard-logic.test.mjs  zero-dep unit tests + behavioral drift guard (node lib/scorecard-logic.test.mjs)
skills/specmit/               L3b — bridge skill (trigger + pre-flight + writeback)
bin/pipeline.js               the `specmit` npm CLI (init / awaken / sync / contrib)
bin/awaken.js                 cold-start scanner — writes the always-loaded resource index (init's missing half)
```

## Design highlights

- **Batches-first scheduling**: the decomposer's `execution_plan.batches` is a pre-adjudication — honored when consistent with `depends_on`; Kahn topological waves are always computed as the cycle / missing-ref fail-fast gate and used as fallback.
- **Failure semantics**: upstream failed/blocked → downstream auto-blocked without spawning; independent branches keep running; the pipeline never hard-stops for one goal.
- **`model_tier` mapping**: haiku/sonnet/opus per goal → same-tier executor agent. Pay for opus only where the decomposer said so.
- **Governance hook**: every executor must run the host project's governance gates (guard scripts, audit:all, architecture-gate skills) before declaring done — composing with claude-skills-governance-meta instead of bypassing it.
- **Scorecard ratchet** (`args.scorecard`, default `full`): an independent read-only auditor re-derives ground truth per positive result and can only **tighten** a status, never raise it (`pickTighter`). See "The verification ratchet" above. Pure core is a tested SSOT (`lib/scorecard-logic.mjs`) inlined verbatim into the sandboxed runner, with a behavioral drift guard so the copy can't rot.
- **Autofix dial** (`args.autofix`, default `off`): the opt-in *fail → fix → re-audit* edge that turns the linear pipeline into a self-correcting loop. Fixer (re-spawned executor) ≠ auditor (read-only); every fix is independently re-audited; bounded with hard-stop; the ratchet means cranking the dial costs tokens, never correctness. Telemetry (`autofix_attempts/repaired/exhausted`) to tune from data. See "The autofix dial" above.
- **No-fs sandbox split**: the workflow script never touches the filesystem (sandbox law); the bridge skill reads the graph in, executor agents read their own goal files, the bridge writes reports out.

## Ecosystem

This repo is the **execution rail and front door** of a five-public-repo toolchain — the canonical map lives here: [ECOSYSTEM.md](./ECOSYSTEM.md).

**One-command install** (core skills — spec-sonar's two + this repo's bridge skill and workflow — plus `spec/` and `runs/` scaffolding; sibling repos below install separately):
```bash
npx specmit init
```

Upstream: [spec-sonar](https://github.com/dragon375014/spec-sonar) (formats), [goal-workflow-designer](https://github.com/dragon375014/goal-workflow-designer) (single-task depth + homogeneous breadth). Execution-time: [claude-skills-governance-meta](https://github.com/dragon375014/claude-skills-governance-meta) (gates, enforced in the executor prompt), [agent-work-board](https://github.com/dragon375014/agent-work-board) (multi-session claims, in the bridge's pre-flight).

## Publication status

Public since 2026-06-11. The original gate — ① spec-sonar public with a green [PUBLIC-CHECKLIST](https://github.com/dragon375014/spec-sonar/blob/main/PUBLIC-CHECKLIST.md), ② the pipeline validated end-to-end on ≥1 real project, ③ a full-history secret scan — was completed retroactively on 2026-06-12: validated on the MathBattle classroom-game pipeline run plus a 12-section external audit, and the secret scan across all toolchain repos came back clean.

## License

MIT.
