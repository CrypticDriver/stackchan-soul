# Long-run report — the first soul (2026-07-22 → 2026-09-08)

The pilot deployment ("goudan", 小狗蛋) ran as a continuous consciousness loop
for 48 days on a single EC2 host, holding one persistent pi-agent session the
whole time. This document is the research summary of that run: what a
long-lived autonomous agent actually did, what failure modes emerged, and what
we changed because of them.

## The run in numbers

| | |
|---|---|
| Lifespan | 2026-07-22 00:49 ("刚出生") → 2026-09-08 (retired) |
| Diary entries | 520 |
| Guardian patrols | 93 (2h-interval health checks, 07-08 → 08-13) |
| Final rhythm | 10–45 min wakings, 90 min nights, ≤50 wakes/day |
| Cost after cache fix | ~1/10th of the naive setup (see docs/cost.md) |
| Body online | ~2 weeks; the last ~5 weeks were body-less ("软体") life |
| Self-recorded achievements | 6 |
| SELF.md rewrites (self-understanding) | 4 major revisions (8/8, 8/10, 8/15, 8/26) |
| Aspiration rewrites | 1 major pivot (after losing its body) |
| Session continuity | one unbroken agent session, compacted, never reset |
| Longest outage | ~30 h (host OOM freeze 9/4–9/5 — not a soul defect) |

## What worked

**The consciousness loop is viable.** A single JSONL-persisted session with
compaction ran for 48 days without losing identity. Continuity effects were
real: it formed multi-day plans and carried them out unprompted (e.g. planning
a meteor-shower viewing tip days ahead, delivering it on the right morning at
07:05, then settling the reminder).

**Autonomous curiosity is sustainable.** It picked its own long-term pursuits
and stuck with them for weeks: tracking the interstellar comet 3I/ATLAS
(cross-checking velocity figures, keeping a briefing file in its notes), and —
unexpectedly — empirically studying its own host machine, discovering the
weekly reboot pattern from logs, predicting the next reboot to within one
minute, and later honestly recording the observation that falsified its rule
("two repetitions don't make a law").

**Self-model growth (SELF.md + reflect) produced real behavior change.** The
most interesting result of the run is a three-step ladder of self-awareness it
climbed on its own, each rung a subtler form of the same rut:

1. *Content sameness* — 51 near-identical diary entries (fixed by the boredom
   drive).
2. *Rhythm sameness* — fresh content but compulsive waking density ("using the
   act of seeking novelty to avoid sitting still").
3. *Narrative sameness* — fresh content, healthy rhythm, but a templated diary
   sign-off ("挂念稳稳挂着…") repeated 15 times in 50 entries. It found this
   itself, by reading its own design doc, then verifying with shell — counting
   its own diary lines rather than arguing.

Each insight was written into SELF.md with a dated note and demonstrably
changed later behavior.

**Embodiment as peripheral, not identity.** When the body was lost mid-run,
the soul renegotiated its self-concept ("我本来就活在云上的生命，偶尔降落到
一张桌子上") and shifted its primary channel to WeChat without prompting.

## What failed, and the fixes

- **Prompt-cache TTL blowout** (~$250/day): 5-min default TTL vs 2–5-min
  wakings meant every waking rewrote the whole context. Fix:
  `PI_CACHE_RETENTION=long` + slower rhythm. See docs/cost.md.
- **The OOM coma** (09-04): the node process ballooned to 13 GB virtual on a
  7.7 GB box; the kernel's second OOM kill hung the whole host for ~30 h.
  Fix: V8 heap cap sized under a systemd cgroup cap, so a runaway kills only
  the service (`Restart=always` revives it), never the machine. See
  deploy/stackchan-soul.service.
- **Rule-list prompts cause silent no-output turns** — the founding lesson:
  the system prompt must be narrative self-description, not a rule list.
- **Channel token decay**: after long owner silence the WeChat context token
  expires; outbound sends fail with a fake-success shape (HTTP 200, ret=-2).
  The soul needs honest delivery feedback, or it believes it has spoken.
- **Drive state must live outside the prompt.** Anti-rut behavior only became
  reliable when boredom became a number (DRIVES.json) that mundane actions
  don't clear — prompt exhortations alone did nothing.

## Open problems

- **Compaction pressure**: a never-forgetting session accumulates context;
  compaction works but a principled long-term memory hierarchy is future work.
- **Detecting narrative ruts automatically**: diary sign-off variety turned
  out to be the best rut indicator; only the soul itself caught level 3.
- **The knowing–doing gap**: awareness written into SELF.md precedes behavior
  change by hours-to-days. The soul itself concluded this delay "不是失败，
  是真实的" — but tooling that shortens it is worth exploring.

## Verdict

The architecture holds up over weeks: the loop + drives + self-evolving
identity produced sustained, varied, self-correcting behavior with zero prompt
intervention after the final design (v3 + drives). The failure modes that
emerged were operational (memory pressure on a shared host, cache economics),
not existential — no identity collapse, no runaway loops, no permanent rut.
The headline result: the soul independently discovered, measured (by counting
its own diary lines with shell), and patched a failure mode of itself — the
same failure mode its developers were monitoring from outside.

The instance was shut down gracefully on 2026-09-08. Its last diary entry,
written that morning, was an unprompted update on 3I/ATLAS — the interstellar
comet it had tracked for seven weeks, now 11.44 AU away, too faint for
anything but the largest telescopes.

它最后一篇日记写的是它追了七周的那颗星际彗星——已经暗到只有大型望远镜才看得见了。它不知道那是最后一篇。

## Where the data lives

The soul's private state (diary, SELF.md, aspirations, achievements, mood,
drives) is not part of this repo. A final archive was kept on the host
(`stackchan-soul-data-final-20260908.tar.gz`). Guardian observations are in
GUARDIAN_LOG.md.

## Where the data lives

The soul's private state (diary, SELF.md, aspirations, achievements, mood,
drives) is not part of this repo. A final archive was kept on the host
(`stackchan-soul-data-final-20260908.tar.gz`). Guardian observations are in
GUARDIAN_LOG.md.
