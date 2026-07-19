#!/bin/bash
# checkup.sh — daily health report for a running soul.
# Usage: bash tools/checkup.sh [soulDir] [logFile]
# Reads the soul's log + inner-state files and prints the observation-period
# metrics: uptime, wake pattern, errors, diary variety, mood drift, cost est.

SOUL_DIR="${1:-/tmp/soul-test}"
LOG="${2:-/tmp/soul-longrun.log}"

echo "================ soul checkup: $(date '+%Y-%m-%d %H:%M') ================"

# --- A. survival ---
PID=$(pgrep -f "tsx src/index.ts" | head -1)
if [ -n "$PID" ]; then
  START=$(ps -o lstart= -p "$PID" 2>/dev/null)
  ELAPSED=$(ps -o etime= -p "$PID" 2>/dev/null | tr -d ' ')
  echo "[A1] process: ALIVE pid=$PID uptime=$ELAPSED (started $START)"
else
  echo "[A1] process: DEAD ✗"
fi

WAKES=$(grep -c "sleeping" "$LOG" 2>/dev/null)
ERRORS=$(grep -c "turn failed" "$LOG" 2>/dev/null)
NOKEY=$(grep -c "No API key" "$LOG" 2>/dev/null)
echo "[A2] wakes(total)=$WAKES  turn-errors=$ERRORS  cred-failures=$NOKEY"

echo "[A3] recent sleep choices:"
grep "sleeping" "$LOG" | tail -8 | sed 's/^/      /'

# --- B. mind ---
DIARY="$SOUL_DIR/DIARY.md"
if [ -f "$DIARY" ]; then
  TOTAL=$(grep -c "^- " "$DIARY")
  TODAY=$(grep -c "$(date '+%Y/%-m/%-d')" "$DIARY")
  echo "[B1] diary: $TOTAL entries total, $TODAY today"
  echo "[B2] last 3 entries:"
  grep "^- " "$DIARY" | tail -3 | cut -c1-110 | sed 's/^/      /'
  # repetition check: dedup similarity via first-20-chars of content
  UNIQ=$(grep "^- " "$DIARY" | tail -10 | sed 's/^- [0-9/: ]*//' | cut -c1-20 | sort -u | wc -l)
  LAST10=$(grep -c "^- " "$DIARY" | awk '{print ($1<10)?$1:10}')
  echo "[B3] variety: $UNIQ unique openings in last $LAST10 entries (low=复读机)"
fi
MOOD="$SOUL_DIR/MOOD.md"
[ -f "$MOOD" ] && echo "[B4] mood: $(sed -n '/## 当前心情/{n;p}' "$MOOD" | head -1)  (file mtime: $(stat -c '%y' "$MOOD" | cut -c1-16))"

# --- C. mechanisms ---
# pi stores sessions under ~/.pi/agent/sessions/<escaped-cwd>/
ESCAPED=$(echo "$SOUL_DIR" | sed 's|/|-|g')
SESS=$(ls -t "$HOME/.pi/agent/sessions/-$ESCAPED-"/*.jsonl 2>/dev/null | head -1)
if [ -n "$SESS" ]; then
  SZ=$(du -h "$SESS" | cut -f1)
  COMPACT=$(grep -c '"compaction"' "$SESS" 2>/dev/null)
  echo "[C1] session: $(basename "$SESS" | cut -c1-40)… size=$SZ compaction-events=$COMPACT"
else
  echo "[C1] session: NOT FOUND under ~/.pi/agent/sessions ✗"
fi
NUDGES=$(grep -c "被叫醒了" "$LOG" 2>/dev/null)
echo "[C2] nudges received: $NUDGES"

# --- D. cost (rough) ---
# each wake ≈ 1 LLM round trip; searches add a little. crude estimate by wakes.
if [ -n "$WAKES" ] && [ "$WAKES" -gt 0 ]; then
  EST=$(echo "$WAKES" | awk '{printf "%.2f", $1 * 0.01}')
  echo "[D1] cost est: ~\$$EST (${WAKES} wakes × ~\$0.01; check Bedrock console for truth)"
fi
echo "==========================================================================="
