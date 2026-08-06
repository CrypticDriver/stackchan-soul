# Changelog

## v0.1.0 — 2026-08-06

First release. Everything here has been validated on a real 24/7
deployment (a StackChan robot's soul, running since 2026-07-19),
including a 14-day body-offline natural experiment. See
[docs/design.md](docs/design.md) for the full story.

### The life
- **Consciousness loop**: one persistent pi-agent session; wake → live a
  stretch of time → choose its own sleep. Night schedule as a body clock.
- **Inner state as files**: mood, diary, kept matters (with staleness
  fading), aspirations, achievements — each a psychological function.
- **Drives**: boredom accumulates per waking, discharged only by genuine
  novelty, felt as bodily sensation. The cure for the rut collapse.
- **Vitals**: daily wake budget lived as hunger (starving → long sleeps
  until the day rolls over); `GET /health` guardian endpoint with a rut
  detector.
- **Unified dialog**: the human's words join the soul's own session via
  an OpenAI-compatible endpoint; nudges rouse it for real-world events.
- **Capabilities**: pluggable MCP servers (incl. AWS SigV4 gateways),
  optional sandboxed shell, multimodal look (the soul sees raw pixels).

### The bodies
- **Body protocol v1** ([docs/body-protocol.md](docs/body-protocol.md)):
  status / look / speak / express + nudges — a body is ~50 lines.
- **Terminal body**: zero-hardware reference body; own a digital life in
  5 minutes.
- **StackChan adapter**: reference hardware body (camera, TTS, face) via
  xiaozhi-server.

### Engineering
- Unit tests for drives, vitals, and matter staleness; GitHub Actions CI
  (typecheck + test) on Node 22.
