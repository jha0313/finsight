# Step 0: landing-sections

## 읽어야 할 파일

먼저 아래 파일들을 읽고 시각·카피 규칙을 파악하라:

- `/docs/PRD.md` — 랜딩 목표(첫 방문자가 가치·신뢰(보안)·가격을 보고 가입 결정), 사용자 여정(랜딩→구글 로그인)
- `/docs/DESIGN.md` — 밴드 로테이션(흰→소프트그레이→다크 히어로), 96px 섹션 리듬, 다크 히어로 device, 한국어 우선·차분한 평서체, 단일 accent
- `/.claude/skills/vantage-design/README.md` — 핵심 5규칙, `ui_kits/marketing-site/`(랜딩 참고 패턴)
- `/AGENTS.md` — 컴포넌트 dumb·토큰만·숫자 mono·'Vantage' 금지·노이모지/노느낌표
- `/src/app/globals.css` — 토큰·시맨틱 타입 클래스·`.display-*`
- `/src/components/*`(기존) — 컴포넌트 스타일 컨벤션 참고

## 작업

랜딩페이지 `src/app/page.tsx`를 마케팅 섹션들로 구성한다. dumb 컴포넌트 + 토큰만. 렌더 테스트(jsdom) 동반. (샘플 데모 섹션은 step 1에서 채우므로, 여기선 데모가 들어갈 자리만 명확히 비워두거나 자리표시한다.)

### 섹션 구성 (Vantage 밴드 로테이션)

1. **히어로**(풀블리드 다크 밴드 `--surface-dark` #0a0b0d) — 헤드라인(display weight 400, 음수 트래킹), 서브카피, CTA(`Google로 시작` → `/login`). 레이어드 product-UI 카드 device(대시보드 미리보기 느낌의 정적 카드).
2. **가치**(흰 캔버스) — finsight가 무엇을 해주는지(CSV 업로드→지출 구조·이상거래·절약 인사이트). FeatureGrid 형태.
3. **신뢰/보안**(소프트그레이 `--surface-soft`) — 보안 메시지: 카드·계좌번호 마스킹·전체 PAN 미보관, RLS 격리, Claude엔 마스킹 거래단위만. 핀테크 신뢰감.
4. **가격**(흰 캔버스) — Free vs Pro 비교(Free=규칙·통계+Sonnet 요약 / Pro=Opus 심층). CTA → `/login`.

### 컴포넌트 (dumb, `src/components/`)

`Hero`·`FeatureGrid`·`SecuritySection`·`PricingTable` 등 props만 받는 컴포넌트로 분리하고 `page.tsx`에서 조립. 각 컴포넌트 렌더 스모크 테스트(`*.test.tsx`)를 먼저 작성한다(비-page `.tsx`는 TDD 가드 대상).

### 핵심 규칙 (벗어나지 마라)

- **밴드 로테이션 + 96px 리듬**: 흰 → 소프트그레이 → 다크 히어로를 번갈아. 다크는 히어로/CTA 밴드의 의도적 device로만(전체 다크모드 아님).
- **단일 accent**: `--primary` #0052ff는 CTA·링크·워드마크에만. 두 번째 브랜드색·`--accent-yellow` 금지.
- **display weight 400** + 음수 트래킹. 헤드라인 굵게 금지.
- **색은 토큰만**(hex 인라인 금지), 카드 24px radius + hairline, 숫자 mono, **한글 Pretendard**.
- **카피 한국어·차분한 평서체**(과장·이모지·느낌표 없음). 화면에 **'Vantage' 노출 금지**(제품명 finsight).
- **레이어**: 컴포넌트는 `src/types`·`src/lib`·`react`·`lucide-react`만. `src/services` import 금지.
- CTA·링크는 `/login`으로(로그인은 phase 2에서 구현됨).

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # 렌더 테스트 green

grep -rIn '#[0-9a-fA-F]\{3,6\}' src/components src/app --include='*.tsx' | grep -v globals.css && echo "FAIL: 인라인 hex" || echo "OK"
! grep -rIn 'Vantage' src/app src/components
```

## 검증 절차

1. 위 AC를 실행한다.
2. 체크리스트:
   - 렌더 테스트 선행(TDD)? 섹션이 밴드 로테이션(흰/소프트그레이/다크)을 따르는가?
   - 단일 accent·토큰만·숫자 mono·display 400·'Vantage' 없음인가?
   - CTA가 `/login`으로 연결되는가? 컴포넌트가 `src/services`를 import하지 않는가?
3. 결과에 따라 `phases/4-landing/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 섹션·컴포넌트 한 줄 요약(+ 데모 슬롯 위치)
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- hex 인라인·두 번째 accent색·'Vantage' 노출 금지. 이유: 디자인 CRITICAL(토큰만·단일 accent).
- 헤드라인을 굵게 하지 마라. 이유: display weight 400이 Vantage의 distinctive 규칙.
- 전체 다크모드 토글을 만들지 마라. 이유: 다크는 히어로/CTA 밴드 device로만.
- 샘플 데모(분석 실행)를 만들지 마라. 이유: step 1 범위(여기선 자리만).
- 컴포넌트에서 `src/services`나 외부 데이터 SDK를 import하지 마라. 이유: dumb 컴포넌트.
- 이모지·느낌표·과장 카피를 쓰지 마라. 이유: 차분한 평서체 보이스.
- 기존 테스트를 깨뜨리지 마라.
