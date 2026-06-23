#!/usr/bin/env node
/**
 * finsight PostHog mock 시드 (테스트용)
 *
 * 실트래픽이 없을 때 PostHog 프로젝트에 가짜 애널리틱스 이벤트와 예외를 직접 보내,
 * 마법사가 만든 대시보드/인사이트와 Error tracking UI가 채워지는지 확인한다.
 * 앱을 띄우지 않고 posthog-node로 ingest 엔드포인트에 바로 쏜다.
 *
 * 검증되는 것: PostHog가 이벤트/예외를 수신·집계·표시하는지.
 * 검증 안 되는 것: 앱 코드(instrumentation-client.ts/onRequestError)가 실제로 쏘는지.
 *
 * 사용법:
 *   node scripts/posthog-seed.mjs              # 애널리틱스 + 예외 전부 시드
 *   node scripts/posthog-seed.mjs --events     # 애널리틱스 이벤트만
 *   node scripts/posthog-seed.mjs --errors     # 예외(Error tracking)만
 *
 * .env.local(없으면 .env)에서 NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN/HOST를 자동 로드한다.
 */
import { PostHog } from "posthog-node";

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
    break;
  } catch {
    // 다음 후보로
  }
}

const TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
if (!TOKEN || !HOST) {
  console.error(
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN / NEXT_PUBLIC_POSTHOG_HOST 가 필요합니다 (.env.local).",
  );
  process.exit(1);
}

const arg = process.argv[2];
const doEvents = !arg || arg === "--events";
const doErrors = !arg || arg === "--errors";

const DAY = 24 * 60 * 60 * 1000;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * DAY - Math.random() * DAY);

const USERS = [
  { id: "seed-user-1", email: "minji@example.com", tier: "pro" },
  { id: "seed-user-2", email: "june@example.com", tier: "free" },
  { id: "seed-user-3", email: "soyeon@example.com", tier: "pro" },
  { id: "seed-user-4", email: "daniel@example.com", tier: "free" },
  { id: "seed-user-5", email: "haru@example.com", tier: "free" },
  { id: "seed-user-6", email: "wonjae@example.com", tier: "pro" },
];

const posthog = new PostHog(TOKEN, { host: HOST, flushAt: 1, flushInterval: 0 });

function seedEvents() {
  let count = 0;
  const cap = (u, event, properties, ts) => {
    posthog.capture({ distinctId: u.id, event, properties, timestamp: ts });
    count += 1;
  };

  for (const u of USERS) {
    posthog.identify({ distinctId: u.id, properties: { email: u.email } });

    // 14일에 걸쳐 사용자별 2~5회 세션을 가짜로 생성한다.
    const sessions = 2 + Math.floor(Math.random() * 4);
    for (let s = 0; s < sessions; s++) {
      const ts = daysAgo(Math.floor(Math.random() * 14));
      cap(u, "user_signed_in", { provider: "google" }, ts);

      cap(
        u,
        "statement_uploaded",
        {
          file_type: pick(["csv", "pdf"]),
          row_count: 40 + Math.floor(Math.random() * 600),
        },
        ts,
      );

      // 업로드 중 일부는 분석 실패(퍼널 이탈)로 둔다.
      if (Math.random() < 0.18) {
        cap(
          u,
          "analysis_failed",
          { reason: pick(["network", "server", "timeout"]) },
          ts,
        );
        continue;
      }

      cap(
        u,
        "statement_analyzed",
        {
          tier: u.tier,
          model: u.tier === "pro" ? "claude-opus-4-8" : "claude-sonnet-4-6",
          transaction_count: 30 + Math.floor(Math.random() * 500),
          duration_ms: 1200 + Math.floor(Math.random() * 9000),
        },
        ts,
      );

      // Free 사용자 일부가 Pro 체크아웃 퍼널에 진입한다.
      if (u.tier === "free" && Math.random() < 0.35) {
        cap(u, "checkout_initiated", { plan: "pro" }, ts);
      }

      cap(u, "user_signed_out", {}, ts);
    }

    // Pro 사용자 일부의 구독 취소/재개.
    if (u.tier === "pro" && Math.random() < 0.5) {
      const ts = daysAgo(Math.floor(Math.random() * 7));
      cap(u, "subscription_canceled", { at_period_end: true }, ts);
      if (Math.random() < 0.5) cap(u, "subscription_resumed", {}, ts);
    }
  }
  return count;
}

// 서로 다른 스택을 갖게 하려고 각 예외를 별도 함수에서 던진다 → Error tracking이 개별 이슈로 묶는다.
function throwParseError() {
  throw new Error("CSV 파싱 실패: 통화 기호 정규화 불가 ('₩1,234.50')");
}
function throwAmountTypeError() {
  const row = undefined;
  return row.amount; // TypeError: Cannot read properties of undefined
}
function throwClaudeTimeout() {
  throw new Error("Anthropic API timeout after 30000ms (model=claude-opus-4-8)");
}
function throwQuotaError() {
  const e = new Error("AI 일일 quota 초과 (tier=free)");
  e.name = "QuotaExceededError";
  throw e;
}
function throwAnalyzeError() {
  throw new Error("분석 요청을 처리하지 못했습니다.");
}

function seedErrors() {
  const throwers = [
    throwParseError,
    throwAmountTypeError,
    throwClaudeTimeout,
    throwQuotaError,
    throwAnalyzeError,
  ];
  let count = 0;
  // 각 이슈를 여러 사용자에게서 1~3회 재발생시켜 "발생 횟수/영향 사용자"가 보이게 한다.
  for (const thrower of throwers) {
    const hits = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < hits; i++) {
      const u = pick(USERS);
      try {
        thrower();
      } catch (err) {
        posthog.captureException(err, u.id, {
          tier: u.tier,
          source: "posthog-seed",
        });
        count += 1;
      }
    }
  }
  return count;
}

const events = doEvents ? seedEvents() : 0;
const errors = doErrors ? seedErrors() : 0;

await posthog.shutdown(); // 남은 이벤트 flush 보장

console.log(
  `✅ PostHog로 전송 완료 — 애널리틱스 이벤트 ${events}개, 예외 ${errors}개`,
);
console.log(`   host: ${HOST}`);
console.log(
  "   확인: PostHog → Activity(이벤트), Error tracking(예외), 마법사 대시보드(집계는 수 분 지연될 수 있음)",
);
