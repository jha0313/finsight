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

  for (const r of rows) {
    const who = emailById.get(r.user_id) || r.user_id;

    // 1) Polar 즉시 취소(revoke)
    if (r.polar_subscription_id) {
      try {
        const sub = await polar.subscriptions.revoke({
          id: r.polar_subscription_id,
        });
        console.log(`✓ Polar revoke: ${who} → status=${sub.status}`);
      } catch (e) {
        const tag = `${e?.name} ${e?.statusCode} ${e?.message || e}`;
        if (/already.?cancel|already.?revok|\b403\b|\b410\b/i.test(tag)) {
          console.log(`• Polar: ${who} 이미 취소됨 (skip)`);
        } else {
          console.warn(
            `⚠ Polar revoke 실패(${who}): ${e?.message || e} — DB는 계속 갱신`,
          );
        }
      }
    } else {
      console.log(`• Polar: ${who} polar_subscription_id 없음 (DB만 갱신)`);
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

  // 3) 검증
  const { data: after, error: afterErr } = await supabase
    .from("subscriptions")
    .select("user_id,status,current_period_end")
    .in(
      "user_id",
      rows.map((r) => r.user_id),
    );
  if (afterErr) throw afterErr;

  const stillPro = (after || []).filter(isPro);
  console.log("");
  if (stillPro.length === 0) {
    console.log("✅ 완료: 모든 대상이 Free 입니다.");
  } else {
    console.error(`✗ 아직 Pro로 남은 행: ${stillPro.length}건`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("실패:", e?.message || e);
  process.exit(1);
});
