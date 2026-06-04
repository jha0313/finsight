# Step 3: upgrade-ui

## 읽어야 할 파일

먼저 아래 파일들을 읽고 시각·설계 규칙을 파악하라:

- `/docs/PRD.md` — 사용자 여정(Free 분석 → Pro 잠금 미리보기 → Polar 결제 → Pro 잠금해제)
- `/docs/DESIGN.md` — 단일 accent(`--primary`)는 CTA·링크에만, 카드·토큰·숫자 mono, 'Vantage' 금지, 한국어 차분한 평서체
- `/AGENTS.md` — 컴포넌트 dumb·토큰만·구독상태 클라이언트 토글 금지
- `/src/components/InsightsPanel.tsx`(phase 2) — `pro.status`(active/locked/unavailable) 표현(여기에 업그레이드 CTA를 얹는다)
- `/src/app/api/checkout/route.ts`(step 1) — 체크아웃 진입점

## 작업

Pro 잠금 미리보기에 **업그레이드 CTA**를 결선한다. step 1 체크아웃 라우트로 진입시킨다. dumb 컴포넌트 + 토큰만.

### 책임

- `pro.status === 'locked'`(무료, Sonnet 미리보기)일 때 **업그레이드 CTA**를 노출 — 클릭 시 step 1 체크아웃으로 이동(`POST /api/checkout` 또는 링크). `--primary` accent 사용.
- `pro.status === 'active'`면 CTA 숨김(이미 구독), `unavailable`이면 일시 불가 안내.
- 카피는 한국어·차분한 평서체(과장·이모지·느낌표 없음). 결제 안전 메시지(Polar=Merchant of Record)는 간결히.
- `InsightsPanel`(또는 별도 `UpgradeCta` dumb 컴포넌트)에 통합. 렌더 테스트(jsdom) 동반.

### 핵심 규칙 (벗어나지 마라)

- **구독상태 클라 토글 금지**: CTA는 `pro.status`(서버 응답)에 따라 표시만 한다. 클라이언트에서 tier/구독을 바꾸지 마라. 이유: CRITICAL — 서버 DB가 진실원천.
- **단일 accent**: 업그레이드 CTA에만 `--primary`. 두 번째 브랜드색·`--accent-yellow` 도입 금지.
- **dumb 컴포넌트**: props만. 포맷/계산은 lib. 토큰만(hex 인라인 금지), 숫자 mono, 한글 Pretendard, 'Vantage' 노출 금지.
- **레이어**: 컴포넌트는 `src/types`·`src/lib`·`react`·`lucide-react`만. `src/services` import 금지.

### 테스트 (네트워크 0)

- `pro.status='locked'` → 업그레이드 CTA 렌더, `active` → CTA 없음, `unavailable` → 불가 안내(jsdom 렌더 테스트).
- CTA가 체크아웃 진입점으로 연결되는지(목/링크 단언).

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # 키 없이 green

grep -rIn '#[0-9a-fA-F]\{3,6\}' src/components | grep -v globals.css && echo "FAIL: 인라인 hex" || echo "OK"
! grep -rIn 'Vantage' src/app src/components
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 렌더 테스트 선행(TDD)? `pro.status`별 CTA 표시가 검증됐는가?
   - 구독상태를 클라이언트에서 토글하지 않는가? CTA가 step 1 체크아웃으로 연결되는가?
   - 단일 accent·토큰만·숫자 mono·'Vantage' 없음인가?
   - 컴포넌트가 `src/services`를 import하지 않는가(ESLint green)?
3. 결과에 따라 `phases/3-billing/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 업그레이드 CTA·결선 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- 구독상태/tier를 클라이언트에서 판정·토글하지 마라. 이유: CRITICAL — 서버 DB 진실원천.
- 두 번째 accent색·hex 인라인·'Vantage' 노출 금지. 이유: 디자인 CRITICAL(단일 accent·토큰만).
- 게이팅 로직·웹훅·체크아웃 라우트를 다시 구현하지 마라. 이유: phase 2/이 페이즈 step 1·2 단일 출처.
- 랜딩/샘플 데모를 만들지 마라. 이유: 범위 밖(필요 시 후속 페이즈).
- 기존 테스트를 깨뜨리지 마라.
