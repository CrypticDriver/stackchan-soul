#!/bin/bash
# checkup.sh — daily health report for the soul running on dogegg (via SSM).
# Usage: bash tools/checkup.sh
# The soul moved from the local /tmp test rig to dogegg (us-west-2,
# i-0d66513435366291e, systemd unit stackchan-soul) on 2026-07-21; this
# script now probes that deployment. Requires AWS credentials with SSM access.

INSTANCE="i-0d66513435366291e"
REGION="us-west-2"
SOUL_DIR="/home/ubuntu/stackchan-soul-data"

echo "================ soul checkup (dogegg): $(date '+%Y-%m-%d %H:%M') ================"

CMD_ID=$(aws ssm send-command --region "$REGION" --instance-ids "$INSTANCE" \
  --document-name AWS-RunShellScript \
  --parameters "commands=[\"
echo '[A1] services:' \$(systemctl is-active stackchan-soul) '(soul)' \$(systemctl is-active stackchan-soul-adapter) '(adapter)';
echo '[A2] restarts-24h:' \$(journalctl -u stackchan-soul --since '24 hours ago' --no-pager | grep -c Started) ' errors-24h:' \$(journalctl -u stackchan-soul --since '24 hours ago' --no-pager | grep -aicE 'error|throttl|credential|ExpiredToken');
echo '[A3] sleep mix (12h):'; journalctl -u stackchan-soul --since '12 hours ago' --no-pager | grep -ao 'sleeping [0-9]* min' | sort | uniq -c | sed 's/^/      /';
D=$SOUL_DIR/DIARY.md;
echo '[B1] diary:' \$(grep -c '^- ' \$D) 'entries total,' \$(grep -c \\\"\$(TZ=Asia/Singapore date '+%Y/%-m/%-d')\\\" \$D) 'today (UTC+8)';
echo '[B2] last 2 entries:'; grep '^- ' \$D | tail -2 | cut -c1-110 | sed 's/^/      /';
echo '[B3] variety:' \$(grep '^- ' \$D | tail -10 | sed 's/^- [0-9/: ]*//' | cut -c1-20 | sort -u | wc -l) 'unique openings in last 10 (low=复读机)';
echo '[B4] mood:' \$(sed -n '/## 当前心情/{n;p}' $SOUL_DIR/MOOD.md | head -1);
echo '[C1] device:' \$(curl -s --max-time 5 127.0.0.1:9101/goudan/devices);
echo '[C2] nudges (24h):' \$(journalctl -u stackchan-soul --since '24 hours ago' --no-pager | grep -ac 被叫醒了);
echo '[D1] wakes-24h:' \$(journalctl -u stackchan-soul --since '24 hours ago' --no-pager | grep -ac sleeping) '(cost ≈ wakes × ~\$0.01; check Bedrock console for truth)'
\"]" --query Command.CommandId --output text) || { echo "SSM send failed ✗"; exit 1; }

sleep 6
aws ssm get-command-invocation --region "$REGION" --instance-id "$INSTANCE" \
  --command-id "$CMD_ID" --query "StandardOutputContent" --output text
echo "==========================================================================="
