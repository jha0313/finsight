#!/usr/bin/env bash
# dev-doctor — finsight dev 서버 헬스체크 + (옵션) 격리 재시작
#
# dev 서버가 LISTEN 중이어도, 외부 'next build'가 .next를 덮으면 정적 자원이
# 404가 되어 페이지가 unstyled로 깨진다(docs/BROWSER_TESTING.md 부록 T 참고).
# 이 스크립트는 "정상 서빙"을 CSS 200까지 확인하고, 깨졌으면 .next-dev로 격리 재시작한다.
#
# 사용:
#   scripts/dev-doctor.sh            # 헬스체크만 (정상=exit 0, 비정상=exit 1)
#   scripts/dev-doctor.sh --restart  # 비정상이면 .next-dev로 격리 재시작
#
# 환경변수: PORT(기본 3000)

set -uo pipefail
PORT="${PORT:-3000}"
BASE="http://localhost:${PORT}"
RESTART=0
[ "${1:-}" = "--restart" ] && RESTART=1

say() { printf '%s\n' "$*" >&2; }

# / HTML에서 첫 stylesheet 링크를 뽑아 그 자원의 HTTP 코드를 출력한다.
css_status() {
  local html css
  html="$(curl -fsS --max-time 5 "$BASE/" 2>/dev/null || true)"
  [ -z "$html" ] && { echo "NO_SERVER"; return; }
  css="$(printf '%s' "$html" | grep -oE '/_next/static/css/[^"?]*' | head -1)"
  [ -z "$css" ] && { echo "NO_CSS"; return; }
  curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 "$BASE$css" 2>/dev/null || echo 000
}

# 외부 build 레이스 조기 경고
if pgrep -f "next build" >/dev/null 2>&1; then
  say "⚠ 외부 'next build' 실행 중 — 메인 .next를 덮을 수 있음 (dev는 .next-dev 격리 권장)"
fi

st="$(css_status)"
case "$st" in
  200)       say "✓ dev 정상 (CSS 200): $BASE"; exit 0 ;;
  NO_SERVER) say "✗ dev 서버 응답 없음: $BASE" ;;
  NO_CSS)    say "? CSS 링크 없음 — 컴파일 중이거나 비표준 상태: $BASE" ;;
  *)         say "✗ 정적 자원 $st — .next 레이스로 깨진 상태: $BASE" ;;
esac

if [ "$RESTART" != "1" ]; then
  say "복구하려면: scripts/dev-doctor.sh --restart"
  exit 1
fi

say "→ .next-dev 격리로 dev 재시작"
pkill -f "next dev" 2>/dev/null || true
p="$(lsof -ti :"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
[ -n "$p" ] && kill "$p" 2>/dev/null || true
sleep 1
rm -rf .next-dev
NEXT_DIST_DIR=.next-dev nohup npm run dev >/tmp/finsight-dev.log 2>&1 &
say "  로그: /tmp/finsight-dev.log — 준비까지 폴링(최대 90s)"
for i in $(seq 1 90); do
  if [ "$(css_status)" = "200" ]; then
    say "✓ 준비 완료 (${i}s): $BASE"
    say "  참고: Next가 tsconfig.json에 .next-dev/types를 추가할 수 있음 — 충돌 해소 후 'git checkout tsconfig.json'"
    exit 0
  fi
  sleep 1
done
say "✗ 90s 내 준비 실패 — tail /tmp/finsight-dev.log"
exit 1
