# 프로비저닝 가이드 (SETUP.md)

코드는 mock-first라 키 없이도 `npm run dev`·`build`·`test`가 동작한다. 이 문서는 **실제로 로그인·분석·결제가 돌게** 외부 서비스를 연결하는 절차다.

- 콘솔에서 직접 해야 하는 **수동 단계**는 `[수동]`으로 표시했다.
- 모든 비밀키는 `.env`에만 두고 커밋하지 않는다(`.gitignore`에 이미 포함).
- 미설정 상태에서도 공개 페이지(랜딩 `/`, 로그인 `/login`)는 렌더되고 보호 경로(`/dashboard`)는 `/login`으로 리다이렉트된다.

## 0. 사전 준비

```bash
node -v            # 20+ 권장
npm install
npm i -g supabase  # Supabase CLI (또는 npx supabase 사용)
```

계정: [Supabase](https://supabase.com), [Google Cloud](https://console.cloud.google.com), [Polar](https://polar.sh), [Anthropic](https://console.anthropic.com).

## 1. `.env` 키 개요

| 키 | 출처 | 비밀 |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | 앱 URL (로컬: `http://localhost:3000`) | 아니오 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL | 아니오 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable(anon) 키 | 아니오 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role 키 (**웹훅 전용**) | **예** |
| `ANTHROPIC_API_KEY` | Anthropic API 키 | **예** |
| `POLAR_SERVER` | `sandbox` 또는 `production` | 아니오 |
| `POLAR_ACCESS_TOKEN` | Polar 액세스 토큰 | **예** |
| `POLAR_WEBHOOK_SECRET` | Polar 웹훅 서명 시크릿 | **예** |
| `POLAR_PRODUCT_ID` | Polar Pro 제품 ID | 아니오 |

`NEXT_PUBLIC_` 접두사는 클라이언트로 노출된다 — **비밀키에 절대 붙이지 마라**.

## 2. Supabase (DB + 인증)

### 2-1. `[수동]` 프로젝트 생성 + 키 복사

1. Supabase 콘솔 → **New project** 생성.
2. **Project Settings → API**에서:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `publishable`(또는 `anon`) 키 → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY` (비공개 보관)

### 2-2. 마이그레이션 적용 (스키마 + RLS + RPC)

마이그레이션 SQL은 `supabase/migrations/0001_init.sql`에 **작성만** 돼 있다. 적용:

```bash
supabase login                                   # [수동] 브라우저 인증
supabase link --project-ref <YOUR_PROJECT_REF>   # 콘솔 URL의 ref
supabase db push                                 # 0001_init.sql 적용
```

> 적용 후 6개 테이블(statements·transactions·analyses·subscriptions·processed_webhook_events·ai_usage_daily) + 전 테이블 RLS(`auth.uid()=user_id`) + `save_statement_analysis` RPC가 생성된다.

대안(CLI 없이): 콘솔 **SQL Editor**에 `0001_init.sql` 내용을 붙여넣어 실행.

## 3. 구글 OAuth

### 3-1. `[수동]` Google Cloud OAuth 클라이언트

1. Google Cloud 콘솔 → **APIs & Services → Credentials → Create credentials → OAuth client ID** → *Web application*.
2. **Authorized redirect URIs**에 Supabase 콜백을 추가:
   ```
   https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback
   ```
3. 생성된 **Client ID / Client secret**을 복사.

### 3-2. `[수동]` Supabase에 구글 provider 등록

1. Supabase 콘솔 → **Authentication → Providers → Google** 활성화.
2. 위 Client ID / secret 입력.
3. **Authentication → URL Configuration**에서 `Site URL`과 `Redirect URLs`에 앱 콜백을 추가:
   ```
   http://localhost:3000/auth/callback     # 로컬
   https://<your-domain>/auth/callback      # 배포
   ```

> 앱의 OAuth 콜백 라우트는 `src/app/auth/callback/route.ts`다. 로그인 버튼 → 구글 → 이 콜백에서 코드 교환 → `/dashboard`.

## 4. Polar (결제)

### 4-1. `[수동]` 제품 + 토큰

1. Polar 대시보드(샌드박스 먼저 권장: `POLAR_SERVER=sandbox`) → **Products**에서 Pro 제품 생성 → 제품 ID → `POLAR_PRODUCT_ID`.
2. **Settings → API/Access Tokens**에서 액세스 토큰 발급 → `POLAR_ACCESS_TOKEN`.

### 4-2. `[수동]` 웹훅 등록

1. Polar **Settings → Webhooks → Add endpoint**:
   ```
   https://<your-domain>/api/webhook/polar
   ```
   (로컬 테스트는 `ngrok` 등으로 터널링한 공개 URL 사용)
2. 구독 관련 이벤트 구독(`subscription.created/updated/...`).
3. 서명 **secret** → `POLAR_WEBHOOK_SECRET`.

> 웹훅 라우트 `src/app/api/webhook/polar/route.ts`는 raw body 서명검증 + `event_id` 선삽입 멱등 + `subscriptions` upsert(service_role)를 한다. 체크아웃의 `customerExternalId`는 서버 세션 uid로 강제되므로, 웹훅이 그 uid로 구독을 매핑한다.

## 5. 로컬 실행 + 검증

`.env`를 모두 채운 뒤:

```bash
npm run dev
```

수동 체크:
1. `http://localhost:3000/` — 랜딩 + 샘플 데모(키 없이도 렌더됨).
2. `/login` → **Google로 계속하기** → 구글 로그인 → `/dashboard` 진입.
3. 대시보드에서 CSV 업로드 → 분석 결과(차트·인사이트) 확인.
4. Pro 업그레이드 CTA → Polar 체크아웃 → 결제(샌드박스) → 웹훅 수신 → `subscriptions` 갱신 → 재요청 시 Pro(Opus) 잠금 해제.

게이팅은 **서버 DB 구독상태로만**(`status active AND current_period_end > now()`) 판정된다. 미구독/실패 시에도 `/api/analyze`는 **200 + Free 결과 + `pro.status`**를 반환한다(402 아님).

## 6. 배포 (Vercel)

1. Vercel 프로젝트에 위 `.env` 값을 **Environment Variables**로 등록(`NEXT_PUBLIC_*`는 공개, 나머지는 비공개).
2. `NEXT_PUBLIC_APP_URL`·OAuth redirect·Polar webhook URL을 배포 도메인으로 갱신.
3. `/api/analyze`는 `export const maxDuration = 60`으로 opus latency에 대비돼 있다(필요 시 Vercel 플랜 상향).
4. Supabase 마이그레이션은 배포 전 `supabase db push`로 적용돼 있어야 한다.

## 7. 트러블슈팅

- **`... is required to create a Supabase client` 런타임 에러**: `.env`의 `NEXT_PUBLIC_SUPABASE_URL`/`PUBLISHABLE_KEY`가 비었을 때 *호출 경로*에서 발생. 공개 페이지는 미설정이어도 렌더되지만, 인증·분석을 쓰려면 키가 필요하다.
- **로그인 후 리다이렉트 실패**: Google redirect URI(`.../auth/v1/callback`)와 Supabase Redirect URLs(`.../auth/callback`)가 정확한지 확인.
- **웹훅이 구독을 갱신 안 함**: 서명 secret 일치 여부, 엔드포인트 URL 공개 접근 여부, `customerExternalId`(=로그인 uid) 매핑 확인.
- **AI 인사이트가 `unavailable`**: `ANTHROPIC_API_KEY` 누락/한도, 또는 일일 quota(`ai_usage_daily`) 소진. 규칙·통계(Free) 결과는 항상 보존된다.
