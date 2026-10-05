#!/bin/bash
# Приказ всем облачным сессиям из cloud/sessions.txt: bash cloud/tell.sh cloud/orders/<приказ>.txt
cd "$(dirname "$0")/.." || exit 1
msg="$(cat "$1")" || exit 1
while read -r k id; do
  [ -z "$id" ] && continue
  echo "== $k ($id)"
  claude -p "$msg" --cloud "$id" < /dev/null | tail -3
done < cloud/sessions.txt
echo "готово: приказ ушёл всем"
