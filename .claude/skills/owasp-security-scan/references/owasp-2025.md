# OWASP Top 10 2025 — 점검 루브릭 (범용 + finsight 휴리스틱)

각 카테고리마다 **무엇인가 / 일반 점검 포인트 / finsight 휴리스틱 / severity 가이드**를 담는다.
출처: https://owasp.org/Top10/2025/ · finsight 휴리스틱은 `CLAUDE.md`의 CRITICAL 규칙에서 유도.

> 카테고리 에이전트는 **자기 담당 카테고리 섹션 + 해당 leads + 가드레일 문서**만 받아 점검한다.
> leads는 grep이 찾은 *단서*일 뿐 판정이 아니다 — 코드를 직접 읽고 실제 의미로 확인/기각하라.

severity 척도(보안 표준): **critical · high · medium · low · info**
- critical: 인증 우회·미인증 데이터 노출·RCE·평문 비밀 유출 등 즉시 악용 가능
- high: 권한 상승·민감정보 노출·서명 미검증 등 악용 경로 명확
- medium: 조건부 악용·심층방어 결여·설정 미흡
- low: 모범사례 위반·정보성
- info: 관찰/관측, 위험 낮음

---

## A01:2025 — Broken Access Control
**무엇:** 권한이 제대로 강제되지 않아 인가되지 않은 리소스/행위에 접근. OWASP 1위.

**일반 점검:**
- 객체/함수 수준 인가(IDOR): 사용자가 `id`만 바꿔 남의 리소스에 접근 가능한가.
- 서버측에서 모든 요청에 대해 소유권/역할을 재검증하는가(클라 신뢰 금지).
- 기본 거부(deny-by-default)인가, 누락된 경로가 열려 있지 않은가.
- 경로 탐색(`../`), 강제 브라우징, CORS 오설정으로 인한 인가 우회.

**finsight 휴리스틱(CRITICAL):**
- 모든 DB 테이블에 RLS `auth.uid() = user_id` 적용 — `supabase/migrations/*.sql`에서 `enable row level security` + 정책 존재 확인. 누락 테이블 = critical.
- 서버는 `getUser()`/`getClaims()`로 검증하고 **`getSession()`을 인가에 쓰지 마라**(쿠키 위조 가능). authz 분기에 `getSession()`을 쓰면 high.
- **Pro 게이팅은 서버측 DB 구독상태로만**(`status active AND current_period_end > now()`). 요청 body/헤더의 `tier`를 신뢰하면 high(유료 우회).
- 체크아웃 `customerExternalId`는 클라 입력이 아니라 서버 세션 `getUser().id`로 강제 — 아니면 high(타인 명의 결제 귀속).
- service_role 키 사용은 웹훅 모듈 한정 + `import "server-only"` 가드. 일반 라우트에서 service_role로 RLS 우회 시 critical.

---

## A02:2025 — Security Misconfiguration
**무엇:** 안전하지 않은 기본값·불완전한 설정·과도한 노출. (2025에 순위 상승)

**일반 점검:**
- 비밀이 클라이언트 번들/공개 응답으로 새는가(`NEXT_PUBLIC_*`에 시크릿).
- 디버그 모드/상세 에러/스택트레이스가 프로덕션에 노출되는가.
- 보안 헤더(CSP, HSTS, X-Content-Type-Options, X-Frame-Options) 부재.
- CORS 와일드카드(`*`) + credentials, 열린 관리 엔드포인트.
- TLS 검증 비활성화(`rejectUnauthorized:false`), 불필요한 기능/포트 노출.

**finsight 휴리스틱(CRITICAL):**
- `NEXT_PUBLIC_`에 비밀키 금지 — `NEXT_PUBLIC_*SECRET|KEY|TOKEN|SERVICE` 패턴은 critical 후보(번들에 박혀 영구 유출).
- service_role 키는 `import "server-only"`로 가드되어 클라 번들에 포함 불가해야.
- `next.config.ts`·미들웨어의 헤더/CORS 설정 점검.
- Supabase 클라이언트가 anon 키만 클라에 노출하는지(service_role 노출 금지).

---

## A03:2025 — Software Supply Chain Failures
**무엇:** 의존성·서드파티 컴포넌트·빌드 파이프라인의 취약점/변조. (2025 신규 확장 — 기존 "Vulnerable & Outdated Components"보다 넓음: 빌드·배포·레지스트리까지)

**일반 점검:**
- 알려진 취약점이 있는 의존성(`npm audit` critical/high).
- lockfile 고정 여부, 신뢰 불가 출처 패키지, typosquatting.
- `postinstall` 등 빌드 스크립트의 임의 코드 실행, CI/배포 토큰 노출.
- 의존성 무결성(SRI, lockfile 무결성).

**finsight 휴리스틱:**
- `scan.py`의 `supply_chain`(npm audit) 결과를 그대로 반영. critical/high advisory는 각각 finding으로.
- 미설치 스캐너(osv-scanner/gitleaks/semgrep)로 인한 커버리지 공백을 finding이 아니라 **coverage gap**으로 정직히 표기.
- 핵심 SDK(@anthropic-ai/sdk·@supabase/*·@polar-sh/*)가 최신/고정인지.
- 결정론적 결과가 대부분이므로 LLM은 advisory 우선순위·실제 사용 여부(직접 의존 vs 트랜지티브)만 보강.

---

## A04:2025 — Cryptographic Failures
**무엇:** 민감 데이터의 부적절한 암호화·보호. (전송/저장 중 평문, 약한 알고리즘)

**일반 점검:**
- 전송/저장 중 민감정보 평문, 약한 해시(md5/sha1), 약한/하드코딩 키.
- 예측 가능한 난수(`Math.random()`)를 토큰/세션/OTP에 사용.
- 비밀번호 평문/약한 해싱, 솔트 부재.

**finsight 휴리스틱(CRITICAL):**
- 카드/계좌번호 등 **직접 식별자는 적재 시 마스킹**(전체 PAN 평문 저장 금지). 마스킹 로직이 적재 경로(`lib/` 파서→DB save)에 있는지, 전체값이 어디에도 평문으로 남지 않는지 확인. 위반 시 critical(PCI 성격).
- dedup용 hash는 정규화 평문 기준으로 계산하되 **별도 컬럼**에 보관(원문 복원 불가).
- 하드코딩된 API 키/토큰/비밀(`scan.py` secrets 결과) — placeholder/env-ref가 아닌 실제 값이면 critical.
- at-rest는 Supabase 기본 암호화 + RLS, 컬럼 암호화(pgcrypto)는 Post-MVP(설계상 미적용은 finding 아님, 단 PAN 전체 보관이면 critical).

---

## A05:2025 — Injection
**무엇:** 신뢰 불가 입력이 쿼리/명령/마크업으로 해석됨. (SQLi, XSS, 커맨드 인젝션, 프롬프트 인젝션)

**일반 점검:**
- SQL: 문자열 보간으로 만든 쿼리(파라미터 바인딩 부재).
- XSS: `dangerouslySetInnerHTML`, 미이스케이프 사용자 입력 렌더.
- 커맨드: `child_process`/`exec`에 사용자 입력 결합.
- `eval`/`new Function` 등 동적 코드 실행.

**finsight 휴리스틱:**
- Supabase 쿼리는 빌더(`.eq()`/`.filter()`)나 파라미터화 RPC를 쓰는지 — `.rpc()`/raw SQL에 문자열 보간 시 high/critical.
- **프롬프트 인젝션:** CSV의 가맹점명 등 사용자 제어 텍스트가 Claude 프롬프트에 들어간다. Claude에는 마스킹된 거래 단위만 전달하고, 모델 출력은 structured output(`parsed_output`)으로만 신뢰 — 자유 텍스트 출력을 그대로 실행/렌더하지 않는지.
- CSV 파싱이 결정론적 표준 파서 우선인지(LLM 폴백은 1회 확인 후 결정론).
- 대시보드가 거래 텍스트를 렌더할 때 React 기본 이스케이프 의존 + `dangerouslySetInnerHTML` 부재 확인.

---

## A06:2025 — Insecure Design
**무엇:** 구현 버그가 아니라 **설계 단계의 보안 통제 부재**. 위협 모델링·안전한 기본값의 부재.

**일반 점검:**
- 핵심 흐름(인증·결제·권한)에 위협 모델/남용 사례 대비가 있는가.
- 레이트 리밋·쿼터·중복요청 방어 등 남용 통제.
- 신뢰 경계가 명확한가(클라이언트를 신뢰하는 설계인가).
- 실패 시 안전한 상태로 떨어지는가(fail-safe).

**finsight 휴리스틱(CRITICAL — 다수가 설계 규칙):**
- **mock-first 레이어 경계:** `lib/`가 `services/`·외부 SDK를 import하지 않고 `types/` 포트에만 의존하는가(composition root에서 주입). 경계 붕괴는 보안 결합을 낳음 → medium.
- 외부 클라이언트는 **호출 시점 지연 생성**(모듈 import 시 env 읽고 throw 금지) — 키 없는 build/test 방어.
- **쿼터/캐시 설계:** `analyses` `unique(user_id, input_hash)` 캐시 + `ai_usage_daily` 원자 카운터로 tier별 일일 quota. 카운터가 원자적이지 않으면 race로 quota 우회(medium).
- **저장 트랜잭션:** statements·transactions·analyses는 Postgres RPC 단일 트랜잭션(`save_statement_analysis`), 중간 실패 시 전체 rollback. 부분 저장 설계면 데이터 정합성 위험(medium).
- **fail-safe:** Opus 초과/실패 시 규칙·통계 결과 보존 + AI 인사이트만 `unavailable` 격리. 미구독/쿼터소진 시 402가 아니라 200 + Free 결과 + `pro.status=locked|unavailable`.
- 결제 흐름의 멱등성·서명검증이 설계에 내장되어 있는가(A08과 연계).

---

## A07:2025 — Authentication Failures
**무엇:** 신원 검증의 약점. (세션 관리, 자격증명, OAuth 흐름)

**일반 점검:**
- 세션 토큰의 안전한 생성/저장/만료, 고정(fixation)·재사용 방어.
- 자격증명 스터핑·무차별 대입 방어(레이트 리밋), 약한 비밀번호 정책.
- OAuth: state/PKCE 검증, redirect_uri 화이트리스트, 토큰 검증.

**finsight 휴리스틱(CRITICAL):**
- Supabase 구글 OAuth — 콜백(`src/app/auth/callback/route.ts`)이 코드 교환·세션 설정을 안전하게 하는지, redirect 파라미터로 오픈 리다이렉트가 없는지.
- 서버는 `getUser()`/`getClaims()`로 토큰을 **검증**(네트워크 검증)하고 `getSession()`(로컬 쿠키)을 신뢰하지 않는지 — A01과 공유.
- 미들웨어가 보호 경로를 일관되게 가드하는지, 세션 갱신 흐름이 올바른지.

---

## A08:2025 — Software or Data Integrity Failures
**무엇:** 무결성 검증 없는 코드/데이터(역직렬화, 자동 업데이트, CI/CD 변조, 서명 미검증).

**일반 점검:**
- 신뢰 불가 데이터 역직렬화, 서명/무결성 검증 없는 외부 입력 수용.
- 웹훅·콜백의 출처 검증 부재.
- CI/CD 파이프라인·배포 아티팩트 무결성.

**finsight 휴리스틱(CRITICAL):**
- **웹훅(Polar) 무결성:** raw body 기준 서명검증(`validateEvent`) + `processed_webhook_events.event_id` 선삽입 멱등 처리. 서명 검증 전 body 파싱/처리, 또는 멱등 누락 시 high(위조/재생 공격).
- 서명 시크릿은 utf8 바이트로 정확히 비교(인코딩 함정 주의).
- 외부에서 받은 이벤트로 구독상태를 갱신하기 전 서명·event_id를 확정하는지.
- stale 이벤트(event_ts) 보호 — 오래된 이벤트로 상태 되돌림 방지.

---

## A09:2025 — Security Logging and Alerting Failures
**무엇:** 보안 이벤트의 로깅·탐지·경보 부재로 침해를 놓침. (2025: "Alerting" 강조)

**일반 점검:**
- 인증 실패·권한 거부·결제 이상 등 보안 이벤트가 로깅되는가.
- 로그에 **민감정보(비밀·전체 PAN·토큰)가 새지 않는가** — 로깅 자체가 누출 벡터가 될 수 있음.
- 이상 탐지·경보 경로가 있는가(없으면 medium/low, 설계 한계).

**finsight 휴리스틱:**
- 에러/실패 경로 로깅이 전체 식별자·비밀을 남기지 않는지(마스킹된 거래 단위만). 로그에 PAN/키가 찍히면 high.
- Claude 호출 실패·quota 소진·웹훅 검증 실패가 관측 가능한지(Vercel 로그). 과도하면 안 되고, 과소하면 침해 탐지 불가.
- MVP에서 중앙 경보 부재는 흔함 — finding보다는 정직한 한계로 표기(low/info), 단 **민감정보 로깅은 즉시 finding**.

---

## A10:2025 — Mishandling of Exceptional Conditions
**무엇:** 예외/에러 처리 미흡으로 인한 정보 노출·페일오픈·정합성 붕괴. (2025 신규)

**일반 점검:**
- 빈 catch(예외 삼킴), 부분 실패가 조용히 통과.
- 에러 응답에 스택트레이스·내부 경로·SQL·키가 노출.
- 실패 시 **페일오픈**(에러인데 권한을 허용하는 방향으로 떨어짐).
- 타임아웃·취소·부분 실패에서 자원/트랜잭션이 정합성을 유지하는가.

**finsight 휴리스틱(CRITICAL):**
- **fail-safe 방향:** Opus timeout(예: 30s)·실패 시 규칙·통계는 보존하고 AI 인사이트만 `unavailable`로 격리. 에러가 Pro 권한을 여는 방향이면 critical(페일오픈).
- Opus structured-output `max_tokens` 잘림 → `parse`가 JSON SyntaxError throw → AI 인사이트 조용히 unavailable. 이 경로가 사용자 데이터를 깨지 않고 격리되는지.
- 저장 RPC 중간 실패 시 전체 rollback(부분 저장 금지) — A06과 연계.
- 에러 응답이 내부정보(스택·env·식별자)를 클라에 노출하지 않는지.
- 빈 catch로 보안 검증(서명·권한) 실패를 삼키지 않는지.

---

## 점검 산출 규약 (모든 카테고리 공통)
- finding은 **코드 근거가 있어야** 한다(파일:라인 + 인용). 추측·일반론 금지.
- 담당 카테고리에 문제가 없으면 빈 배열 + `category_notes`에 "확인된 위반 없음 / 적용 근거"를 1줄로.
- 동일 이슈가 여러 카테고리에 걸치면 **가장 본질적인 1개 카테고리**에만 싣고 교차참조를 evidence에 적는다.
- coverage gap(미설치 도구로 못 본 영역)은 finding이 아니라 coverage로 보고.
