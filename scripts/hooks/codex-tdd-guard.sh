#!/bin/bash
# Codex PreToolUse[Edit|Write|apply_patch] — TDD 가드.
# codex 편집은 apply_patch이고 입력이 .tool_input.command(패치 텍스트)라
# (.tool_input.file_path 가 아님) 거기서 대상 파일을 뽑아
# 기존 file_path 기반 tdd-guard.sh 에 위임해 동일한 분류 규칙을 재사용한다.
INPUT=$(cat)
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
GUARD="$ROOT/scripts/hooks/tdd-guard.sh"
[ -f "$GUARD" ] || exit 0

# 1) Edit/Write가 file_path를 직접 주면 사용한다.
FILES=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')

# 2) apply_patch면 패치 텍스트에서 Add/Update/Delete File 경로를 추출한다.
if [ -z "$FILES" ]; then
  CMD=$(printf '%s' "$INPUT" | jq -r '
    (.tool_input.command // "") as $c
    | if ($c | type) == "array" then ($c | join("\n")) else ($c | tostring) end')
  FILES=$(printf '%s\n' "$CMD" | sed -nE 's/^\*\*\* (Add|Update|Delete) File: (.+)$/\2/p')
fi

[ -z "$FILES" ] && exit 0

# 각 대상 파일을 기존 가드에 위임 — 하나라도 deny면 그 결과를 그대로 반환한다.
while IFS= read -r f; do
  [ -z "$f" ] && continue
  payload=$(jq -cn --arg p "$f" '{tool_input: {file_path: $p}}')
  out=$(printf '%s' "$payload" | bash "$GUARD")
  if printf '%s' "$out" | grep -q '"permissionDecision": *"deny"'; then
    printf '%s\n' "$out"
    exit 0
  fi
done <<< "$FILES"

exit 0
