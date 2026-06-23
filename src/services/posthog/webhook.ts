import { createHash, timingSafeEqual } from "node:crypto";

import type { OncallAlert, OncallDispatchGateway } from "@/types/ports";

// PostHog error-tracking webhook destination에 커스텀 헤더로 심은 공유 시크릿을
// 검증한다. PostHog HTTP destination은 요청 서명 표준(HMAC)이 없어, Authorization
// Bearer(또는 x-oncall-secret) 공유 시크릿을 상수시간 비교로 검증한다. 시크릿
// 누락/불일치 또는 본문 JSON 파싱 실패면 throw → 호출부가 401로 격리한다.
// 시크릿은 import 시점이 아니라 호출 시점에 읽는다(키 없는 build/test 보호).
export function verifyPostHogWebhook(
  rawBody: string,
  headers: Record<string, string>,
): OncallAlert {
  const secret = process.env.ONCALL_WEBHOOK_SECRET;

  if (secret === undefined || secret === "") {
    throw new Error(
      "ONCALL_WEBHOOK_SECRET is required to verify PostHog webhooks.",
    );
  }

  if (!constantTimeEqual(extractSecret(headers), secret)) {
    throw new Error("invalid PostHog webhook secret");
  }

  let payload: unknown;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    throw new Error("PostHog webhook body is not valid JSON.");
  }

  return { eventId: deriveEventId(payload, rawBody), payload };
}

// GitHub repository_dispatch로 oncall-triage 워크플로우를 깨운다. SDK 없이 REST
// 한 번 호출. 토큰·repo는 호출 시점에 읽는다.
export function createGitHubDispatch(): OncallDispatchGateway {
  return {
    async dispatch(payload) {
      const token = requireEnv("GH_DISPATCH_TOKEN");
      const repo = requireEnv("GH_DISPATCH_REPO"); // "owner/name"

      const response = await fetch(
        `https://api.github.com/repos/${repo}/dispatches`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            accept: "application/vnd.github+json",
            "x-github-api-version": "2022-11-28",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            event_type: "oncall-alert",
            client_payload: payload,
          }),
        },
      );

      if (!response.ok) {
        const detail = await response.text().catch(() => "");

        throw new Error(
          `GitHub repository_dispatch failed: ${response.status} ${detail}`,
        );
      }
    },
  };
}

function extractSecret(headers: Record<string, string>): string {
  const raw = headers["authorization"] ?? headers["x-oncall-secret"] ?? "";

  return raw.startsWith("Bearer ") ? raw.slice("Bearer ".length) : raw;
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");

  if (ab.length !== bb.length) {
    // 길이가 다르면 즉시 false지만, timingSafeEqual을 한 번 호출해 길이 분기의
    // 타이밍 누출을 줄인다(같은 버퍼끼리 비교).
    timingSafeEqual(bb, bb);

    return false;
  }

  return timingSafeEqual(ab, bb);
}

// PostHog alert payload는 형태가 다양하다. 흔한 식별자 후보를 순서대로 시도하고,
// 없으면 rawBody 해시로 폴백한다(동일 본문 재전송 = 동일 키 → 멱등). Polar
// event_id와 같은 테이블을 쓰므로 "posthog:" prefix로 네임스페이스를 분리한다.
function deriveEventId(payload: unknown, rawBody: string): string {
  const explicit = pickId(payload);
  const base =
    explicit ?? createHash("sha256").update(rawBody, "utf8").digest("hex");

  return `posthog:${base}`;
}

function pickId(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  for (const key of ["eventId", "event_id", "id", "uuid"]) {
    const value = record[key];

    if (typeof value === "string" && value !== "") {
      return value;
    }
  }

  const issue = record["issue"];

  if (typeof issue === "object" && issue !== null) {
    const id = (issue as Record<string, unknown>)["id"];

    if (typeof id === "string" && id !== "") {
      const triggeredAt =
        typeof record["triggered_at"] === "string"
          ? record["triggered_at"]
          : "";

      return `${id}:${triggeredAt}`;
    }
  }

  return null;
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    throw new Error(`${name} is required to dispatch oncall alerts.`);
  }

  return value;
}
