export const meta = {
  name: 'review-code',
  description: '차원별 병렬 서브에이전트로 변경분을 리뷰하고 각 발견을 adversarial 검증',
  phases: [
    { title: 'Review', detail: '차원별(correctness·security·conventions) 병렬 리뷰' },
    { title: 'Verify', detail: '각 발견을 3명 skeptic이 반박, 2/3 다수결로 false positive 제거' },
  ],
}

// ── 입력 ─────────────────────────────────────────────────────────────────────
// args = { diff: string, files: string, repoDocs: string, scope?: string }
//   diff:     통합 diff 텍스트 (변경 라인 번호 포함)
//   files:    변경 파일 목록(개행 구분)
//   repoDocs: CLAUDE.md + ARCHITECTURE.md + ADR.md 본문(가드레일)
//   scope:    리뷰 범위 설명 (예: "main...HEAD") — 표시용
let input = args
if (typeof input === 'string') {
  try {
    input = JSON.parse(input)
  } catch {
    input = {}
  }
}
const diff = input?.diff ?? ''
const files = input?.files ?? ''
const repoDocs = input?.repoDocs ?? ''

log(`[review-code] args=${typeof args} diffLen=${diff.length} filesLen=${files.length} docsLen=${repoDocs.length}`)

if (!diff.trim()) {
  log('[review-code] diff가 비어 종료 (입력 전달 확인 필요)')
  return { confirmed: [], stats: { total: { raw: 0, confirmed: 0 }, byDim: {}, bySeverity: {} } }
}

// ── 스키마 ───────────────────────────────────────────────────────────────────
const FINDINGS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['severity', 'file', 'line', 'title', 'tldr', 'fix'],
        properties: {
          severity: { type: 'string', enum: ['critical', 'major', 'minor', 'nit'] },
          file: { type: 'string', description: '저장소 루트 기준 경로 (예: src/lib/money.ts)' },
          line: { type: 'number', description: 'diff 신규(RIGHT) 측 라인 번호 — 인라인 코멘트 게시용' },
          title: { type: 'string', description: '한 줄 제목' },
          tldr: { type: 'string', description: '무엇이/왜 문제인가 한 줄' },
          good: { type: 'string', description: '잘 지킨 맥락/규칙 (없으면 빈 문자열)' },
          fix: { type: 'string', description: '수정 방안 — 가능하면 코드 스니펫' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isReal', 'reason'],
  properties: {
    isReal: { type: 'boolean', description: '진짜 문제이며 보고할 가치가 있으면 true' },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    reason: { type: 'string', description: '판단 근거 한 줄' },
  },
}

// ── 차원 정의 (MVP 3개) ──────────────────────────────────────────────────────
// 향후 확장: 이 배열에 { key, prompt } 항목을 추가하기만 하면 된다.
const common = (dimensionName) =>
  `너는 finsight 코드 리뷰어다. 아래 diff에서 **${dimensionName}** 차원만 검토한다.\n` +
  `\n규칙:\n` +
  `- 이 차원에 해당하는 위반·버그만 보고하라. 다른 차원·스타일 취향·범위 밖 개선은 무시하라.\n` +
  `- 추측성 지적 금지. diff와 가드레일 문서로 확인 가능한 것만 보고하라.\n` +
  `- 발견이 없으면 findings를 빈 배열로 반환하라. 억지로 만들지 마라.\n` +
  `- 각 발견의 file은 저장소 루트 기준 경로, line은 diff 신규(RIGHT) 측 라인 번호로 적어라(인라인 코멘트 게시에 쓰인다).\n` +
  `- good은 해당 위치에서 잘 지킨 규칙/맥락(없으면 빈 문자열), fix는 수정 방안(가능하면 코드).\n` +
  `\nseverity 기준:\n` +
  `- critical: 보안 취약점 · 데이터 무결성 훼손 · 명백한 런타임/로직 버그(머지 차단 수준)\n` +
  `- major: CRITICAL 규칙 위반 · 잘못된 동작(머지 전 수정 필요)\n` +
  `- minor: 개선 권장(머지는 가능)\n` +
  `- nit: 취향/사소\n`

const DIMENSIONS = [
  {
    key: 'correctness',
    prompt:
      common('correctness (정확성·데이터 무결성)') +
      `\n이 차원의 집중 검사 항목(finsight CRITICAL 규칙):\n` +
      `- 금액은 numeric을 쓰고 float/parseFloat 금지. 통화기호·콤마·괄호음수 정규화 누락.\n` +
      `- 부호 규약(지출 양수/환불 음수)을 direction(debit/credit/refund)으로 단일화했는가. 부호가 뒤집히면 분석이 조용히 반대로 나온다.\n` +
      `- 합계/소계 요약행을 필터링하는가.\n` +
      `- statements·transactions·analyses 저장이 Postgres RPC 단일 트랜잭션(save_statement_analysis)이며 중간 실패 시 전체 rollback인가.\n` +
      `- analyses 캐시 unique(user_id, input_hash), ai_usage_daily 원자 카운터(일일 quota)가 올바른가.\n` +
      `- 그 외 일반 로직 버그(off-by-one, null 처리, 잘못된 비교 등).`,
  },
  {
    key: 'security',
    prompt:
      common('security & privacy (보안·개인정보)') +
      `\n이 차원의 집중 검사 항목(finsight CRITICAL 규칙):\n` +
      `- 모든 DB 테이블에 RLS auth.uid() = user_id 적용. 서버는 getUser()/getClaims()로 검증하고 getSession()을 신뢰하지 않는가.\n` +
      `- service_role 키는 웹훅 모듈에서만, import "server-only"로 가드되는가. NEXT_PUBLIC_에 비밀키가 새지 않는가.\n` +
      `- 카드·계좌번호 등 직접 식별자를 적재 시 마스킹하는가(전체 PAN 평문 저장 금지). dedup hash는 별도 컬럼인가.\n` +
      `- Claude에는 마스킹된 거래 단위(가맹점·금액·날짜·카테고리)만 전달하는가. 전체 식별자가 외부로 나가지 않는가.\n` +
      `- Pro 게이팅이 서버측 DB 구독상태(status active AND current_period_end > now())로만 판정되는가. 요청 body/헤더의 tier를 신뢰하면 위반.\n` +
      `- 체크아웃 customerExternalId가 클라이언트 입력이 아니라 서버 세션 getUser().id로 강제되는가.\n` +
      `- 웹훅이 raw body 서명검증 + processed_webhook_events.event_id 선삽입으로 멱등 처리되는가.`,
  },
  {
    key: 'conventions',
    prompt:
      common('conventions & architecture (컨벤션·아키텍처)') +
      `\n이 차원의 집중 검사 항목(finsight CRITICAL 규칙):\n` +
      `- 레이어 의존성 단방향: lib/가 services/나 외부 SDK(@anthropic-ai/sdk·@supabase/*·@polar-sh/*)를 import하면 위반(Zod 등 순수 유틸 예외).\n` +
      `- 외부 클라이언트(Supabase/Claude/Polar)는 모듈 import 시점이 아니라 호출 시점에 지연 생성하는가.\n` +
      `- 컴포넌트는 props만 받는 dumb이며 계산·포맷·파싱·마스킹 로직은 lib/에 있는가. 디렉토리 src/{app,components,lib,services,types} 준수.\n` +
      `- 미구독/쿼터소진 시 /api/analyze가 402가 아니라 200 + Free 결과 + pro.status=locked|unavailable인가.\n` +
      `- Vantage 디자인: 색은 토큰만 참조(hex 인라인 금지), accent는 --primary 단일, 숫자는 JetBrains Mono(tabular), 화면에 'Vantage' 노출 금지.`,
  },
]

// ── 검증 폭발 방지 ───────────────────────────────────────────────────────────
const MAX_PER_DIM = 8 // 차원당 검증 대상 finding 상한. 초과분은 log로 고지(silent cap 금지).

// ── Review → Verify 파이프라인 ───────────────────────────────────────────────
// pipeline: 한 차원의 발견이 검증되는 동안 다른 차원은 아직 리뷰 중이어도 됨(barrier 불필요).
const results = await pipeline(
  DIMENSIONS,
  // 1단계: 차원별 리뷰
  (d) =>
    agent(
      `${d.prompt}\n\n## 가드레일 문서\n${repoDocs}\n\n## 변경 파일\n${files}\n\n## diff\n${diff}`,
      { label: `review:${d.key}`, phase: 'Review', schema: FINDINGS_SCHEMA },
    ),
  // 2단계: 각 발견을 3명 skeptic이 반박 → 2/3 다수결
  (review, dim) => {
    const found = (review?.findings ?? []).map((f) => ({ ...f, dimension: dim.key }))
    if (found.length > MAX_PER_DIM) {
      log(`${dim.key}: 발견 ${found.length}건 중 상위 ${MAX_PER_DIM}건만 검증(상한). 나머지는 미검증으로 제외.`)
    }
    return parallel(
      found.slice(0, MAX_PER_DIM).map((f) => () =>
        parallel(
          Array.from({ length: 3 }, (_, i) => () =>
            agent(
              `다음 리뷰 발견이 진짜 문제인지 반박하라. 의심부터 하고, 확신이 없으면 isReal=false를 기본값으로 삼아라.\n\n` +
                `[${f.severity}] ${f.title}\n위치: ${f.file}:${f.line}\nTL;DR: ${f.tldr}\n제안된 수정: ${f.fix}\n\n` +
                `아래 diff와 가드레일로 교차검증하라. 발견이 실제 변경된 코드에 근거하는지, 오해/허위(예: 존재하지 않는 라인, 이미 처리된 케이스)는 아닌지 확인하라.\n\n` +
                `## 가드레일 문서\n${repoDocs}\n\n## diff\n${diff}`,
              { label: `verify:${dim.key}:${i}`, phase: 'Verify', schema: VERDICT_SCHEMA },
            ),
          ),
        ).then((votes) => {
          const yes = votes.filter(Boolean).filter((v) => v.isReal).length
          return { ...f, real: yes >= 2, votes: yes }
        }),
      ),
    )
  },
)

// ── 집계 ─────────────────────────────────────────────────────────────────────
const all = results.flat().filter(Boolean)
const confirmed = all.filter((f) => f.real)

const byDim = {}
for (const f of all) {
  byDim[f.dimension] = byDim[f.dimension] ?? { raw: 0, confirmed: 0 }
  byDim[f.dimension].raw++
  if (f.real) byDim[f.dimension].confirmed++
}

const bySeverity = { critical: 0, major: 0, minor: 0, nit: 0 }
for (const f of confirmed) bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1

log(
  `검증 완료: 후보 ${all.length}건 → 확정 ${confirmed.length}건 ` +
    `(critical ${bySeverity.critical} · major ${bySeverity.major} · minor ${bySeverity.minor} · nit ${bySeverity.nit})`,
)

return {
  confirmed,
  stats: { total: { raw: all.length, confirmed: confirmed.length }, byDim, bySeverity },
}
