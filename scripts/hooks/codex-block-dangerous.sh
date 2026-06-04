#!/bin/bash
# Codex PreToolUse[Bash] — 위험 명령 차단.
# 입력: stdin JSON. Bash 도구의 명령은 .tool_input.command (문자열 또는 argv 배열).
# 위험 패턴이면 permissionDecision=deny 를 stdout JSON으로 반환해 호출을 막는다.
INPUT=$(cat)

CMD=$(printf '%s' "$INPUT" | jq -r '
  (.tool_input.command // .tool_input.cmd // "") as $c
  | if ($c | type) == "array" then ($c | join(" ")) else ($c | tostring) end')

if printf '%s' "$CMD" | grep -qE 'rm[[:space:]]+-rf|git[[:space:]]+push[[:space:]]+--force|git[[:space:]]+reset[[:space:]]+--hard|DROP[[:space:]]+TABLE'; then
  jq -cn '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: "BLOCKED: 위험한 명령어가 감지되었습니다 (rm -rf / git push --force / git reset --hard / DROP TABLE)."
    }
  }'
fi

exit 0
