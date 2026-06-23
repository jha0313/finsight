import type { Instrumentation } from "next";

export function register(): void {
  // 서버 인스트루멘테이션 등록 훅. 클라이언트 초기화는 instrumentation-client.ts가
  // 담당하므로 여기서 추가로 할 작업은 없다.
}

// Next.js 서버 라우트/RSC에서 처리되지 않은 예외를 PostHog 에러 트래킹으로 보낸다
// (클라이언트 예외는 instrumentation-client.ts의 capture_exceptions가 담당). posthog-node는
// nodejs 런타임 전용이라 edge에서는 건너뛰고, 동적 import로 nodejs에서만 로드한다.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { captureServerException } = await import(
    "@/services/posthog/analytics"
  );

  await captureServerException(error, {
    properties: { route: request.path, method: request.method },
  });
};
