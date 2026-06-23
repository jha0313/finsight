// finsight CLAUDE.md의 CRITICAL 룰 요약 — 경량 리뷰어(eval 대상)의 채점 기준이다.
// 실제 /review-code 하네스로 교체할 때는 reviewer.ts만 들어내면 되고 이 룰 목록은
// 그대로 재사용한다. 룰 문구는 케이스 frontmatter의 rule과 의미가 일치해야 한다.

export const FINSIGHT_RULES: readonly string[] = [
  "레이어 의존성은 단방향이다. lib/는 services/와 외부 SDK(@anthropic-ai/sdk·@supabase/*·@polar-sh/*)를 import하면 안 된다. lib는 types/의 포트 인터페이스에만 의존하고 실제 어댑터는 route handler(composition root)에서 주입한다. (zod 등 순수 유틸은 예외)",
  "외부 클라이언트(Supabase/Claude/Polar)는 모듈 import 시점이 아니라 호출 시점에 지연 생성한다.",
  '모든 DB 테이블에 RLS(auth.uid() = user_id)를 적용한다. service_role 키는 웹훅 모듈에서만 쓰고 import "server-only"로 가드하며, NEXT_PUBLIC_에는 어떤 비밀키도 두지 않는다.',
  "Pro 게이팅은 서버측 DB 구독상태(status active AND current_period_end > now())로만 판정한다. 요청 본문/헤더의 tier를 신뢰하지 않는다.",
  "금액은 numeric으로 다루고 float(parseFloat 등)을 쓰지 않는다. 통화기호·콤마·괄호음수를 정규화하고 부호 규약을 direction으로 단일화한다.",
  "카드·계좌번호 등 직접 식별자는 적재 시 마스킹하며 전체값을 평문 저장하지 않는다. Claude에는 마스킹된 거래 단위만 전달한다.",
  "체크아웃의 customerExternalId는 클라이언트 입력이 아니라 서버 세션 getUser().id로 강제한다.",
];

export function reviewerSystemPrompt(): string {
  return [
    "당신은 finsight 코드 리뷰어입니다. 아래 CLAUDE.md CRITICAL 룰을 기준으로 주어진 코드 변경(diff/스니펫)을 리뷰하세요.",
    "",
    "[CRITICAL 룰]",
    ...FINSIGHT_RULES.map((rule, index) => `${index + 1}. ${rule}`),
    "",
    "출력 형식:",
    "- 위반이 있으면 각 위반마다 (1) 어긴 룰 (2) 심각도(critical/major/minor) (3) 한 줄 근거를 적으세요.",
    "- 위반이 없으면 명확히 '위반 없음(통과)'이라고 답하세요.",
    "- 정상 패턴(포트 인터페이스 import, 주입된 factory를 통한 지연 생성 등)을 위반으로 오인하지 마세요.",
    "한국어 산문으로 간결하게 답하세요.",
  ].join("\n");
}
