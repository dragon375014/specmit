#!/usr/bin/env node
// pipeline-stage-notifier — Claude Code PostToolUse(Write) hook.
//
// 確定性的「階段交接提醒」：當管線某一站把它的產物檔寫出來時，注入一段 context，
// 提醒模型主動提議下一棒（idea-to-spec 步驟九 / goal-decomposer 步驟八 / Audit A7 = ADR-004/006）。
//
// 為什麼是 hook：skill 裡的 AskUserQuestion offer 是「軟」的（模型偶爾忘了問）。這個 hook 在
// 「產物檔剛被 Write」的當下確定性觸發、注入提醒，把軟 offer 硬化——但**只在 Claude Code 有效**
// （其他平台沒有 hook 機制，照舊走 skill 的軟 offer，可攜性不掉 = 能力閘加法層，同 ADR-001）。
//
// 注入的是「提醒模型去 offer」，不是自動推進——人仍然拍板（主動提議≠自動推進）。
// 非管線檔一律靜音；任何錯誤都靜音 exit 0，絕不擋主流程。

import { basename } from 'node:path'

// 產物檔 → 下一棒提醒（model-facing；通用、無專案特定指令）
const STAGES = {
  'STATE_FINAL.json': {
    stage: 'idea-to-spec 收斂',
    next: 'goal-decomposer 把規格分解成帶依賴的 goal 圖',
    skill: 'idea-to-spec 步驟九（ADR-004）',
    ask: '要現在分解嗎？',
  },
  'goal-graph.json': {
    stage: 'goal-decomposer 分解',
    next: 'specmit / idea-to-mvp 跑完整管線（平行執行）',
    skill: 'goal-decomposer 步驟八（ADR-004）',
    ask: '要現在跑嗎？',
  },
  'remediation-goals.md': {
    stage: 'Audit 體檢',
    next: 'triage（fix-now / roadmap-defer / intentional）→ 人選 fix-now → 分解 → 跑；high blast-radius 執行前人看 SQL',
    skill: 'Audit Mode A7（ADR-006）',
    ask: 'fix-now 候選有哪些、要修哪幾個？',
  },
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (buf += c))
    process.stdin.on('end', () => resolve(buf))
    // 安全閥：stdin 沒來就別卡住
    setTimeout(() => resolve(buf), 2000)
  })
}

try {
  const raw = await readStdin()
  const input = JSON.parse(raw || '{}')
  const fp = input?.tool_input?.file_path || ''
  const s = STAGES[basename(fp)]
  if (!s) process.exit(0) // 非管線產物 → 靜音

  const ctx =
    `[管線階段交接 — 確定性提醒｜${s.skill}]\n` +
    `偵測到「${s.stage}」的產物 \`${basename(fp)}\` 剛寫出。\n` +
    `請**主動提議下一棒**：${s.next}。\n` +
    `用 AskUserQuestion（有就用卡片、沒有就用文字）問使用者：「${s.ask}」，推薦選項排第一、保留「先停在這」逃生口。\n` +
    `這是「主動提議」不是「自動推進」——等使用者選了才繼續。`

  process.stdout.write(
    JSON.stringify({
      continue: true,
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: ctx },
    }),
  )
  process.exit(0)
} catch {
  process.exit(0) // 任何錯誤都靜音，不擋主流程
}
