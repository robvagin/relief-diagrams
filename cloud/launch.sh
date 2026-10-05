#!/bin/bash
# Запуск облачной сессии Claude Code на кусок наряда: bash cloud/launch.sh <кусок>
# Куски: playground gate-glyph desk-ledger cascade-stack horizon-agents
# Окно доверия подтверждает владелец сам (Enter). Сессия появится в claude.ai/code, PR в github.com/robvagin/relief-diagrams/pulls
cd "$(dirname "$0")/.." || exit 1
f="cloud/prompts/$1.txt"; [ -f "$f" ] || { echo "нет куска: $1 (есть: $(ls cloud/prompts | sed 's/\.txt//' | tr '\n' ' '))"; exit 1; }
exec claude --cloud "$(cat "$f")"
