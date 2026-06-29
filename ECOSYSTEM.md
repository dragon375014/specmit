# Ecosystem Map

> The central map of the `dragon375014` AI-dev toolchain — five public repos, one pipeline, from vague idea to governed code.
> 生態系中央地圖：五個公開 repo、一條從想法到出貨的管線。

**This file is the single source of truth for ecosystem topology.** Each sibling repo's README carries a short `## Ecosystem` section pointing here. When a repo's role changes, update this file first, then the pointers.

## The pipeline

```
  vague idea
      │
      ▼
┌────────────────────────────────────────────────────────────────┐
│  spec-sonar                     CONVERGE & DECOMPOSE  收斂與分解 │
│  idea-to-spec   → 5–7 round Q&A → spec (CLAUDE.md + STATE)     │
│  goal-decomposer → dependency-ordered goals/G*.md + contracts  │
└────────────────────────────────────────────────────────────────┘
      │  goals / specs
      ▼
┌────────────────────────────────────────────────────────────────┐
│  goal-workflow-designer         SHAPE THE TASK        塑形任務  │
│  goal            (depth: one task, iterated to a quality bar)  │
│  workflow-shaper (breadth: same check across many units)       │
└────────────────────────────────────────────────────────────────┘
      │  precise /goal prompt or workflow script
      ▼
┌────────────────────────────────────────────────────────────────┐
│  specmit (this repo)            RUN THE PIPELINE      執行管線  │
│  specmit skill → idea-to-mvp.js workflow runner        │
│  batch-parallel executors, frozen contracts, BLOCKED protocol  │
│  (domain skills in your project's .claude/skills/ do the work) │
└────────────────────────────────────────────────────────────────┘
      │ guarded by                       │ coordinated by
      ▼                                  ▼
┌──────────────────────────────┐  ┌────────────────────────────┐
│ claude-skills-governance-meta│  │ agent-work-board           │
│ GOVERN 治理 (design-time):   │  │ COORDINATE 協調:           │
│ CI guards, gate skills,      │  │ cross-session board,       │
│ step-back sentinel           │  │ territory + footprint      │
└──────────────────────────────┘  └────────────────────────────┘
```

## Quick start — 新專案一鍵安裝

```bash
# 在你的新專案資料夾裡執行：
npx specmit init
```

安裝後直接在 Claude Code 說「我想做一個...」即可開始；要一條龍跑完就說「跑完整管線」。CLI 指令：

| 指令 | 說明 |
|---|---|
| `specmit init` | 安裝核心 skill（spec-sonar 三套含 brownfield 補全入口 + specmit + idea-to-mvp workflow）+ 建立 spec/ 與 runs/ 資料夾 |
| `specmit complete` | 確保 brownfield 補全/體檢入口已裝，並印出怎麼啟動（既有專案說「幫我補全這個專案」） |
| `specmit sync` | 更新已安裝 skill 到最新 canonical 版本 |
| `specmit contrib` | 顯示本地修改與 canonical 的差異，印出 PR 步驟 |

已有全域 skill？`init` 自動跳過，不覆蓋。`--force` 強制更新。`goal` / `workflow-shaper` / 治理 skill / 看板屬選配，到各自 repo 依 README 安裝。

## Repo roles

| Repo | Layer | Owns | Reach for it when |
|---|---|---|---|
| [spec-sonar](https://github.com/dragon375014/spec-sonar) | converge + decompose | `idea-to-spec`, `audit-existing-project` (brownfield entry skill), `goal-decomposer`, Audit / Complex-System / Conflict-Analysis modes, project-scanner, 4 platform adapters. **+ 2026-06: completeness baseline (archetype axis), Audit Mode security lens + audit→fix kickoff, capability-gated house-profile read, AskUserQuestion stage-handoff offers, brownfield 補全 entry skill (ADR-002~008)** | "I have a product idea" / "decompose this spec" / "audit this design for blind spots" / "complete / security-scan an existing project" |
| [goal-workflow-designer](https://github.com/dragon375014/goal-workflow-designer) | shape | `goal` (depth), `workflow-shaper` (breadth) | "one task done right" / "same check over many units" |
| [claude-skills-governance-meta](https://github.com/dragon375014/claude-skills-governance-meta) | govern | `governance-guard` + `step-back-sentinel` templates, `architecture-completeness-guardian` + `trace-lock-modify` + `step-back-review` scaffold skills, adoption fitness check. **+ 2026-06: portable Supabase/web security-gate playbook (`playbooks/supabase-web-security-gate.md`, P0~P2 ruleset — the GOLD classes advisors miss)** | "stop shipping the same class of bug" / "gate architecture changes" / "the security ruleset Audit Mode's security lens scans against" |
| [agent-work-board](https://github.com/dragon375014/agent-work-board) | coordinate | WORK-BOARD template, claim ritual, footprint methodology | "I run 2+ AI sessions in parallel on one repo" |
| [specmit](https://github.com/dragon375014/specmit) | run + front door | this map, `PIPELINE-CONTRACT.md` (consumer contract pinning goal-graph 1.0), `idea-to-mvp` workflow runner, `specmit` bridge skill, the `specmit` npm CLI (`bin/`, ≥ 0.4.2). **+ 2026-06: deterministic stage-handoff hooks (`hooks/pipeline-stage-notifier.mjs`); `init` installs them into `.claude/` (ADR-007); `init` also installs the brownfield `audit-existing-project` entry + a `complete` verb (ADR-008)** | "run the whole spec→goals→execution pipeline in one command" / "complete an existing project" / "where do I start?" |

The author also keeps a **private cross-project knowledge vault** (`reuse-hub`) — a `reuse-manifest` (which existing code to copy-fork) plus a `house-profile` (the author's defaults for recurring sharp-edges — media upload, payment callbacks, new-table grants, … — **and, since ADR-009, cross-brand UX/interaction conventions (`house_ux_rules`: blocked-state disclosure, anti-slop layout, screenshot-before-ship, …)**; brand-specific *visual* taste stays in per-brand design molds, not here). `goal-decomposer` **optionally** consumes a local house-profile through a **capability-gated slot** (`./.reuse/house-profile.json` ▸ `$HOUSE_PROFILE` ▸ neutral default) and bakes the values into the contracts it generates — for UI goals it bakes the matching `house_ux_rules` into acceptance (e.g. screenshot-before-ship → human verdict; the engine is unchanged, the gate rides the goal's acceptance) — public users without one simply get neutral defaults and a normal run (see spec-sonar `DESIGN-NOTES.md` ADR-003). The vault itself is not required by any workflow above; everything those workflows *need* lives in the public repos in this table.

## Routing rules

| You want to… | Start at | Then |
|---|---|---|
| build a product from a vague idea | spec-sonar `idea-to-spec` | → `goal-decomposer` → execute goals in dependency order |
| audit an existing design for blind spots | spec-sonar Audit Mode | → remediation goals → `goal-decomposer` |
| **complete an existing project** (missing pages / media / reachability) | spec-sonar `audit-existing-project` skill (say 「補全這個專案」, or `npx specmit complete`) → Audit Mode (archetype lens) | → triage fix-now (ADR-006) → `goal-decomposer` → execute |
| **security-scan a Supabase / web project** | spec-sonar `audit-existing-project` → Audit Mode (security lens, ADR-005) | reads governance-meta security-gate playbook; warn-only; allowlist via house-profile |
| get one task done deep and converged | goal-workflow-designer `goal` | paste the emitted `/goal` prompt |
| run the same check/change across many units | goal-workflow-designer `workflow-shaper` | WORTH-IT gate first; paste the workflow prompt |
| stop a recurring bug class | claude-skills-governance-meta | run the adoption fitness check, then copy a template |
| gate "I want to add X" declarations | governance-meta scaffold `architecture-completeness-guardian` | install into `.claude/skills/`, fill the dispatch table |
| coordinate parallel sessions | agent-work-board | board file on main + claim ritual |
| run a decomposed spec all the way to working code | specmit `specmit` | pre-flight → batch-parallel executors → run-report + BLOCKED questions back to you |

**One-second disambiguation** (from goal-workflow-designer): count how many units. One thing to perfect → `goal`. The same check across many things → `workflow-shaper`. A whole multi-module spec → `goal-decomposer`.

**How the layers hook into each other mechanically** — not just conceptually:

- spec stage: `idea-to-spec` **recommends** (never auto-installs) the governance skills when it calibrates a project as enterprise-complexity.
- execution stage: every `idea-to-mvp` executor runs the host project's governance gates (`scripts/governance-guard.mjs`, `npm run audit:all`, architecture-gate skills under `.claude/skills/`) before declaring a goal done — a failing gate fails the goal.
- coordination: when several sessions run pipelines on one repo, the work-board claim ritual prevents collisions; the runner's same-batch file-collision tripwire covers collisions *inside* one run.

## The 2026-06 layer — new capabilities + cross-repo edges

A round of work (recorded as **ADR-001 ~ 007** in spec-sonar `DESIGN-NOTES.md`) added a completeness + governance + handoff layer. The new **cross-repo edges** (relationships beyond the linear pipeline):

```
spec-sonar goal-decomposer ──reads (capability-gated)──▶ reuse-hub  house-profile.json   (ADR-003 sharp-edges + ADR-009 house_ux_rules; private values, never leaked; UI goals get screenshot-before-ship→human verdict baked into acceptance, engine unchanged)
spec-sonar Audit Mode (security lens) ──references──▶ governance-meta  supabase-web-security-gate.md   (ADR-005; public ruleset)
specmit  init ──installs──▶ project .claude/  stage-handoff hooks   (ADR-007; deterministic offer, Claude-Code-only, soft offer is the portable fallback)
specmit  init ──installs──▶ ~/.claude/skills/  audit-existing-project (+ audit-mode.md + project-scanner.py)   (ADR-008; brownfield entry, auto-triggerable)
Audit Mode A7 ──triage fix-now──▶ goal-decomposer ──▶ specmit   (ADR-006; brownfield "complete the project" loop)
```

What the layer adds, by theme:
- **Completeness** (ADR-002): a per-deliverable-type *completeness baseline* (archetype axis) so the pipeline checks "does this *kind* of thing have what it should," not just internal consistency. Lives in `dark-zone-baseline.md`, so both from-zero (idea-to-spec) and brownfield (Audit Mode) get it.
- **UX / visual axis** (ADR-009): archetype (ADR-002) checks "are the right *surfaces* there"; this checks "do those surfaces *look usable*." goal-decomposer reads private `house_ux_rules` (capability-gated, like sharp-edges) and bakes them into UI-goal acceptance — notably `screenshot-before-ship` (render → human 80-point verdict). The gate rides the goal's acceptance, so the specmit engine is unchanged; taste stays with the human (the agent is a floor-guard, not a taste judge). Brand *visual* values live in per-brand design molds, not the public engine.
- **Brownfield entry** (ADR-008): a thin `audit-existing-project` skill is the auto-triggerable front door for "complete / audit an existing project" — symmetric to `idea-to-spec`'s from-zero front door. `specmit init` installs it (with the Audit Mode doc + scanner); it orchestrates Audit Mode but holds none of the criteria. Closes the `connector-needed` gap.
- **Private-knowledge injection** (ADR-003): public engine defines a `house-profile` *slot*; the private vault holds the *values*; goal-decomposer reads it if present, degrades to neutral defaults if not.
- **Handoffs** (ADR-004 + 007): each stage proactively offers the next step (AskUserQuestion soft offer) — propose, don't auto-advance; a PostToolUse hook hardens the offer deterministically *in Claude Code only*, keeping portability.
- **Security** (ADR-005): a portable Supabase/web security ruleset (governance-meta) + a warn-only Audit Mode lens that scans against it, with intentional-exception allowlists in the private house-profile.
- **Audit→fix** (ADR-006): brownfield findings → triage (fix-now / roadmap / intentional) → human selects → decompose → run; high-blast-radius (RLS/grants/payments) goals stop for human SQL review.

**The recurring law** all of these share: *capability-gated (detect the tool, not the identity) + public mechanism / private values + propose, don't auto-advance.*

> ✅ **`connector-needed` resolved + shipped (2026-06-27, ADR-008; live on npm `specmit@0.4.2`)**: the brownfield "complete an existing project" entry is now auto-triggerable from a fresh install. spec-sonar ships a thin `skills/audit-existing-project/` whose description matches "補全 / 體檢 / audit this existing project / what's missing"; `specmit init` (manifest in `bin/pipeline.js`, **published as 0.4.2** — the version where the manifest first lists these files) installs it globally along with `modes/audit-mode.md` and `tools/project-scanner.py` (into the skill's `references/`). Saying 「幫我補全這個專案」 (or running `npx specmit complete`) now reaches Audit Mode → A7 triage → goal-decomposer without the agent having to read the spec-sonar repo by hand.
>
> **Getting it on each machine:** `npx specmit@latest init` on a new project, or **`npx specmit@latest sync`** on a project that already installed an older version (sync = `init --force`, refreshes every skill + the `idea-to-mvp.js` runner to latest `main`). Use `@latest` to dodge a stale npx cache. The brownfield skill is **global** (`~/.claude/skills/`), so one sync per machine arms 「補全」 for every project on it.

## Canonical ownership — multi-copy skills

Several skills exist in more than one place. **The repo copy is canonical; installed copies are deployments.**

| Skill | Canonical home | Installed copies live at |
|---|---|---|
| `idea-to-spec`, `audit-existing-project`, `goal-decomposer` | spec-sonar `skills/` | `~/.claude/skills/` (`audit-existing-project` also ships `references/audit-mode.md` + `references/project-scanner.py`, canonical at spec-sonar `modes/` + `tools/`) |
| `goal`, `workflow-shaper` | goal-workflow-designer `skills/` | `~/.claude/skills/`, project `.claude/skills/` |
| `architecture-completeness-guardian`, `trace-lock-modify`, `step-back-review` | claude-skills-governance-meta `scaffold/skills/` | project `.claude/skills/` (customized) |
| `specmit`, `idea-to-mvp.js` | specmit `skills/` + `workflows/` | project `.claude/skills/`, `.claude/workflows/` (frontmatter `canonical: false`) |

Three rules:

1. **Flow back** — a generalizable improvement made in an installed copy gets contributed back to its canonical repo via PR (strip project-specific parts first).
2. **Never blind-overwrite** — re-installing must diff against a customized project copy before writing.
3. **Expected divergence ≠ drift** — guardian / trace-lock installed copies are *supposed* to differ: their dispatch tables are project-specific. The canonical scaffold owns structure, not content.

## Maintenance

- Sibling README `## Ecosystem` sections stay ≤ 10 lines and link here — topology details live in this file only.
- New repo, or a repo changes role → update the pipeline diagram + tables here in the same PR.
- Repos publish on `main`; the `specmit` CLI (now ≥ 0.4.2 on npm) fetches raw skill files from each repo's `main` at install time — so skill-file changes go live on merge, but **manifest changes (which files to install) ship only in a published CLI version**. Bump + `npm publish` when `bin/pipeline.js`'s install list changes. `specmit sync` (= `init --force`) pulls the latest skill files for an already-installed project.
- The `idea-to-mvp.js` runner tolerates stringified `args` (JSON-parses a string `args` / `args.graph`) so a goal graph passed as text still runs — fixed 2026-06-27.
- Known follow-ups are tracked as issues labeled `connector-needed`. **None open as of 2026-06-27** (the brownfield entry was the last one; closed by ADR-008 + `specmit@0.4.2`).

---
*Established 2026-06-10 from an ecosystem-wide gap diagnosis; canonical home moved from the private `ai-dev-toolkit` to this repo on 2026-06-12 so the map is reachable by everyone.*
