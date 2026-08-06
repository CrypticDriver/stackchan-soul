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
echo '[B0] vitals (/health — wakes, budget/hunger, boredom, rut detector, mood):';
echo '     ' \$(curl -s --max-time 5 127.0.0.1:9297/health || echo 'health endpoint unreachable ✗');
D=$SOUL_DIR/DIARY.md;
echo '[B2] last 2 entries:'; grep '^- ' \$D | tail -2 | cut -c1-110 | sed 's/^/      /';
echo '[C1] device:' \$(curl -s --max-time 5 127.0.0.1:9101/goudan/devices);
echo '[C2] nudges (24h):' \$(journalctl -u stackchan-soul --since '24 hours ago' --no-pager | grep -ac 被叫醒了)
\"]" --query Command.CommandId --output text) || { echo "SSM send failed ✗"; exit 1; }

sleep 6
aws ssm get-command-invocation --region "$REGION" --instance-id "$INSTANCE" \
  --command-id "$CMD_ID" --query "StandardOutputContent" --output text
echo "==========================================================================="
