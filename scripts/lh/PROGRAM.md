# PROGRAM.md — Lighthouse Auto-Research 제어 문서

> autoresearch의 `program.md` 대응. 루프는 이 문서를 읽고, 사람은 코드를 직접 만지지 않고
> **이 문서만 편집해** 탐색 방향을 제어한다. (참고: docs/lighthouse-autoresearch-design.html)

## 목적함수 (단일 지표)
```
objective = Σ(w_C · score(P,D,C)) / N_cells      # cell = page P × device D × category C
KEEP   ⇐ objective 상승 AND ∀cell: score ≥ baseline − ε   (ε = 1pt)
REVERT ⇐ 그 외
```
- 측정: `bash scripts/lh/run.sh` → `scripts/lh/scores.json` (페이지 2 × 기기 2 × 카테고리 4, median-of-3)
- 판정: `node scripts/lh/objective.mjs scripts/lh/baseline.json scripts/lh/scores.json`
- 가중치: 전 카테고리 동일(1.0). 기기: mobile·desktop 동일.

## 대상 / 측정 환경
- 페이지: `/`(landing, 공개) · `/dashboard`(인증 — 측정 시 부록 F-1 미들웨어 우회, run.sh가 자동 적용/원복)
- 카테고리: Performance · Accessibility · Best Practices · SEO
- 기기: mobile(기본 프리셋) · desktop(lighthouse desktop-config)
- 빌드: 격리 distDir `.next-lh`, 포트 4187. dev(.next-dev)·일반 build(.next)와 레이스 없음.

## 목표 임계치 (균형 — 중단 기준 고점)
| 카테고리 | mobile | desktop |
|---|---|---|
| Performance | ≥ 90 | ≥ 95 |
| Accessibility | ≥ 95 | ≥ 95 |
| Best Practices | ≥ 95 | ≥ 95 |
| SEO | ≥ 95 | ≥ 95 |

중단: 모든 cell이 목표 도달 **또는** 2회 연속 무개선(dry).

## 제약 (안전 레일 — 위반 시 그 변경 폐기)
- **외과적 수정만.** 변경된 모든 줄은 점수 개선과 직접 연결.
- **Vantage 디자인 시스템 준수**(제품 코드). 색은 토큰만, hex 인라인 금지, 폰트/단일 accent 규칙 유지.
  - (주의: 사용자 지시로 *리포트 HTML 2개*만 Vantage 비적용. 제품 코드는 계속 준수.)
- **매 반복 green**: `npm run lint && npm run build && npm run test`.
- **회귀 자동 revert**: 어떤 cell이든 baseline−ε 미만이면 폐기.
- **불변 영역**: 인증/미들웨어·RLS·Pro 게이팅·결제/웹훅 로직. `src/middleware.ts`는 손대지 않는다(측정 우회와 충돌).
- **측정 픽스처 커밋 금지**: F-1 우회, scores.json/reports 산출물.

## 백로그 (ROI 순 — Phase 1 진단으로 갱신)
> 코드에서 즉시 보이는 후보(베이스라인/진단 전 잠정). Phase 1에서 LH 감사 기반으로 재정렬한다.
1. `src/app/layout.tsx` metadata 보강 — `description`·`viewport`·OpenGraph·`metadataBase`·favicon 부재 → **SEO / Best Practices**.
2. 폰트 로딩 전략 — Pretendard/Inter/JetBrains Mono 로딩 방식 점검(`next/font`·`display:swap`·preload·subset) → **LCP / CLS**.
3. PostHog 스크립트 로딩 전략(`afterInteractive`/지연) → **TBT / Best Practices**.
4. 이미지/아이콘 — 명시적 width·height, `next/image`, lazy → **CLS / Perf**.
5. 접근성 — 색 대비, 폼 라벨, 랜드마크, 버튼 접근명 → **Accessibility**.

## 측정 환경 주의
- 이 머신은 OBS·시스템 프로세스로 load가 높을 때가 잦다(측정 중 6~10). LH 모바일 Perf는 CPU 부하에 민감해
  단발 outlier(예: LCP 19s, P=55)가 나온다 → **Perf 회귀는 반드시 재측정으로 노이즈/실제를 구분**하라.
- SEO·A11y·BP는 타이밍 무관(결정론적)이라 부하와 무관하게 신뢰 가능.

## 반복 로그
| # | 변경 | 결과(결정론적 셀) | verdict |
|---|---|---|---|
| 0 | baseline | objective 94.63 · SEO 90/A11y 96/BP 96 (전 페이지) | — |
| 1 | layout description+OG · icon.svg(favicon) · .caption 대비 상향(--muted→--body) | landing SEO 90→**100**·BP 96→**100**, dashboard A11y 96→**100**·BP 96→**100** | **KEEP** (자동 verdict는 landing/mobile perf 노이즈로 REVERT였으나, 재측정 median=92=baseline로 노이즈 확정) |
| 2 | dashboard 페이지 명시 description | dashboard SEO 90 변화없음 | **NO-OP** — Next.js 동적 페이지 메타 quirk: 서버 HTML엔 description 존재하나 클라이언트 하이드레이션 후 DOM에서 제거됨(LH MetaElements로 확인). 인증 게이트 페이지(비색인) → 실효 영향 없음. 콘텐츠 수정으로 해결 불가 |

## 알려진 한계 / 후속
- dashboard SEO=90: 동적 렌더링 + 클라이언트 메타 처리에서 description이 DOM에서 사라짐. 비색인 인증 페이지라 우선순위 낮음.
  해결하려면 Next 메타데이터 정적화/`generateMetadata` 실험 또는 프레임워크 이슈 추적 필요(후속).
