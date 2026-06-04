# Step 3: design-tokens

## 읽어야 할 파일

먼저 아래 파일들을 읽고 시각 규칙을 파악하라:

- `/docs/DESIGN.md` — finsight 특화 오버라이드(브랜드명·한국어·폰트 스택·라이트 캔버스·토큰 통합 지침)
- `/.claude/skills/vantage-design/README.md` — 브랜드 철학·핵심 5규칙·Do/Don't
- `/.claude/skills/vantage-design/colors_and_type.css` — **토큰 정본**(색·타이포·spacing·radius·elevation + 시맨틱 타입 클래스)
- `/.claude/skills/vantage-design/assets/` — `mark.svg`/`wordmark.svg`(워드마크 재작성 참고)
- `/AGENTS.md` — UI 토큰 CRITICAL 규칙(단일 accent·display 400·숫자 mono·hex 인라인 금지·'Vantage' 노출 금지)
- step 0 산출물: `src/app/globals.css`(Tailwind v4 베이스라인), `package.json`/postcss 설정

## 작업

Vantage 디자인 토큰을 finsight 폰트 스택으로 오버라이드해 프로젝트에 통합한다. UI 컴포넌트는 만들지 않고 **토큰 인프라만** 깐다.

1. **토큰 통합** — `colors_and_type.css`의 CSS 변수(`:root`의 색·타입 스케일·spacing·radius·elevation)를 `src/app/globals.css`로 가져온다(복사 또는 `@import`). 토큰 값(예: `--primary: #0052ff`)은 정본을 따른다.

2. **폰트 스택 오버라이드** (DESIGN.md 기준):
   - 본문/디스플레이(한글+라틴): `Pretendard, 'Inter', -apple-system, system-ui, sans-serif`
   - 숫자(금액·%·날짜): **JetBrains Mono**(tabular-nums) — `.num` 규칙 유지
   - Pretendard는 CDN `@import`(`https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css`) 또는 self-host. JetBrains Mono·Inter도 로드(CDN 또는 next/font, 재량).
   - **display weight 400** 규칙은 Pretendard에도 동일 적용.

3. **Tailwind v4 `@theme` 매핑** — 토큰 CSS 변수를 `@theme`로 매핑해 `bg-surface-soft`·`text-primary`처럼 유틸리티로 쓸 수 있게 한다. **단, 토큰 외 hex를 인라인하지 마라** — 색은 항상 토큰 참조.

4. **시맨틱 타입 클래스** — `colors_and_type.css`의 `.display-mega`·`.title-md`·`.body-md`·`.num` 등 정의를 globals.css에 포함(폰트 스택만 finsight로 교체).

5. **finsight 워드마크** — `public/`에 finsight 워드마크 SVG를 둔다. mark 글리프(블루 원 + 흰 쉐브론)는 재사용하되 텍스트는 **`finsight`**로 교체한다. 스킬 폴더의 원본 SVG는 **수정하지 말고**, `public/`에 새 파일로 만든다(예: `public/finsight-wordmark.svg`, `public/finsight-mark.svg`).

(선택) `src/app/page.tsx`를 토큰이 실제 적용되는지 확인할 최소 형태로 둘 수 있으나, 랜딩/대시보드 UI는 만들지 마라(후속 페이즈).

### 핵심 규칙 (벗어나지 마라 — Vantage가 Vantage로 보이게 하는 규칙)

- **단일 accent** `--primary` #0052ff는 CTA·링크·워드마크에만. 두 번째 브랜드 색을 도입하지 마라.
- **색은 토큰만** — globals.css의 `:root`/`@theme` 정의 외에 hex를 인라인하지 마라.
- **모든 숫자는 mono**(JetBrains Mono, tabular). 트레이딩 그린/레드(`--semantic-up`/`--semantic-down`)는 **텍스트 색으로만**, 배경 fill 금지.
- **display weight 400** + 음수 트래킹. 헤드라인을 굵게 하지 마라.
- **라이트 캔버스 기본**(`--canvas` 흰색). 다크는 후속 랜딩 히어로 device로만.
- 화면/에셋에 **'Vantage' 텍스트를 노출하지 마라**. 제품명 = finsight.

## Acceptance Criteria

```bash
npm run lint && npm run build && npm test   # 토큰/CSS 통합 — 기존 green 유지

grep -qi -- '--primary' src/app/globals.css            # 토큰 통합됨
grep -qi 'Pretendard' src/app/globals.css              # 한글 폰트 스택
grep -qi 'JetBrains Mono' src/app/globals.css          # 숫자 mono
test -f public/finsight-wordmark.svg || ls public/*finsight*.svg   # finsight 워드마크 존재
! grep -ri 'Vantage' src/ public/                      # 화면 노출 텍스트에 Vantage 없음
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처/디자인 체크리스트:
   - `--primary` 등 토큰이 globals.css에 통합됐는가?
   - 폰트 스택이 Pretendard+JetBrains Mono(+Inter)인가? display weight 400 유지?
   - hex가 토큰 정의 밖에서 인라인되지 않았는가?
   - `public/`에 finsight 워드마크가 있고, 스킬 원본 SVG는 그대로인가?
   - 화면 텍스트/에셋에 'Vantage' 노출이 없는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 통합한 토큰·폰트·워드마크 한 줄 요약
   - 수정 3회 후 실패 → `"status": "error"`, `"error_message"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 중단

## 금지사항

- 토큰 외 hex 색을 인라인하지 마라. 이유: CRITICAL — 색은 토큰만 참조.
- 두 번째 accent 색을 도입하지 마라. 이유: 단일 accent가 Vantage 시스템의 핵심 규칙.
- 랜딩/대시보드 UI 컴포넌트를 만들지 마라. 이유: 이 step은 토큰 인프라만(UI는 후속 페이즈).
- `.claude/skills/vantage-design/` 안의 원본 파일을 수정하지 마라. 이유: 스킬은 SSOT이며 비파괴 재사용한다.
- 화면/에셋에 'Vantage'를 노출하지 마라. 이유: 제품명은 finsight, Vantage는 디자인 시스템 코드네임일 뿐.
- 기존 테스트를 깨뜨리지 마라.
