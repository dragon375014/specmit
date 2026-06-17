---
name: specmit
description: |
  使用者要「一個指令跑完 idea→spec→goals→平行執行」整條管線、或手上已有 spec-sonar 產出的
  goal graph 想直接平行執行時 trigger。本 skill 是 L3b bridge：把檔案世界（goal-graph.json /
  goals/G*.md）接上 Claude Code 的 Workflow 引擎（workflows/idea-to-mvp.js），自己不實作任何
  分解或執行邏輯——鬆耦合，只靠檔案格式（PIPELINE-CONTRACT.md）溝通。

  明確 trigger keyword：「跑完整管線」「一條龍」「idea to mvp」「把 spec 跑成 MVP」
  「執行 goal graph」「平行執行 goals」「跑 pipeline」「run the pipeline」。

  不 trigger：
  - 還在收斂規格（讓位 idea-to-spec）
  - 只要分解不要執行（讓位 goal-decomposer）
  - 單一任務要打磨（讓位 goal skill）
  - 同質批次掃描（讓位 workflow-shaper——那是「同一檢查 × N 單位」，這裡是「異質 goal 依賴圖」）
---

# specmit — L3b bridge skill

> 角色：**接線生，不是工人**。檢查管線該從哪一段進、把 goal-graph.json 餵給 runner workflow、
> 落地 run-report 與 status writeback。所有格式規則見 [PIPELINE-CONTRACT.md](../../PIPELINE-CONTRACT.md)。

## Step 0 — 管線進度路由（先判斷從哪段進）

| 現場狀態 | 動作 |
|---|---|
| 連 spec 都沒有（只有想法） | 讓位 **idea-to-spec**（5–7 輪收斂），完成後回到本表 |
| 有 `spec/project-spec.md` 但無 `spec/goal-graph.json` | 讓位 **goal-decomposer**（分解出 graph + goals/），完成後回到本表 |
| 有 `spec/goal-graph.json` + `spec/goals/G*.md` | 進 Step 1 |

## Step 1 — 起飛前檢查（fail fast，省一次 workflow 啟動）

1. Read `spec/goal-graph.json` → 確認 `schema_version` 值等於 `"1.0"`（字串或數字皆可，`1.0 == "1.0"` 視為相符；不符 → 停，回報需要升級 contract）
2. 抽查 `goals[].file` 指到的檔案存在（缺檔 → 停，回 goal-decomposer 重生成）
3. 多 session 環境（repo 有 WORK-BOARD.md）→ 先掃「進行中」確認 `projectDir` 沒人認領，並加一列認領
4. 引擎同一性檢查：確認 `scriptPath` 解析到**專案內**的 `.claude/workflows/idea-to-mvp.js`；
   若使用者家目錄（`~/.claude/workflows/`）存在同名但內容分歧的副本 → 警告使用者
   （兩份同名引擎、語義不同 = 換個 cwd 啟動就靜默改變行為，曾實際發生過 BLOCKED 語義完全相反的分歧）

## Step 1.5 — Pre-flight 簡報（輸出後立刻進 Step 2，不等使用者回覆）

讀 `project_setup` 欄位 + goal 統計，輸出以下格式，**然後立刻 call Workflow()**——使用者在 pipeline 跑的時候去準備，兩邊平行：

```
🚀 [專案名稱] — 管線啟動中

📋 請你在 pipeline 跑的時候同步完成：

① 申請帳號（手動，只能你去做）：
   • [服務] → [url]（[note]）

② 填入 .env（key 準備好後手動填）：
   • [KEY_NAME]  ← 哪裡找：[where]
   （若 .env 已存在且有這些 key，可略過）

⏱ 預估執行時間：約 X–Y 分鐘
💰 預估費用：約 $A–$B USD（Sonnet 基準 ±50%）
📊 [N] goals / [B] 批次 / haiku×[h] sonnet×[s] opus×[o]

▶ 管線啟動中，以上事項請並行處理...
```

**若 `project_setup` 不存在**，跳過 ① ② 只顯示時間/費用/統計，直接啟動。

---

**計算公式（數字填入前先算）：**

時間：
- 每批次耗時 = 該批最慢 goal 的基準時間（haiku=1分、sonnet=3分、opus=7分）
- wall-clock = Σ(各批最慢 goal 時間) × 1.2
- 顯示範圍：wall-clock ~ wall-clock×1.5（如「約 9–14 分鐘」）

費用（全依 Sonnet 計，最壞情況；haiku/opus 自動調整說明）：
- 輸入：每 goal 讀 goal 檔約 4,000 tokens + 系統提示 2,000 = 6,000 tokens/goal
- 輸出：每 goal 約 1,500 tokens
- 單 goal 費用：(6000×$0.000003) + (1500×$0.000015) = $0.018 + $0.023 = ~$0.04
- N goals：~$0.04×N（下限）~ $0.04×N×1.8（上限）
- 顯示：「約 $X–$Y USD（Sonnet $3/$15 per MTok）」
- 有 opus goal 提示：「含 opus tier，實際費用會更高」
- 有 haiku goal 提示：「haiku tier 約便宜 6–10×」

## Step 2 — 啟動 runner

```
Workflow({
  scriptPath: '.claude/workflows/idea-to-mvp.js',
  args: {
    graph: <parsed goal-graph.json>,   // bridge 讀檔，script 沙箱無 fs
    specDir: 'spec',
    projectDir: '.',
    serial: false,        // 平行 agent 撞共享檔時的逃生口 → true
    only: null,           // resume：只重跑指定 goal ids，上游信任 graph 內 prior status
    scorecard: 'full',    // 獨立驗證棘輪：'full'(預設) / 'cheap'(只 Tier-1) / 'off'(退回無稽核)
    autofix: 'off'        // 自動修回邊：'off'(預設,只查不修) / 'normal'(修1次) / 'aggressive'(最多3次)
  }
})
```

batch 內平行的安全性由 goal-decomposer 的模組分解保證（這正是依賴圖存在的意義）；
真撞檔 → `serial: true` 重跑，或對撞檔 goals 用 `only:` 分兩波。

**scorecard（驗證棘輪）— 預設開，通常不用動**：每個自報 verified/done 的 goal，加派一個
**獨立、唯讀、只能收緊**的稽核員（球員兼裁判 → 唯讀稽核員）：Tier-1 純 JS 抓自相矛盾、
Tier-2 fresh agent 重跑冪等驗證指令 + git diff 反查 ground truth。`pickTighter` 保證它**只能降、
不能升**；稽核員 tier 不低於 executor；稽核員死掉 fail-closed（verified→done + 標記，不打 failed）。
- `cheap`：只跑免費的 Tier-1（快、零 token，仍抓「說 verified 卻無證據」）。
- `off`：完全退回無稽核（回歸測試逃生口）。

**autofix（自動修回邊）— 預設 off，這是把線變成 loop 的旋鈕**：scorecard 只查不修＝線性管線 +
驗證閘；`autofix` 加上「失敗→修→再審」那條回邊。`normal` 修 1 次、`aggressive` 最多 3 次。
**安全來自旋鈕只轉 optimizer**：修補者是重 spawn 的 executor（會寫），稽核員永遠唯讀，**每次修完都被同一個獨立稽核重審**（修補者不准自我認證＝球員兼裁判防線升一層）；棘輪保證壞修只會被收緊不會放行，所以轉到底**只花 token、不傷正確性**；修不過就硬停、丟回給人。`autofix` 需要 `scorecard` 開著（它靠稽核的反駁信號驅動）。
回報帶 `autofix_attempts/repaired/exhausted` 三個數——**靠數據調旋鈕，不靠感覺**。建議從 `normal` 起步。

**內圈 vs 外圈邊界**（這支 skill 守的線）：scorecard 屬**內圈**（機器自動做、每個 goal 內、只收緊）。
它**永遠不碰 spec、不改 scope、不替使用者接受未驗的工作**——那些是**外圈**（人）：blocked 問題、
failed/降級 goal 的處置、改 goal 還是改 spec、接受 done。一句話：**動到 scope/spec/接受未驗 → 人；
讓既定 goal 通過它自己既定的驗證 → 機器。**

## Step 3 — 落地（workflow 回來之後，bridge 的責任）

1. 蓋時間戳 `run-id = YYYYMMDD-HHMMSS`，寫 `runs/<run-id>/run-report.json`（格式：CONTRACT §5）
2. Status writeback：把每個 goal 的結果寫回 `goal-graph.json` 的 `goals[].status` —— **唯一可動欄位**（CONTRACT §4），其他一律不碰
3. `summary.questions` 非空 → 把 BLOCKED 問題逐條呈給使用者（這是 BLOCKED protocol 的出口：agent 不猜，人來裁決），裁決後用 `only: [被擋的 ids]` resume
4. 有 `failed` → 附 verify.evidence 回報，建議修復路徑（goal 層問題 → 改 goal 檔重跑；規格層問題 → 回 goal-decomposer）
5. 彙整「未驗收清單」：對每個 `status === "done"` 的 goal，把其 goal 檔驗收條件中
   未被機械執行的項目（executor notes 的 `UNVERIFIED:` 行 + summary.needs_manual_verification）
   逐條抽出，寫 `runs/<run-id>/manual-verification.md` 並完整呈給使用者。
   **報告措辭規則：done ≠ 驗收完成。** 標題行必須寫成「verified X / done-未驗 Y」，
   不得讓 done 與 verified 合併讀成全綠（曾發生 24 條驗收無人執行卻被讀成全勝的事故）
6. `summary.scorecard_downgrades > 0` → 獨立稽核員把某些 goal 收緊了（自報 ≠ ground truth）。
   逐條把被降級的 goal（`p.scorecard.upheld === false`）連同 `p.scorecard.discrepancies`（稽核員
   實際觀察到的落差）呈給使用者——**這是「球員兼裁判被抓到」的出口，務必明顯標出，不可淹沒在綠燈裡。**

## Step 4 — skill-signal reflection（跑完那一刻的反向器官 · evidence-gated）

> 體系的觸發器幾乎全是「往前蓋」；這一步是 skill 系統的「往後查」器官——問一次「這趟有沒有暴露出 skill 缺口，
> 該被捕捉成可複用的東西」。**輕量版：偵測 + 提議，人來拍板。** 跑完 Step 1–3 後**做一次**。

**只看證據,不憑感覺。** 反思的素材是這趟**真的撞到的牆**——不是腦補。來源限定在：
`summary.questions`（blocked 問題）、`failed` goal 的 `verify.evidence`、`scorecard.discrepancies`、
`autofix_exhausted` 的 notes、各 goal notes 的 `UNVERIFIED:` 行。對著這些問五種信號：

| 信號 | 意思 |
|---|---|
| `skill_gap` | 任務要的知識,現有 skill/memory 都沒覆蓋,靠猜完成 |
| `conflict` | 兩份 skill 指引互相矛盾,模型自己選了一個 |
| `imprecision` | skill 存在但太籠統,必須自行詮釋 |
| `edge_case` | skill 覆蓋 90%,這次是那 10% |
| `new_pattern` | 做了某動作沒對應 skill,且未來很可能再撞 |

**鐵律（防幻覺式過度輸出,比 confidence 門檻更硬）**：
- **每條信號必須引用具體證據**——實際 error 訊息 / 找到的 workaround / 哪個既有 skill 在哪裡不夠。**拿不出證據 → 不准提。**
- **預設輸出是「無」。** 大多數 run 不會留下可複用教訓（撞牆是稀有事件）。寧可漏報,不要誤報。
- 有信號 → 寫 `runs/<run-id>/skill-signals.json`（`{signal_type, target_skill, gap_description, evidence, suggested_addition, triggered_by}`）+ 簡短呈給使用者。

**動作邊界（球員兼裁判升一層）**：信號只能**提議**——「建議補一條 memory/check/skill：X,因為實際撞到 Y。要我草擬成 PR 嗎?」
**人點頭才草擬 → PR → 人 merge。絕不自動套用、絕不自動 merge**（迴圈不准在沒人看的情況下改寫自己的規則；這是內/外圈邊界：改規則 = 外圈 = 人）。

> 真實案例:`node --check` 對 Workflow runner 假陽性那次,就是一個 `new_pattern` 信號——撞到牆、找到解法（AsyncFunction wrap）、未來會再撞。當時是**手動**捕捉的（寫了 memory + `scripts/check-syntax.mjs`）。這一步就是讓「手動捕捉」不再靠「剛好想到」。
>
> **刻意不做的重版（N≥2 才升級）**：自動撈 queue、高信心自動發 PR、skill 自我進化（Hermes 式）。那是 optimizer 那半、自動改規則風險最高,等這個 pattern 真的再發一次再蓋。

## 失敗模式速查

| 症狀 | 含義 | 出口 |
|---|---|---|
| Validate 丟 cycle | 依賴圖有環 | 回 goal-decomposer 重分解 |
| Validate 丟 missing goal | graph 不完整 | 同上 |
| 「Kahn fallback」warning | decomposer batches 與 depends_on 矛盾 | 可繼續（runner 已自救），但回報 spec-sonar 修 bug |
| 大量 blocked 連鎖 | 最上游一顆 goal 倒了 | 先修那顆，`only:` resume |

## 生態系定位

spec-sonar（收斂+分解）→ **本 skill + idea-to-mvp.js（執行軌）** → 各專案 domain skills（executor agent 的手）→ governance-meta（executor prompt 內建治理 hook：宿主閘門必須跑過不得繞）。地圖：[specmit/ECOSYSTEM.md](https://github.com/dragon375014/specmit/blob/main/ECOSYSTEM.md)。
