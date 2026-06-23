# Supabase Branching 적용 계획 (Migration Plan)

> 목적: finsight에 Supabase Branching을 켜는 작업의 **전체 흐름과 단계별 산출물**을 한 문서로 정리해,
> 작업자 외 사람도 "지금 어디까지 됐고, 다음에 뭘 만들어야 하는지"를 바로 이해할 수 있게 한다.
>
> 개념 설명(브랜칭이 무엇이고 어떻게 도는가)은 별도 자료 참고: [`docs/supabase-branching.html`](./supabase-branching.html)
> 이 문서는 그 위에서 **finsight 전용 롤아웃 절차**만 다룬다.

---

## 0. 한 줄 요약

프로덕션 = git `main`. 코드(`supabase/`)를 main에 선반영 → Supabase에서 GitHub 통합으로 브랜칭 ON →
브랜치는 **스키마(migrations)만 복제하고 데이터는 0에서 seed로 채움** → Vercel preview에 브랜치 DB env 자동주입.
**브랜치는 별도 인스턴스라 Pro 플랜 + 시간당 컴퓨트 과금**이 든다 — 그래서 토폴로지(브랜치 수)가 곧 비용이다.

---

## 1. 핵심 멘탈 모델 (3가지만 기억)

| # | 사실 | 함의 |
|---|------|------|
| 1 | 브랜치는 **스키마만** 가져온다. 프로덕션 데이터는 **복제 안 됨** | 데모/테스트 데이터는 `seed.sql`이 책임진다. seed가 곧 브랜치의 초기 상태 |
| 2 | 브랜치마다 **Supabase URL·anon·service_role 키가 다름** | preview 앱이 prod DB를 보면 안 됨 → Vercel env 자동주입이 핵심 |
| 3 | 브랜치 = **별도 인스턴스 = 과금** | 브랜치 수 = 비용. 토폴로지 결정이 첫 번째 의사결정 |

---

## 2. 현재 상태 (Before)

| 항목 | 상태 | 비고 |
|------|------|------|
| `supabase/migrations/0001~0005` | ✅ **커밋됨** | 스키마·RLS·RPC·구독/쿼터 정본 |
| `supabase/config.toml` | ⚠️ **미커밋(untracked)** | 브랜칭 Configure 단계가 읽는 파일. **선반영 필요** |
| `supabase/seed.sql` | ⚠️ **미커밋(untracked)** | 멱등(ON CONFLICT) + 합성 데이터. 데모 계정 `free@finsight.test` / `pro@finsight.test`. **선반영 필요** |
| Vercel 프로젝트 | ✅ 연동됨 | `prj_…Pvea7` (org `team_…79dp`) |
| git 브랜치 | `main` 단독 | production 브랜치 = `main` |
| Supabase 플랜 | ❓ **확인 필요** (무료로 추정) | 브랜칭은 Pro 필수 → Phase 2에서 검증 |
| Google OAuth (브랜치) | ❌ config에서 주석 처리 | 시크릿 없이 enabled면 Configure 실패하므로 의도적으로 off |

**결론:** 코드는 거의 준비됨. 남은 건 ① 미커밋 2개 선반영, ② 플랜/토폴로지 결정, ③ 대시보드·통합 설정.

---

## 3. 선행 결정 (Decisions — 착수 전 확정)

> 아래 4개는 비용·범위를 결정한다. **표의 "확정" 칸을 채운 뒤 Phase 1로 진행.**
> 각 항목의 **권장값**은 "솔로/MVP, 비용 최소" 가정의 기본안이다.

| ID | 결정 | 권장 (기본안) | 이유 / 트레이드오프 | 확정 |
|----|------|---------------|---------------------|------|
| **D1** | 플랜/비용 | Pro 업그레이드 | 브랜칭은 Pro 전제. 무료 유지 시 → 별도 무료 프로젝트를 staging으로 쓰는 대안(브랜칭 미사용) 검토 | ⬜ |
| **D2** | 브랜치 토폴로지 | **Persistent staging 1개** | 항상 떠있는 staging DB 하나 = 비용 예측 쉽고 단순. PR마다 preview는 격리는 최고지만 PR 수만큼 과금·복잡 | ⬜ |
| **D3** | Vercel preview env 자동주입 | **자동(공식 통합)** | preview 배포가 자기 브랜치 DB를 보게 함. 안 하면 preview가 prod DB를 보는 사고 위험 | ⬜ |
| **D4** | 브랜치 외부연동 미러링 | Anthropic(소액) + seed 데모. Google OAuth는 staging만. **Polar는 preview 제외** | Polar 웹훅은 브랜치 URL로 안 옴(§7 gotcha). 결제 플로우는 staging에서 test 모드+수동 트리거로만 | ⬜ |

**D2 보충 — 토폴로지 3안 비교**

| 안 | 브랜치 수 | 비용 | 격리 | 적합 |
|----|-----------|------|------|------|
| A. Persistent staging 1개 (권장) | 항상 1 | 낮음·예측가능 | 환경 단위 | 솔로/MVP |
| B. PR마다 preview | PR 수만큼(머지 시 정리) | PR 수에 비례 | PR 단위(최고) | 다인 협업·잦은 스키마 변경 |
| C. A + B 둘 다 | 1 + PR 수 | 가장 높음 | 최고 | 규모 커진 뒤 |

---

## 4. 단계별 실행 플로우 (Flow & Artifacts)

```
Phase 1            Phase 2                 Phase 3            Phase 4              Phase 5            Phase 6
코드 선반영   →   브랜칭 활성화      →   Vercel 통합   →   브랜치 시크릿   →   E2E 검증     →   문서화/런북
(main에 정본)     (Pro + GitHub)         (env 자동주입)     (OAuth/AI 키)        (첫 브랜치)        (팀 인계)
```

각 Phase는 **무엇을 / 어디서 / 산출물(Artifact) / 검증 / 의존성**으로 기술한다.

---

### Phase 1 — 코드 선반영 (config.toml + seed.sql → main)

- **무엇:** 미커밋 상태인 `supabase/config.toml`, `supabase/seed.sql`을 main에 커밋. 브랜칭 Configure/Seed 단계가 **main의 파일**을 읽으므로 선행 필수.
- **어디서:** 로컬 → PR → main 머지.
- **검증:**
  - `git ls-files supabase/` 에 `config.toml`·`seed.sql` 포함 확인.
  - `seed.sql`이 합성 데이터·*.test 이메일·마스킹 식별자만 쓰는지 재확인(실데이터/PAN 금지).
  - (선택) 로컬 `supabase start` → seed 적용 후 데모 계정 로그인 가능 확인.
- **의존성:** 없음. **가장 먼저.**
- **산출물(Artifact):**
  - main에 `supabase/config.toml`, `supabase/seed.sql` 커밋
  - PR 1건 (`chore(branching): supabase config/seed 정본 선반영`)

---

### Phase 2 — 브랜칭 활성화 (Pro 업그레이드 + GitHub 통합)

- **무엇:** Supabase 프로젝트를 Pro로 올리고(필요 시), GitHub 통합으로 브랜칭을 켠다. production 브랜치 = `main`.
- **어디서:** Supabase 대시보드 → Branches / Integrations(GitHub). (D1 확정 선행)
- **검증:**
  - 대시보드 Branches 탭 노출 + production = `main` 매핑.
  - main push가 production에 migration 적용으로 이어지는지(첫 push 로그) 확인.
  - 과금 안내(브랜치 컴퓨트) 확인 후 진행.
- **의존성:** Phase 1 (main에 supabase/ 정본), D1·D2 확정.
- **산출물(Artifact):**
  - Branching 활성 상태 + production 브랜치 매핑
  - (D1) 업그레이드된 org billing
  - GitHub ↔ Supabase 통합 연결

---

### Phase 3 — Vercel ↔ Supabase 통합 (preview env 자동주입)

- **무엇:** Supabase의 Vercel Integration으로 **브랜치별 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`·`SUPABASE_SERVICE_ROLE_KEY`**를 해당 Vercel preview 배포에 자동 주입.
- **어디서:** Supabase 대시보드 Integrations → Vercel (프로젝트 `prj_…Pvea7` 연결).
- **검증:**
  - 테스트 브랜치/ PR의 Vercel preview 배포 env에 **prod와 다른** Supabase URL/키가 들어갔는지 확인.
  - preview 앱이 prod가 아닌 브랜치 DB를 보는지(데모 계정 존재 여부로 구분) 확인.
- **의존성:** Phase 2.
- **산출물(Artifact):**
  - Vercel ↔ Supabase 통합 구성
  - preview 환경 env 매핑 규칙(문서 §7에 1줄 기록)

---

### Phase 4 — 브랜치 시크릿 / 외부연동 구성 (D4 따름)

- **무엇:** 브랜치에서 필요한 비-Supabase 시크릿을 설정. Supabase 브랜칭은 **Supabase 키만** 자동화하고 나머지(Anthropic·Polar·Google)는 별도다.
  - **Anthropic:** 브랜치/preview env에 `ANTHROPIC_API_KEY` 주입(소액). 없으면 AI 인사이트 `unavailable`로 격리(기존 동작 유지).
  - **Google OAuth:** staging에서만 — `config.toml`의 `[auth.external.google]` 주석 해제 + 브랜치 secrets에 `SUPABASE_AUTH_GOOGLE_CLIENT_ID`/`_SECRET`. (시크릿 없이 enabled면 Configure 실패)
  - **Polar:** preview 제외. staging에서 test 모드 + 수동 트리거(§7).
- **어디서:** Vercel 환경변수(앱 키) + Supabase 브랜치 secrets(OAuth) + `config.toml`(OAuth 토글).
- **검증:** staging 브랜치에서 구글 로그인/AI 분석이 의도대로 동작(또는 의도된 `unavailable`).
- **의존성:** Phase 3, D4 확정.
- **산출물(Artifact):**
  - 브랜치 secrets 설정값(문서화, 값 자체는 비공개)
  - `config.toml` OAuth 토글 정책 확정(켤지/끌지)

---

### Phase 5 — 첫 브랜치 E2E 검증

- **무엇:** D2 토폴로지대로 첫 브랜치(persistent staging 또는 PR preview)를 만들고 끝까지 돈다.
- **검증 시나리오:**
  1. 브랜치 생성 → migrations 5개 적용 성공 → seed 적용 성공(실패 시 seed skip 됨 주의).
  2. 데모 계정 `free@…` / `pro@…` 로그인.
  3. CSV 업로드 → 분석 → 대시보드 표시. Pro 게이팅이 **브랜치 DB의 구독상태**로 판정되는지.
  4. preview 앱이 브랜치 DB를 보는지(prod 데이터 안 보임) 재확인.
- **의존성:** Phase 1~4.
- **산출물(Artifact):**
  - 검증된 첫 브랜치(스키마+seed 정상)
  - 스모크 결과 기록(체크리스트 §8 체크 + 스크린샷)

---

### Phase 6 — 운영 문서화 / 런북

- **무엇:** 반복 운영 절차를 팀이 따라할 수 있게 정리. 이 문서의 §7/§8을 런북으로 유지.
- **검증:** 작업자 외 1명이 문서만 보고 "브랜치 만들고 검증" 재현 가능.
- **의존성:** Phase 5.
- **산출물(Artifact):**
  - 본 문서 최종본(결정 표 확정 채움)
  - 팀 공지 1건(브랜칭 ON·비용·사용법)

---

## 5. 비용 모델 (요약)

- **고정:** Pro 플랜 (조직 단위).
- **변동:** 브랜치 = 별도 인스턴스 → **켜져 있는 시간만큼 컴퓨트 과금.**
  - persistent staging: 항상 1개분.
  - PR preview: 비활성 시 자동 pause / 머지 시 삭제 → 실제 떠있는 시간만 과금.
- **비용 통제 레버:** D2 토폴로지(브랜치 수) + preview 자동 pause + 안 쓰는 persistent 브랜치 정리.
- (정확한 단가는 Supabase 가격 페이지로 D1 단계에서 확인 — 변동 가능하므로 본 문서에 숫자 하드코딩하지 않음.)

---

## 6. 롤백 / 비활성화

- 브랜치는 **삭제해도 production(main)에 영향 없음** — 스키마만 복제본이라 안전.
- 비활성화: 대시보드에서 브랜칭 끄기 / GitHub 통합 해제. main = production은 그대로 유지.
- 비용만 멈추고 싶으면: 브랜치 삭제 또는 pause. 코드(`supabase/`)는 그대로 둬도 무해.

---

## 7. 운영 Gotcha (실패 지점 미리 박제)

1. **데이터 0 시작** — 브랜치는 prod 데이터를 복제하지 않는다. "데이터 없음"은 버그가 아니라 사양. seed가 유일한 초기 데이터원.
2. **migration 실패 → seed skip** — migration이 깨지면 그 브랜치의 seed 단계가 통째로 건너뛰어진다. 브랜치 생성 로그에서 migration 성공을 먼저 확인.
3. **Polar 웹훅은 브랜치 URL로 안 온다** — preview/staging은 URL이 달라 prod에 걸어둔 웹훅이 닿지 않는다. 결제 검증은 staging에서 **test 모드 + 수동 이벤트 트리거**로. preview에서 결제 플로우는 기대하지 말 것.
4. **OAuth는 시크릿 없으면 Configure 실패** — `[auth.external.google]`를 켜려면 반드시 브랜치 secrets에 client_id/secret이 있어야 한다. 없으면 켜지 말 것(기본 off 유지).
5. **preview가 prod DB를 보는 사고** — Vercel env 자동주입(Phase 3)이 안 되면 preview 앱이 prod를 가리킨다. Phase 3 검증을 절대 건너뛰지 말 것.
6. **config.toml drift** — 대시보드에서 직접 바꾼 prod 설정이 `config.toml`과 어긋나면 브랜치가 prod와 달라진다. 설정 변경은 config.toml 경유로 단일화.

---

## 8. 체크리스트 (착수 시 복붙)

**결정**
- [ ] D1 플랜/비용 확정
- [ ] D2 토폴로지 확정
- [ ] D3 Vercel 자동주입 확정
- [ ] D4 외부연동 미러링 범위 확정

**Phase 1 — 코드 선반영**
- [ ] `config.toml`·`seed.sql` main 커밋 (`git ls-files supabase/`로 확인)
- [ ] seed 합성 데이터/마스킹/.test 이메일 재확인

**Phase 2 — 활성화**
- [ ] Pro 업그레이드(필요 시)
- [ ] GitHub 통합 + production=`main` 매핑
- [ ] main push → production migration 적용 확인

**Phase 3 — Vercel**
- [ ] Vercel Integration 구성
- [ ] preview env에 prod와 다른 Supabase URL/키 주입 확인

**Phase 4 — 시크릿**
- [ ] Anthropic 키 주입(또는 unavailable 의도 확인)
- [ ] (staging) Google OAuth secrets + config 토글
- [ ] Polar test 모드/수동 트리거 정책 명시

**Phase 5 — E2E**
- [ ] 브랜치 생성 → migration 5개 → seed 성공
- [ ] 데모 계정 로그인
- [ ] CSV 업로드→분석→대시보드, Pro 게이팅(브랜치 구독상태)
- [ ] preview가 브랜치 DB를 봄(prod 아님)

**Phase 6 — 인계**
- [ ] 본 문서 결정 표 채움
- [ ] 팀 공지(비용·사용법)
