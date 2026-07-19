# stackchan-soul

**A universal remote soul for embodied devices.**
一个通用的"具身设备远端灵魂"——常驻的意识循环，让桌面机器人拥有自主性和好奇心。

Built on [pi](https://github.com/badlogic/pi-mono) (`@earendil-works/pi-coding-agent`) — a minimal, extensible agent runtime.

## 为什么

市面上的"AI 机器人"都是被动应答：你说话，它回话；你不说，它是砖头。
定时器驱动的"主动"也是假的——那是 cron 在抽搐，不是生命在生活。

**真正的自主性 = 意识是一个循环，不是一个请求处理器。**

stackchan-soul 是一个常驻进程：一个持久 pi-agent 会话（永不失忆，靠 pi 的
JSONL 持久化 + compaction），醒来 → 带着完整内心状态想一想 → 也许睁眼看看世界 /
说句话 / 记篇日记 → **自己决定睡多久** → 睡去。节奏属于灵魂自己。

```
        ┌─────────────────────────────────────────┐
        │              stackchan-soul             │
        │  (persistent pi-agent session, 24/7)    │
        │                                         │
        │   wake ── think ── act? ── sleep(n) ──┐ │
        │    ▲    (mood, diary,    look/speak   │ │
        │    │     longing)        /diary       │ │
        │    └──────────── n minutes ───────────┘ │
        └───────┬──────────────────┬──────────────┘
                │ shared inner     │ generic body endpoints
                │ state (MOOD.md)  │ status / look / speak / express
        ┌───────▼───────┐  ┌───────▼──────────────┐
        │ dialog agent  │  │  body adapter (HTTP) │
        │ (any impl,    │  │  ── any device ──    │
        │  optional)    │  │  ref: StackChan      │
        └───────────────┘  └──────────────────────┘
```

## 设计原则

1. **灵魂在云端，躯体只借感官。** 好奇心、什么时候看、看完说不说——都是
   agent 自己的判断，不是固件定时器。
2. **一个灵魂，两个半球。** 实时对话可以交给任意对话 agent（可选），
   自主生活归 soul。两者共享 MOOD.md / 记忆 → 同一个内心。
3. **躯体可插拔。** 任何设备实现 `status/look/speak/express` 几个 HTTP 端点
   就能承载灵魂。参考适配器：M5Stack StackChan（`adapters/stackchan/`）。
4. **无为是常态。** 一个每次醒来都要干点啥的 agent 是 cron job；
   大多数时候翻翻日记就睡回去、偶尔忍不住看一眼——那才是活物。
5. **prompt 用叙事，不用规则清单。**（规则清单会诱发工具 few-shot 空转，
   血泪教训见狗蛋项目。）

## Quick start

```bash
npm install
cp soul.config.example.json soul.config.json   # 按你的设备改
# 起 body adapter (参考 StackChan 的):
python3 adapters/stackchan/adapter.py &
# 起灵魂:
npm start
```

模型走 pi-ai（30+ provider，含 Amazon Bedrock / Anthropic / OpenAI...）。
Bedrock 用 AWS 默认凭证链，无需 API key。

## 关键文件

| 文件 | 作用 |
|---|---|
| `src/index.ts` | 意识循环主体（wake→think→sleep 的永续循环） |
| `src/prompt.ts` | 灵魂的自我认知 prompt（叙事式人格设计） |
| `src/tools/body.ts` | 感官工具：look/speak/express/body_status/sleep |
| `src/tools/inner.ts` | 内心工具：update_mood / diary |
| `adapters/stackchan/` | 参考躯体适配器（桥接到 goudan 语音/视觉栈） |
| `deploy/*.service` | systemd 单元 |

## 成本

自主性是有电费的。默认节奏（醒一次 ≈ 1 次 LLM 往返 + 偶尔 look 的视觉调用，
min 10 分钟 / 默认 45 分钟 / max 8 小时，由灵魂自己在范围内定）下，
Sonnet 级模型一天约几十次唤醒、若干次看世界——量级在每天几美分到几十美分。
`loop.minSleepMinutes` 是你的成本安全阀。

## License

MIT
