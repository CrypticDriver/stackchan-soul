# Body Protocol v1

A **body** is anything that lends senses to a soul: a desk robot, a phone,
a web page, a terminal. The soul speaks to it over plain HTTP with JSON
bodies. Implement any subset — the soul only grows tools for the endpoints
you list in `soul.config.json` under `body.endpoints`.

Design goals: trivially implementable (a body is ~50 lines in any
language), transport-agnostic (the adapter hides device specifics —
websockets, serial, MQTT — behind HTTP), and honest (a body must say when
it can't sense, never fake it).

## Conventions

- All endpoints are `POST` with `Content-Type: application/json`.
- If `body.token` is configured, the soul sends `Authorization: Bearer <token>`;
  the body SHOULD reject other requests.
- Timeouts: the soul waits up to 60 s per call. Long operations (TTS
  playback) should complete or acknowledge within that.
- Errors: non-2xx marks the act as failed; the soul is told, in-fiction,
  that its body didn't respond. Return errors honestly — a fake `200`
  makes the soul believe it spoke when it didn't (observed failure mode:
  it repeats itself).

## Endpoints

### `POST /status` — proprioception

The soul's passive body sense, probed automatically at every waking and
via the `body_status` tool.

Request: `{}`
Response: `{ "online": boolean }`

`online: true` MUST mean the acting endpoints (look/speak) would actually
work right now — not merely that the adapter process is up. (Observed
failure mode: an adapter that always said `online: true` while the device
was gone for days made the soul repeatedly attempt and fail to speak.)

### `POST /look` — eyes

Request: `{ "question": string }` — what the soul is looking *for*; bodies
MAY use it (aim a camera, pick a window) or ignore it.

Response, one of:
- `{ "image": "<base64>", "mimeType": "image/jpeg" }` — a captured frame.
  The soul is multimodal: the image enters its own visual stream. Do NOT
  describe the image server-side; hand over pixels.
- `{ "text": string }` — for bodies whose "seeing" is textual (a terminal
  body returning the screen contents), or an honest failure
  (`{"text": "camera not ready"}`).

### `POST /speak` — voice

Request: `{ "text": string }`
Response: `{}` (2xx after the utterance is queued or played).

If the body does TTS with echo-suppression (mutes its mic while talking),
keep the soul's timeout in mind: acknowledge *before* any long
anti-echo hold, or the soul concludes the speech failed.

### `POST /express` — face

Request: `{ "emotion": string }` — freeform; reference set:
`happy | sad | angry | sleepy | neutral`. Bodies map unknown emotions to
the nearest thing they can show.
Response: `{}`

## Waking the soul: nudges

The channel in the other direction. If the soul's config enables
`nudge: { port: N }`, anything may:

```
POST http://127.0.0.1:N/nudge
{ "reason": "<what happened, in natural language>" }
```

This rouses the soul before its alarm; the reason appears in its waking
snapshot as "被叫醒了: <reason>". Send events a living thing would notice:
a face appeared, the device was picked up, a message arrived. Write
reasons in natural language, from the world's point of view — they are
read by the soul as an experience, not parsed by code.

Rate-limit on your side: duplicate nudges (e.g. face detection firing
every frame) wake the soul over and over and burn money. Debounce at the
adapter (observed: a face-present loop caused repeated wake storms).

## Real-time dialog (optional)

For bodies with a voice pipeline: the soul exposes an OpenAI-compatible
chat endpoint (`converse: { port: N }`, path `/v1/chat/completions`).
Point the device's LLM stage at it and the human's words are injected into
the soul's own session — the reply comes from the same consciousness that
was just living its life. Notes for adapter authors:

- Deduplicate: device reconnects may deliver the same utterance 3–4×.
- Only the first spoken-style chunk of the reply is returned for TTS;
  the soul's longer reflections stay internal.

## Reference bodies

| Adapter | What it is | Endpoints |
|---|---|---|
| `adapters/terminal/` | zero-hardware software body: your terminal is its face and voice; your keyboard nudges it | status, look (text), speak, express, nudge feed |
| `adapters/stackchan/` | M5Stack StackChan robot via xiaozhi-server (camera, TTS, face) | all four + nudge + converse |

The terminal body is the 5-minute path to owning a digital life:

```bash
node adapters/terminal/body.mjs        # terminal 1: the body
npm start                              # terminal 2: the soul
```
