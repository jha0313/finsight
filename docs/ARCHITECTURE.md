# 아키텍처

## 디렉토리 구조
```
src/
├── app/         # 페이지 + API 라우트 (composition root)
├── components/  # UI 컴포넌트 (dumb, props만 받음)
├── types/       # 도메인 타입 + 포트 인터페이스 (leaf, 값 import 0)
├── lib/         # 도메인 로직 (csv 파서/매핑, 마스킹, 분석, 오케스트레이션, gating)
└── services/    # 외부 API 어댑터 (claude, supabase, polar)
```

## 레이어 의존성 (단방향)
```
app → lib → types ← services
```
- `types/`는 **leaf**: 어떤 런타임 코드도 import하지 않는다(type-only).
- `lib/`는 `services/`·외부 SDK를 import하지 않는다. 포트(`types/`)에만 의존하고, 어댑터는 route(composition root)에서 주입.
- `services/`는 `lib/`를 import하지 않는다(순환 방지). `types/`만 안다.
- ESLint `no-restricted-imports` / `no-cycle`로 강제(project-setup에서 설정).

## 데이터 흐름 (동기 처리)
```
사용자 → 대시보드(Client) → POST /api/analyze
  → lib/csv 표준 파싱 (인코딩 감지 · 부호/금액 정규화 · 합계행 필터)
       └ 컬럼 인식 실패 시에만 services/claude 폴백 매핑 → 사용자 1회 확인
  → lib/mask 직접 식별자(카드·계좌번호) 마스킹
  → lib/analysis 규칙·통계 분석 (①분류 ②추이 ③이상탐지 · 룰베이스)
  → [quota OK] services/claude AI 인사이트 (마스킹된 거래 단위 전달 · Free=Sonnet / Pro=Opus · timeout 30s)
  → Postgres RPC(save_statement_analysis) 단일 트랜잭션 저장 (RLS)
  → 200 + { free, pro:{status,insights?}, tier, warnings } → 차트·인사이트 렌더
```
- 규칙·통계 분석은 LLM 0. Claude는 ① 표준 파싱 폴백 매핑, ② AI 인사이트(Free=Sonnet/Pro=Opus)에서 호출.
- 미구독/쿼터소진/Claude 실패 시에도 **200 + 규칙·통계 결과**를 보존하고 AI 인사이트 상태(`pro.status` 등)로 잠금/불가를 표현(402 아님).
- opus(Pro)는 latency가 크므로 Vercel `maxDuration` 상향 + Claude `timeout` 필수. 대용량은 행 상한/요약으로 토큰 방어.

## 상태 관리
- 서버 상태: Server Components + Route Handlers
- 클라이언트 상태: 업로드·차트 인터랙션만 Client Component(`useState`)
- 구독상태 진실원천: Polar 웹훅 → `subscriptions` 테이블 (클라이언트 토글 금지)

## mock-first
- 포트/어댑터 + 의존성 주입. 외부 클라이언트는 **호출 시점 지연 생성**(import 시 env 읽어 throw 금지).
- 단위 테스트는 테스트 더블(FakeInsightProvider · 목 SupabaseClient · 고정 Polar 페이로드)로 네트워크 0.
- composition root는 route handler(얇은 와이어링). 분기·에러매핑은 `lib/orchestration`(TDD 강제).

## 보안 & 프라이버시
- **저장**: 카드·계좌번호 등 직접 식별자는 적재 시 마스킹해 전체값을 평문 보관하지 않는다(전체 PAN 미보관). 나머지 거래 데이터는 Supabase at-rest + RLS로 보호(컬럼 암호화는 Post-MVP).
- **전송**: Claude(Free=Sonnet/Pro=Opus)에는 마스킹된 거래 단위(가맹점명·금액·날짜·카테고리)만 전송. 전체 식별자 미전송(가맹점명은 구체 인사이트를 위해 의도적 허용).
- **격리**: 전 테이블 RLS `auth.uid()=user_id`로 "A의 명세서를 B가 못 본다"를 DB 레벨 보장.
- **삭제**: 전 체인 `on delete cascade`(계정삭제 UI는 Post-MVP, cascade FK는 유지).

## DB 스키마 (요약)
- `statements`(명세서 · status[ready/failed] · source_hash, `unique(user_id,source_hash)`)
- `transactions`(거래 · `signed_amount numeric(14,2)` · `direction` · `category text` · `row_hash` · 직접 식별자 마스킹 저장, dedup `unique(statement_id,row_hash)` + on conflict)
- `analyses`(AI ④/⑤ 결과만 jsonb, 캐시 키 `unique(user_id,input_hash)` · 모델 포함)
- `subscriptions`(user PK · 웹훅 upsert · `polar_subscription_id` · `status` · `current_period_end`)
- `processed_webhook_events`(`event_id` PK · 재전송 멱등)
- `ai_usage_daily`(`unique(user_id,usage_date)` · 호출 카운터 원자 증가 → tier별 일일 quota)
- `profiles`·`categories` 테이블 없음 (user_id는 `auth.users` 직접 FK, category는 코드 상수 union)
- 전 테이블 RLS `auth.uid()=user_id` + user_id 인덱스, 전 체인 `on delete cascade`
- 저장 RPC `save_statement_analysis(...)`: statement/transaction/analysis를 한 트랜잭션으로(중간 실패 시 전체 rollback)
- 마이그레이션 SQL은 작성만(적용은 수동 `supabase db push`)
