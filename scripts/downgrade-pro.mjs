#!/usr/bin/env node
/**
 * finsight Pro→Free 강제 다운그레이드 (테스트용)
 *
 * Polar 구독을 즉시 revoke 하고 Supabase `subscriptions` 행을 비활성으로 갱신해
 * Pro 게이팅(status='active' AND current_period_end > now())을 떨어뜨린다.
 * 서비스롤로 RLS를 우회하며, `.env`를 자동 로드한다.
 *
 * 사용법:
 *   node scripts/downgrade-pro.mjs            # status='active'인 모든 구독을 다운그레이드
 *   node scripts/downgrade-pro.mjs <email>    # 해당 이메일 사용자만
 *   node scripts/downgrade-pro.mjs <user_id>  # 해당 uuid만
 *   node scripts/downgrade-pro.mjs --list     # 변경 없이 현재 구독 상태만 출력
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Polar } from "@polar-sh/sdk";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function findEnvFile(startDir) {
  let dir = startDir;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, ".env");
    try {
      readFileSync(candidate);
      return candidate;
    } catch {
      // 상위로 계속 탐색
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(".env를 찾지 못했습니다. finsight 프로젝트 안에서 실행하세요.");
}

function loadEnv(path) {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (k in process.env) continue; // 이미 export된 값 우선
    process.env[k] = t.slice(i + 1).trim();
  }
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} 환경변수가 필요합니다.`);
  return v;
}

// Polar의 active 구독을 customer 기준(externalId=Supabase user.id, email 폴백)으로 색인.
// DB는 user당 polar_subscription_id 1건만 추적하므로, 반복 체크아웃으로 쌓여
// '추적 밖'에 남은 활성 구독까지 한 번에 모으기 위함.
async function listActivePolarSubs(polar) {
  const byExternalId = new Map();
  const byEmail = new Map();
  const res = await polar.subscriptions.list({ limit: 100 });
  for await (const page of res) {
    const items = page.result?.items ?? page.items ?? [];
    for (const s of items) {
      if (s.status !== "active") continue;
      const cust = s.customer ?? {};
      if (cust.externalId) {
        const arr = byExternalId.get(cust.externalId) ?? [];
        arr.push(s.id);
        byExternalId.set(cust.externalId, arr);
      }
      const email = (cust.email ?? "").toLowerCase();
      if (email) {
        const arr = byEmail.get(email) ?? [];
        arr.push(s.id);
        byEmail.set(email, arr);
      }
    }
  }
  return { byExternalId, byEmail };
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  loadEnv(findEnvFile(here));

  const arg = process.argv[2];
  const listOnly = arg === "--list";
  const filter = listOnly ? undefined : arg;

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // email ↔ user_id 매핑 (표시 및 이메일 필터용)
  const { data: usersPage, error: usersErr } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (usersErr) throw usersErr;
  const emailById = new Map(usersPage.users.map((u) => [u.id, u.email ?? ""]));
  const idByEmail = new Map(
    usersPage.users.map((u) => [(u.email ?? "").toLowerCase(), u.id]),
  );

  // 대상 행 조회
  let q = supabase
    .from("subscriptions")
    .select("user_id,polar_subscription_id,status,current_period_end,event_ts");

  if (filter) {
    let targetUserId = filter;
    if (!UUID_RE.test(filter)) {
      targetUserId = idByEmail.get(filter.toLowerCase());
      if (!targetUserId) {
        console.error(`✗ 이메일 ${filter} 에 해당하는 사용자가 없습니다.`);
        process.exit(1);
      }
    }
    q = q.eq("user_id", targetUserId);
  } else if (!listOnly) {
    q = q.eq("status", "active"); // 기본: 활성 구독만
  }

  const { data: rows, error: rowsErr } = await q;
  if (rowsErr) throw rowsErr;

  if (!rows || rows.length === 0) {
    console.log(
      listOnly ? "구독 행이 없습니다." : "다운그레이드 대상(활성 Pro)이 없습니다.",
    );
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const isPro = (r) =>
    r.status === "active" &&
    r.current_period_end &&
    new Date(r.current_period_end) > now;

  console.log(`대상 ${rows.length}건:`);
  for (const r of rows) {
    console.log(
      `  • ${emailById.get(r.user_id) || r.user_id}  ` +
        `status=${r.status}  period_end=${r.current_period_end}  pro=${isPro(r) ? "YES" : "no"}`,
    );
  }

  if (listOnly) return;
  console.log("");

  const polar = new Polar({
    accessToken: requireEnv("POLAR_ACCESS_TOKEN"),
    server: process.env.POLAR_SERVER === "production" ? "production" : "sandbox",
  });

  // DB가 추적하지 못한 활성 구독(반복 체크아웃으로 누적)까지 revoke해야
  // 재결제가 Polar에서 "already active"로 막히지 않는다. 목록을 한 번만 색인.
  let activeIdx = { byExternalId: new Map(), byEmail: new Map() };
  try {
    activeIdx = await listActivePolarSubs(polar);
  } catch (e) {
    console.warn(
      `⚠ Polar 구독 목록 조회 실패: ${e?.message || e} — DB가 추적하는 구독만 revoke`,
    );
  }

  for (const r of rows) {
    const who = emailById.get(r.user_id) || r.user_id;
    const email = (emailById.get(r.user_id) || "").toLowerCase();

    // 1) Polar 즉시 취소(revoke): DB 추적분 + 추적 밖 활성 구독을 모두
    const toRevoke = new Set();
    if (r.polar_subscription_id) toRevoke.add(r.polar_subscription_id);
    for (const id of activeIdx.byExternalId.get(r.user_id) ?? []) {
      toRevoke.add(id);
    }
    if (email) {
      for (const id of activeIdx.byEmail.get(email) ?? []) toRevoke.add(id);
    }

    if (toRevoke.size === 0) {
      console.log(`• Polar: ${who} 취소할 구독 없음 (DB만 갱신)`);
    }
    for (const id of toRevoke) {
      try {
        const sub = await polar.subscriptions.revoke({ id });
        console.log(`✓ Polar revoke: ${who} ${id} → status=${sub.status}`);
      } catch (e) {
        const tag = `${e?.name} ${e?.statusCode} ${e?.message || e}`;
        if (/already.?cancel|already.?revok|\b403\b|\b410\b/i.test(tag)) {
          console.log(`• Polar: ${who} ${id} 이미 취소됨 (skip)`);
        } else {
          console.warn(
            `⚠ Polar revoke 실패(${who} ${id}): ${e?.message || e} — DB는 계속 갱신`,
          );
        }
      }
    }

    // 2) DB를 Free로 — 게이팅 두 조건을 모두 떨어뜨리고
    //    event_ts를 올려 stale 웹훅(과거 active 이벤트)의 재활성 upsert를 차단
    const { error: updErr } = await supabase
      .from("subscriptions")
      .update({
        status: "canceled",
        current_period_end: nowIso,
        event_ts: nowIso,
        updated_at: nowIso,
      })
      .eq("user_id", r.user_id);
    if (updErr) {
      console.error(`✗ DB 갱신 실패(${who}): ${updErr.message}`);
      process.exitCode = 1;
      continue;
    }
    console.log(`✓ DB: ${who} → Free (status=canceled, period_end=${nowIso})`);
  }

  // 3) 검증 — DB(게이팅) + Polar(재결제 차단 방지) 양쪽
  const { data: after, error: afterErr } = await supabase
    .from("subscriptions")
    .select("user_id,status,current_period_end")
    .in(
      "user_id",
      rows.map((r) => r.user_id),
    );
  if (afterErr) throw afterErr;

  const stillPro = (after || []).filter(isPro);

  let polarLeft = 0;
  try {
    const idx = await listActivePolarSubs(polar);
    for (const r of rows) {
      const email = (emailById.get(r.user_id) || "").toLowerCase();
      const ids = new Set([
        ...(idx.byExternalId.get(r.user_id) ?? []),
        ...(email ? (idx.byEmail.get(email) ?? []) : []),
      ]);
      polarLeft += ids.size;
    }
  } catch (e) {
    console.warn(`⚠ Polar 재검증 조회 실패: ${e?.message || e}`);
  }

  console.log("");
  if (stillPro.length === 0 && polarLeft === 0) {
    console.log("✅ 완료: DB·Polar 모두 Free 입니다.");
  } else {
    if (stillPro.length > 0) {
      console.error(`✗ 아직 Pro로 남은 DB 행: ${stillPro.length}건`);
    }
    if (polarLeft > 0) {
      console.error(`✗ 아직 Polar에 남은 active 구독: ${polarLeft}건`);
    }
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("실패:", e?.message || e);
  process.exit(1);
});
