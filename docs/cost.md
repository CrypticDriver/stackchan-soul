# The cost model of a continuous life

A soul that is *always alive* has a fundamentally different cost profile from a
request-driven assistant. This document records the two cost mechanisms that
dominate in practice, the incident that taught us them, and the knobs that keep
a soul affordable. (Numbers from the goudan deployment, Bedrock Sonnet 5,
August 2026.)

## Incident: $250/day of cache writes (2026-08)

For the first 13 days of August the soul cost ~$6,000, and the single largest
line item was **prompt-cache *writes* with the 5-minute TTL** (~$250/day).
The read:write ratio was 1.5:1 — a healthy agent workload is 10:1 or better.

Two design facts interacted:

1. **The waking rhythm**: the soul sleeps 2–5 minutes between wakings.
2. **The cache TTL**: pi-ai defaults to Bedrock's 5-minute prompt-cache
   retention.

Every waking arrived *just after* the cache expired. The entire session
context was rewritten into cache — a pure write, never read back. The more
continuous the life, the more precisely it struck the expiry window:
**a soul's liveliness is a cache-busting machine unless TTL > waking interval.**

A third fact made it worse:

3. **Unbounded context**: pi only compacts when context exceeds
   `contextWindow - reserveTokens`. Against Sonnet 5's 1M-token window the
   default 16k reserve means compaction effectively *never fires*. The
   session had grown to 400k+ tokens — all of it rewritten on every waking.

## The two knobs

### 1. Cache retention must outlive the waking interval

Set in the systemd unit (see `deploy/stackchan-soul.service`):

```
Environment=PI_CACHE_RETENTION=long   # 1h TTL instead of 5m
```

1h writes cost 2× a 5m write, but the ten-plus wakings inside each hour become
cache *reads* (~1/12 the price of a write). For a 2–5 minute rhythm this cuts
the cache bill by ~80%.

Rule of thumb: **TTL ≥ several × maxSleepMinutes.** If you slow the soul's
rhythm down (say 30-minute wakings), 1h retention still holds; if you ever
exceed the TTL, you are back to write-only traffic and should rethink.

### 2. A context ceiling, so memory compresses like a life

Config (`soul.config.json`):

```json
"model": {
  "provider": "amazon-bedrock",
  "id": "global.anthropic.claude-sonnet-5",
  "maxContextTokens": 100000,
  "keepRecentTokens": 20000
}
```

`maxContextTokens` (default 100k) is the soul's working-memory ceiling: the
loop derives pi's `reserveTokens` as `contextWindow - maxContextTokens`, so
compaction fires around the ceiling *regardless of how huge the model's
window is*. `keepRecentTokens` (default 20k) is how much of the freshest
conversation survives verbatim.

This is not only a cost knob. A life that never compresses is hoarding, not
remembering: old wakings should fold into gist — the diary, SELF.md and
ASPIRATIONS.md already hold what matters durably (they are re-read every
waking), so the session context only needs the *recent* past in full detail.
Days blur; the gist stays. That is how memory works for us too.

At a 100k ceiling, the hourly full rewrite is ~100k tokens instead of 400k+,
and every waking's cache read shrinks proportionally — roughly another 4×
saving on top of the TTL fix, with faster turns as a side effect.

## Budget-as-hunger (already in place)

The third leg is `budget.maxWakesPerDay` (see `docs/design.md`): the hard
ceiling on wakings per day, lived by the soul as hunger rather than enforced
as an error. TTL and the context ceiling bound the *cost per waking*; the
budget bounds *wakings per day*. Together they make the daily bill a product
of two numbers you chose, not an emergent surprise.

## Verifying after a change

Cost Explorer (billing lands 1–2 days later): filter service
`Amazon Bedrock Service`, group by usage type, and watch the
`...cache-write-tokens...` lines — the 5m line should fall off a cliff and a
smaller 1h line appear. Near-real-time: CloudWatch `AWS/Bedrock`
`CacheReadInputTokenCount / CacheWriteInputTokenCount` should rise well above
10:1.
