# Phase 4 performance report

## Phase 4.3 measured remediation — October 26, 2026

Current candidate is described in [P4_03_REMEDIATION_REPORT.md](P4_03_REMEDIATION_REPORT.md). The original Phase 4 report below is preserved. Final generated release: `e759216677bd42a3d9659c143c0a5b8be0e583844c3650fdb7970f40d8e59809`; Windows Chrome 155.0.8059.86. Baseline `.phase2-backup/phase4-3/baseline/independent/summary.json`; after `.phase2-backup/phase4-3/validated/independent/summary.json` and separate `validated/solver/summary.json`.

| Actual scheduled Board seed-42 path | Normal before | Normal after | 4× page CPU before | 4× page CPU after |
| --- | --- | --- | --- | --- |
| Synchronous main-thread planner | 286.9 ms | **0 calls** | 2,316.6 ms | **0 calls** |
| Maximum RAF interval | 283.2 ms | **33.4 ms** | 2,499.8 ms | **50.0 ms** |
| RAF p95 after | — | 16.8 ms | — | 16.8 ms |
| Endgame worker compute | — | 265.3 ms | — | 279.9 ms |
| Request-to-reply, including startup/scheduling | — | 280.7 ms | — | 3,066.2 ms |

Both requests used the matching immutable worker/engine release and returned `no-plan-within-budget`. No main-thread long task was observed between request and reply. The 4× window retained a **187 ms pre-request render/setup long task**, which was not removed by worker offloading. CPU throttling targets the page; worker compute figures do not establish uniform worker/GPU throttling or physical mobile speed. Search compute, optional-plan availability and main-thread blocking are different measurements. No real-user INP claim is made.

The new dedicated suite additionally measures a constructed two-move terminal fixture and a seed-42 two-suit hand advanced through 40 legal actions, retaining normal hidden cards. Near-win worker compute was **1.0 / 1.0 ms**, maximum RAF **17.0 / 16.8 ms** at normal/4×; the reachable-hand stuck check was **1.2 / 1.3 ms**, maximum RAF **16.8 / 16.9 ms**. Its hard seed-42 worker took **274.6 / 292.7 ms**. The dedicated normal hard sample nevertheless recorded **499.9 ms maximum RAF with no corresponding JS long task**; its 4× maximum RAF was 16.9 ms, with a separate 163 ms render/setup task. This discrepancy remains unexplained and retained, rather than excluded to claim universally smooth rendering. The reachable 4× setup also produced a 121 ms long task. Artwork/layout were warmed before these dedicated measurements; earlier cold/concurrent diagnostics are retained separately.

Board now owns one asynchronous request/worker at a time, with exact session/revision/request/epoch checks and a four-second deadline. Existing endgame 20,000-node and stuck-search budgets remain; missing/crashed/hung workers never invoke a main-thread search or prove a hand impossible. The old recursive endgame planner overflowed the actual worker stack in a retained diagnostic. Explicit DFS frames remove that stack dependency, preserve 19 captured original outcomes and avoid repeated path copies; card rules and F15 heuristic remain unchanged.

**Current result: P4-02/F13 repaired for the tested candidate.** All 352 Node, 24 solver, 13 mobile, 46 offline, 19 multi-tab and 34 independent browser checks pass. Remaining risks include rendering/decode/layout work, the RAF discrepancy, worker memory/CPU/battery cost, finite-budget missed solutions, startup latency, OS suspension and physical-device behavior. Worker deadlines are event-loop-serviced, not hard real-time guarantees. Field metrics, deployment/CDN and physical Safari/Android remain unmeasured. No overall release GO follows from this performance repair.

Independent local lab, 2026-10-26T03:21:17.269Z; Chrome/155.0.8059.86; Node v24.22.0. Target SHA 65d902e5d542de38f7fedc4a51b3c1314201a23c, release 61d8345f99c93b5a67f55238de98c1438bd00a64a4986d495b1cc8b0205262ec. These observations do not certify production Core Web Vitals or physical device behavior. Raw data and timings: .phase2-backup/phase4/independent/summary.json; Node stress trials: .phase2-backup/phase4/solver-node.json.

## Method and limitations

The tracked tools/phase4-browser.mjs serves the actual generated dist, no compression and Cache-Control no-store, at a fresh loopback port. Each delivery run uses a separate empty browser storage partition, disabled HTTP cache, generated SRI/base paths and ?nosw to isolate delivery from background service-worker install. Desktop is 1440x900, CPU1x/unthrottled loopback. Phone is 390x844, CPU4x, 40ms network latency and 200,000 B/s throughput (1.6 Mbit/s), not an actual mobile network or device. Runtime observations add PerformanceObservers for LCP candidates, maximum CLS session window excluding recent-input shifts, long tasks, and canvas draw counters. CDP samples DOM/heap and worker targets. Main thread CPU, GPU and thermal behavior are the host's, not representative population data.

Fresh first-time flow is actual splash -> intro -> shield selection -> Begin Forging -> tutorial board. Programmatic DOM clicks do not include human reading/dwell or a trusted first-input boundary. Time to board means active screen plus 54 card DOM nodes, not proof that every CSS-background card has decoded or a human understood controls. LCP is the observed candidate at the recorded initial snapshot after a painted frame; because onboarding uses synthetic clicks, it can include a later board background and is not a standard finalized first-input field LCP. No real-user INP, percentile distribution, SEO/performance score or production bandwidth claim is made.

Single-run numbers are reproducible lab evidence with normal variance, not statistical budgets. Resource entries are completed transfers at that snapshot; later suit art, optional downloads and pending assets are excluded. Browser transferSize includes HTTP overhead and reflects local uncompressed serving, not CDN Brotli. No third-party game requests or missing game assets were observed in the final independent run; actual deployment injection remains NOT TESTED.

## Measurements

| Lab | First intro | Board available | Observed LCP candidate | CLS sample | Completed resource transfer | Scheduled Board solver | Largest frame gap during solver |
| --- | --- | --- | --- | --- | --- | --- | --- |
| desktop-cold | 2.49 s | 2.77 s | 3.76 s | 0.000 | 1,160,327 B | 389.4 ms | 367.3 ms |
| phone-lab-4x-fast4g | 5.05 s | 6.31 s | 4.00 s | 0.000 | 858,747 B | 2055.9 ms | 2166.5 ms |

All game scripts loaded in the initial resource sample total **259,870 decoded bytes**. Assets dominate total delivery; original artwork/fonts are unchanged. The core catalog is **74 files / 2,624,670 raw bytes**, including mode-picker previews and default one-suit gameplay. Full optional artwork is a separate finite download; cache usage includes implementation/storage overhead and is not equal to raw asset bytes. Initial portfolio imagery remains a separate delivery concern (F16), not measured as game LCP here.

Current generated core navigation-to-ready took **2,578 ms** on unthrottled loopback. This includes page startup and registration, not isolated native install-event time or an offline installation bandwidth guarantee. Browser storage estimate at that point: **3,181,443 B** total, **3,152,128 B** caches. Quota estimate is device/session specific and is not a durability reservation.

## Solver blocking: FAIL P4-02 / F13

Current board.js:464-472 calls solveEndgame synchronously; the worker only owns stuck search, with a synchronous fallback at :480-494. Stress fixture: new four-suit seed1/42/100, deal all stock, set cards up, clear history; validate through actual Store. It is schema-valid but deliberately constructed, not a recorded naturally reached hand. Direct solver timings are supplemented by a test-only duration wrapper around the unchanged algorithm in the **actual scheduled Board path** for seed42. That path generates a real PerformanceObserver long task and stalls the RAF sample; this is stronger evidence than a CDP evaluation duration alone.

| Lab | Direct solver samples | Observed long-task durations through scheduled solver |
| --- | --- | --- |
| desktop-cold | seed 1: 282.2 ms; seed 42: 427.2 ms; seed 100: 269.5 ms | 183, 72, 390 ms |
| phone-lab-4x-fast4g | seed 1: 1870.6 ms; seed 42: 2531.7 ms; seed 100: 1688.5 ms | 277, 50, 70, 562, 538, 98, 77, 79, 64, 74, 71, 98, 112, 79, 70, 70, 350, 2060 ms |

The source's node-count budget does not impose a wall-time/frame bound. Sampled post-undo motion looked smooth in this lab but freezes during hard planning. Exact frequency in player games is unknown. Recommend cancellation-aware revision-tagged worker planning and a bounded/omitted fallback, retaining existing rules and ownership guards. No stack overflow was reproduced. Record device-specific acceptance before waiving this P2; do not rename these timings INP.

## Frames and repeated sessions

| Lab | Post-undo RAF samples (1.5s) | p95 / max interval | After 20 games: documents / DOM nodes / listeners | JS used heap after GC | Live dedicated workers after churn |
| --- | --- | --- | --- | --- | --- |
| desktop-cold | 91 | 16.9 / 33.2 ms | 1 / 1366 / 63 | 1,632,020 B | 0 |
| phone-lab-4x-fast4g | 82 | 33.3 / 66.8 ms | 1 / 1367 / 63 | 1,803,004 B | 0 |

The short post-undo sample includes animation/settling/idle, not sustained pointer dragging or a complete ceremony. Solver frame gaps are reported separately above. Churn cycles one/two/four suits, deal/undo, home/resume, twenty times in one document; lifecycle cleanup leaves no dedicated worker in the sampled final state. Before counters are retained in raw JSON. Initial and final hand contents differ; initial heap is not forced-GC normalized, final heap is. Therefore this is **not** a heap-leak proof, a per-game slope or maximum memory bound. Long-session detached DOM/worker/native memory remains NOT TESTED beyond these samples.

## Accessibility and offline effects

FAIL P4-04: switching OS reduced-motion preference while home remains open makes FX.motion false yet draw calls continue; the independent summary retains before/after counts. FAIL P4-03: optional download reports all modes offline while missing core persists. Those are functional correctness defects, not optimizations justified solely by a score. Original 13 mobile browser checks and 41 offline upgrade checks pass independently; they did not cover these cases.

Lighthouse CLI was absent from PATH, and import.meta.resolve('lighthouse') returned ERR_MODULE_NOT_FOUND. **NOT TESTED: no Lighthouse score/report exists.** No dependency was silently installed. Original CDP observer data is retained as JSON, not presented as a Lighthouse report. Physical iOS/Android, real toolbar zoom, battery/thermal pressure, real Vercel compression/cache/CDN, field LCP/CLS/INP and sustained gameplay frame traces remain uncollected.

## Disposition

Performance alone is not graded universal GO. P4-02 is a reproduced P2 requiring measured mitigation/owner acceptance; mobile long tasks are material. The overall channel decision is NO-GO because of the independent P1 persistence defect plus essential evidence gaps, not because every unmeasured optimization is automatically a blocker. See ISSUE_REGISTER and GO_NO_GO for effort/ownership and LAUNCH_RUNBOOK for re-certification.
