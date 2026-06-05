# 디자인 시스템

finsight의 UI는 **Vantage 디자인 시스템**(editorial-institutional 핀테크 비주얼 랭귀지)을 채택한다. 모든 토큰·컴포넌트·브랜드 가이드의 **단일 출처(SSOT)는 스킬 폴더**다:

```
.claude/skills/vantage-design/
├── README.md            # 브랜드 철학·시각 규칙·Do/Don't (먼저 읽을 것)
├── colors_and_type.css  # 토큰 정본: 색상·타이포·spacing·radius·elevation + 시맨틱 타입 클래스
├── assets/              # 브랜드 마크 (mark.svg / wordmark.svg / wordmark-on-dark.svg)
├── ui_kits/marketing-site/  # 마케팅 사이트 컴포넌트 (React/JSX) — 랜딩 참고용
├── product/             # 제품 화면 컴포넌트 (Dashboard/Charts/Modal 등) — 대시보드 참고용
└── preview/             # 토큰·컴포넌트 specimen HTML (브라우저로 확인)
```

UI를 만드는 step은 **먼저 위 `README.md`와 `colors_and_type.css`를 읽고** 시각 규칙을 파악한 뒤 작업한다.

## 핵심 규칙 (Vantage가 Vantage로 보이게 하는 5가지)

1. **단일 accent.** `--primary` #0052ff는 **CTA·워드마크·링크에만**. 그 외 어떤 것도 파란색이 아니다. 두 번째 브랜드 색을 도입하지 마라.
   - **예외(AI 시그니처).** **AI 그라데이션(`--ai-gradient`)·글로우(`--ai-glow`)·`--ai-violet`(#7b5cff)**는 **AI 맥락(인사이트/Pro)·다크 밴드에서만** 허용한다(랜딩의 AI 인사이트 증명, Pro 잠금 티저 등). 이것은 단일 accent를 깨는 두 번째 브랜드 색이 아니라, "AI가 개입한 영역"을 표시하는 한정 시그니처다. **일반 CTA·링크는 여전히 `--primary` 단일**이며, AI 맥락 밖에서 그라데이션·글로우를 쓰지 않는다. **hex 인라인은 여전히 금지** — 항상 토큰/유틸 클래스로만 참조한다.
2. **Display는 weight 400** + 음수 트래킹(`-0.025em`). 헤드라인을 굵게 하지 마라. (가장 distinctive한 선택)
3. **Pill + 24px 카드 + 원형.** 인터랙티브 요소엔 100px pill, 카드는 24px radius, 에셋 글리프/아바타는 완전한 원. **0px 직각 모서리는 쓰지 않는다.**
4. **밴드 로테이션.** 페이지는 흰 에디토리얼 → 소프트그레이(#f7f7f7) → 풀블리드 다크(#0a0b0d) 히어로(레이어드 product-UI 카드 포함)를 번갈아 배치. 96px 섹션 리듬.
5. **모든 숫자는 mono**(JetBrains Mono, tabular). 트레이딩 그린/레드(`--semantic-up`/`--semantic-down`)는 **텍스트 색으로만**, 배경 fill로 쓰지 마라.

elevation은 **단일 그림자 티어**(`0 4px 12px rgba(0,0,0,.04)`, hover에만). 80%는 flat + 1px hairline(#dee1e6). 그림자를 쌓지 마라.

## finsight 특화 규칙 (Vantage 원본에서 오버라이드)

스킬은 영문 마케팅 사이트 기준으로 작성됐다. finsight에 적용할 때 아래를 **반드시** 따른다:

- **브랜드명 = finsight.** Vantage는 디자인 시스템의 코드네임/출처일 뿐, 제품명이 아니다. 화면에 "Vantage"를 노출하지 마라. 워드마크는 mark 글리프(블루 원 + 흰 쉐브론)는 그대로 재사용하되 텍스트는 `finsight`로 교체해 `public/`에 둔다. (스킬 폴더의 원본 SVG는 건드리지 않는다.)
- **카피는 한국어 우선.** 보이스의 *톤*(차분한 평서체 권위, "설명하되 과장하지 않음", 노이모지/노느낌표)은 차용하되, 카피 텍스트는 한국어로 쓴다. 스킬의 영문 sentence-case·"you/we" 규칙을 그대로 적용하지 마라. (i18n은 Post-MVP)
- **폰트 스택.** Inter는 한글 글리프가 없다. 따라서:
  - 본문/디스플레이(한글+라틴): **Pretendard** 우선, Inter fallback — `Pretendard, 'Inter', -apple-system, system-ui, sans-serif`
  - 숫자(금액·%·날짜): **JetBrains Mono** (tabular-nums) 유지 — 스킬의 `.num` 규칙 그대로.
  - Pretendard는 CDN(`https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css`) 또는 self-host. Display weight 400 규칙은 Pretendard에도 동일 적용.
- **라이트 캔버스 기본.** 다크는 랜딩 히어로/CTA 밴드의 의도적 device로만. 대시보드 기본 floor는 흰색(`--canvas`). (전체 다크모드 토글은 범위 밖)
- **대시보드 적용.** 차트는 토큰 색을 쓴다 — 기간 추이 라인 = `--primary`, 이상거래/지출 강조 = `--semantic-down`, 환불/절약 = `--semantic-up`, 카테고리 도넛은 ink/그레이 계열 + accent 1포인트. 차트 위 숫자는 전부 mono. 카드는 흰 fill + 1px hairline + 24px radius + 32px 패딩.

## 토큰 통합 (project-setup / UI step에서)

- `colors_and_type.css`의 CSS 변수를 `src/app/globals.css`로 가져온다(복사 또는 `@import`). 폰트 `@import`는 위 finsight 폰트 스택으로 교체한다.
- Tailwind는 **CSS-first(v4 `@theme`)** 로 토큰을 매핑해 `bg-[--surface-soft]` 대신 `bg-surface-soft`처럼 쓸 수 있게 한다. 단, **토큰 외 hex를 인라인하지 마라** — 색은 항상 토큰을 참조한다.
- 시맨틱 타입 클래스(`.display-mega`, `.title-md`, `.body-md`, `.num` 등)는 `colors_and_type.css` 정의를 따른다.

## AI 시그니처 토큰·유틸 (랜딩 AI 강조 / Pro 맥락 전용)

"통제된 과감함" — AI가 개입한 영역(인사이트/Pro)·다크 밴드에서만 쓰는 한정 시그니처다. 아래는 `src/app/globals.css`에 정의되어 있으며, 컴포넌트는 **이 이름만 참조**한다(hex 인라인 금지). 모든 모션은 `prefers-reduced-motion: reduce`에서 정지/즉시 최종상태로 가드된다.

**토큰(`:root`)**
- `--ai-violet` (#7b5cff) — AI 보조 색. `@theme inline`에서 `--color-ai-violet`로 매핑(`text-ai-violet` 등 유틸 사용 가능).
- `--ai-gradient` — `linear-gradient(120deg, var(--primary), var(--ai-violet))`.
- `--ai-glow` — 다크 위 보라/파랑 글로우 `box-shadow`.
- `--accent-yellow` (#f4b000, 기존) — '절약 강조' 1포인트로만.

**유틸 클래스(`globals.css`)**
- `.ai-text-gradient` — AI 그라데이션 텍스트(`background-clip:text`).
- `.ai-border-gradient` — 그라데이션 1px 보더(mask 방식, 24px radius 유지).
- `.ai-glow` — `box-shadow: var(--ai-glow)`.
- `.ai-surface-dark` — 다크 서피스 + 은은한 보라/파랑 글로우 백드롭(다크 섹션용).
- `.ai-shimmer` — 그라데이션이 천천히 흐르는 효과.
- `.motion-fade-rise` — inView 시 아래→위 fade(`data-inview="true"`로 트리거).
- `.motion-draw` — SVG path stroke-dashoffset 진입(라인 그려짐, `data-inview="true"`로 트리거).

**keyframes:** `fade-rise`, `glow-pulse`, `draw-line`, `ai-shimmer` (전부 reduced-motion 가드).

## 컴포넌트 규칙

- 컴포넌트는 **props만 받는 dumb 컴포넌트**(CLAUDE.md 규칙). 금액·% 포맷, 마스킹, 부호→색 매핑 등 계산·포맷 로직은 `lib/`로 분리하고, 컴포넌트는 토큰 클래스만 적용한다.
- 랜딩 컴포넌트는 `ui_kits/marketing-site/`, 대시보드/모달/차트는 `product/`의 패턴을 참고해 finsight UI로 재작성한다(그대로 복붙하지 말고 토큰·구조를 따른다).
- 아이콘은 **Lucide**(2px stroke, rounded) — 스킬 ICONOGRAPHY 규칙. 이모지 금지.

## 알려진 substitution (production 전 확인)

- 폰트: Pretendard/Inter/JetBrains Mono는 스펙상 라이선스 폰트의 오픈소스 대체. 실 브랜드 폰트가 정해지면 교체.
- 아이콘: Lucide가 미제공 브랜드 아이콘셋의 대체.
- 이 시스템은 written spec 기반 재현(Figma/소스 없음). 실제 에셋이 생기면 reconcile.
