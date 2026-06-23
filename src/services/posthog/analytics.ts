import { PostHog } from "posthog-node";

import type { AnalyticsPort } from "@/types/ports";

let posthogClient: PostHog | null = null;

// posthog-node 서버 클라이언트는 호출 시점에 지연 생성한다(CLAUDE.md: 모듈 import
// 시점에 env를 읽어 throw하면 키 없는 build/test가 깨진다). flushAt:1로 capture
// 즉시 전송을 시도하되, serverless(Vercel 람다)는 응답 반환 직후 freeze되므로
// 호출부가 flush()를 await해 in-flight 이벤트 유실을 막는다.
export function getPostHogClient(): PostHog {
  if (!posthogClient) {
    posthogClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  return posthogClient;
}

// lib(orchestration)에 주입할 AnalyticsPort 어댑터. lib는 이 포트에만 의존하고,
// posthog-node는 services 레이어인 여기서만 import한다(아키텍처 단방향).
export function createPostHogAnalytics(): AnalyticsPort {
  const client = getPostHogClient();

  return {
    capture(input) {
      client.capture({
        distinctId: input.distinctId,
        event: input.event,
        properties: input.properties,
      });
    },
    async flush() {
      await client.flush();
    },
  };
}

// Next.js instrumentation의 onRequestError에서 서버 라우트/RSC 예외를 캡처한다.
// 루트 instrumentation.ts는 vitest include 밖이라 테스트되지 않으므로, 캡처 로직을
// services에 두어 단위 테스트가 가능하게 한다. 예외 1건을 캡처하고 곧바로 flush해
// 람다 종료 전 전송을 보장한다.
export async function captureServerException(
  error: unknown,
  context?: {
    distinctId?: string;
    properties?: Record<string | number, unknown>;
  },
): Promise<void> {
  const client = getPostHogClient();

  client.captureException(
    toError(error),
    context?.distinctId,
    context?.properties,
  );

  await client.flush();
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
