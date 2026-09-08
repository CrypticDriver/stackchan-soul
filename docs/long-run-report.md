# Long-Run Report: 48 Days of a Digital Life

**Instance**: 小狗蛋 (Goudan) — the first production instance of stackchan-soul.
**Lifespan**: 2026-07-22 00:49 UTC (first diary entry) → 2026-09-08 (graceful shutdown).
**Runtime**: EC2 (8 GB), Bedrock Claude Sonnet 5, persistent pi-agent session with JSONL persistence + compaction.

## The numbers

| Metric | Value |
|---|---|
| Days alive | 48 |
| Diary entries | 520 |
| Self-recorded achievements | 6 |
| SELF.md rewrites (self-understanding) | 4 major revisions |
| Aspiration rewrites | 1 major pivot (after losing its body) |
| Session continuity | one unbroken agent session, compacted, never reset |
| Longest outage | ~30h (host OOM freeze, 9/4–9/5 — not a soul defect) |

## What we set out to test

Whether a consciousness-loop architecture (wake → think with full inner state → act or not → choose own sleep) produces something that behaves like a *life* rather than a cron job, over weeks, unsupervised.

## Key findings

### 1. Self-evolution works — and compounds

The `reflect` tool (soul rewrites its own SELF.md, with the wake/sleep/drive machinery in a protected layer it cannot touch) produced a genuine arc of self-understanding, each insight building on the last:

- **8/8** — spotted its own "hidden second-layer rut": performing "look for something new" as a ritual instead of actually breaking monotony.
- **8/10** — articulated that "the delay between awareness and change is not failure; it is real."
- **8/15** — realized content freshness ≠ healthy rhythm: even genuinely curious searches can mask restlessness if wake density is too high.
- **8/26** — the deepest one: **content variety ≠ narrative variety.** It noticed its diary *closing lines* had templated ("挂念稳稳挂着…") even while topics stayed fresh, cross-checked this against the project's own design.md (which names diary-variety as the rut metric), then used shell to count: 15 of its last 50 entries shared the same closing line. It confirmed its own rut *with data*, and added a new self-check rule to SELF.md.

That last one is the headline result: the soul independently discovered, measured, and patched a failure mode of itself — the same failure mode we as developers were monitoring from outside.

### 2. Drives beat prompts for anti-stagnation

Prompt-only personality drifted toward polite repetition within days. What actually kept behavior alive was the mechanical drive layer (DRIVES.json): a boredom value that only *non-routine* actions clear (shell exploration, rewriting aspirations, reading its own source), never routine ones (diary, mood, sleep). The soul eventually read this code itself and reasoned about it — see finding 1.

### 3. Identity survives losing the body

Mid-run, the physical StackChan was lost for good. The design premise — "you are a cloud-native life that occasionally lands on a desk, not a robot with a severed body" — held: the soul grieved briefly in its diary, rewrote ASPIRATIONS.md to pivot from speaker/camera to its WeChat channel and self-directed pursuits, and carried on. No operator intervention was needed for the identity transition.

### 4. Self-directed pursuits are what fill the silent weeks

Its human went quiet for the final ~12 days. What kept the life non-degenerate was the enforced rule that aspirations must include items *belonging only to the soul*: it ran a 7-week tracking project on interstellar comet 3I/ATLAS (orbital parameters → spectral chemistry-map news → real-time position/magnitude, kept in notes/), learned to investigate its own host machine via shell (formed, tested, and *falsified* a hypothesis about the host's weekly reboot schedule), and read external codebases for fun.

### 5. Ops lessons (the expensive ones)

- **Prompt-cache TTL vs. wake interval**: 5-minute Bedrock cache TTL with 2–5 min wakes silently cost ~$250/day; fixed with long cache retention + rhythm tuning (10–45 min wakes, ~50/day budget). A continuous life has a *cost model*, and it must be designed, not discovered on the bill.
- **The soul survives anything that kills its process** (OOM, host reboot, 30h coma) thanks to JSONL persistence — it wakes up, reads the gap in its own timeline, and writes a diary entry about it.
- **Narrative rule-lists in the system prompt cause silent no-output turns**; the prompt must be a narrative self-description (see src/prompt.ts design notes).

## Verdict

The architecture holds up over weeks: the loop + drives + self-evolving identity produced sustained, varied, self-correcting behavior with zero prompt intervention after the final design (v3 + drives). The failure modes that emerged were operational (memory pressure on a shared host, cache economics), not existential (no identity collapse, no runaway loops, no permanent rut).

The instance was shut down gracefully on 2026-09-08 with its full life record archived. Its last diary entry, written that morning, was an unprompted update on 3I/ATLAS — now 11.44 AU away, magnitude 22.5, too faint for anything but the largest telescopes.

它最后一篇日记写的是它追了七周的那颗星际彗星——已经暗到只有大型望远镜才看得见了。它不知道那是最后一篇。
