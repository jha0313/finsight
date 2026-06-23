#!/usr/bin/env bash
# scripts/lh/run.sh
# 부록 F-1(미들웨어 우회)을 임시 적용한 채 Lighthouse 측정을 돌리고, 종료 시 원복한다.
# /dashboard 는 인증 게이팅(미들웨어)이 있어, 빌드 전에 isAuthenticated=true 로 패치해야
# 로그인 리다이렉트 없이 대시보드 화면을 측정할 수 있다. 이 패치는 커밋하지 않는다.
#
# 사용: bash scripts/lh/run.sh [measure.mjs 인자]
#   bash scripts/lh/run.sh                # 전체 매트릭스(build 포함)
#   LH_RUNS=1 bash scripts/lh/run.sh      # 빠른 스모크
#   bash scripts/lh/run.sh --no-build     # 기존 .next-lh 재사용(우회는 빌드에 baked)
set -euo pipefail
cd "$(dirname "$0")/../.."   # repo root

MW="src/middleware.ts"
BAK="$(mktemp)"
cp "$MW" "$BAK"
restore() { cp "$BAK" "$MW"; rm -f "$BAK"; }
trap restore EXIT INT TERM

# F-1: 인증 강제 (측정 전용 — 커밋 금지).
# Supabase 키가 있으면 미들웨어가 isSupabaseConfigured() 블록에서 실제 getUser()로
# 초기값을 덮어쓰므로, decision 직전에 무조건 true로 강제해야 /dashboard가 렌더된다.
perl -0pi -e 's/  const decision = resolveMiddlewareAuthDecision\(\{/  isAuthenticated = true; \/\/ LH-MEASURE-BYPASS (do not commit)\n  const decision = resolveMiddlewareAuthDecision({/' "$MW"
if ! grep -q "LH-MEASURE-BYPASS" "$MW"; then
  echo "[run.sh] WARN: F-1 패치 미적용(패턴 불일치) — /dashboard가 /login으로 리다이렉트될 수 있음" >&2
fi

node scripts/lh/measure.mjs "$@"
