#!/bin/bash
# Codex Stop — lint/build/test 게이트.
# 통과하면 정상 stop, 실패하면 decision:block 으로 codex를 이어 자가교정시킨다
# (codex의 Stop block은 턴을 거부하지 않고 reason을 새 프롬프트로 이어붙임).
# 입력: stdin JSON. .stop_hook_active 로 무한 루프를 막는다.
INPUT=$(cat)
ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
ALLOW='{"continue": true}'

# 이미 Stop 훅으로 한 번 이어졌으면 더 반복하지 않는다(한 번만 자가교정).
ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')
[ "$ACTIVE" = "true" ] && { printf '%s\n' "$ALLOW"; exit 0; }

# 아직 npm 프로젝트가 없으면(스캐폴딩 전) 게이트를 건너뛴다.
if [ ! -f "$ROOT/package.json" ]; then
  printf '%s\n' "$ALLOW"
  exit 0
fi

cd "$ROOT" || { printf '%s\n' "$ALLOW"; exit 0; }

if OUT=$(npm run lint 2>&1 && npm run build 2>&1 && npm run test 2>&1); then
  printf '%s\n' "$ALLOW"
else
  jq -cn --arg r "lint/build/test가 실패했습니다. green이 될 때까지 고치세요.

$(printf '%s' "$OUT" | tail -n 40)" '{decision: "block", reason: $r}'
fi

exit 0
