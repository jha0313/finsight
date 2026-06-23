#!/usr/bin/env node
/**
 * scripts/lh/audits.mjs — 진단용. 기존 .next-lh 빌드를 재사용해 서버를 띄우고
 * Lighthouse JSON에서 카테고리별 실패 감사 + Performance opportunity를 추출한다.
 * (빌드 안 함. measure 후 빠른 진단용.)
 *   node scripts/lh/audits.mjs            # landing
 *   node scripts/lh/audits.mjs --dashboard
 */
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

const ROOT = process.cwd();
const NEXT = path.join(ROOT, "node_modules", ".bin", "next");
const PORT = Number(process.env.LH_PORT ?? 4188);
const DIST = process.env.LH_DIST ?? ".next-lh";
const CATS = ["performance", "accessibility", "best-practices", "seo"];

const TARGETS = process.argv.includes("--dashboard")
  ? [{ name: "dashboard", path: "/dashboard" }]
  : [{ name: "landing", path: "/" }];
const DEVICES = ["mobile", "desktop"];

const startServer = () =>
  spawn(NEXT, ["start", "-p", String(PORT)], {
    env: { ...process.env, NEXT_DIST_DIR: DIST },
    stdio: ["ignore", "ignore", "ignore"],
  });

async function waitFor(url, n = 90) {
  for (let i = 0; i < n; i++) {
    try {
      const r = await fetch(url);
      if (r.status > 0) return;
    } catch {}
    await sleep(1000);
  }
  throw new Error("server not ready");
}

async function run(url, device) {
  const chrome = await launch({ chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"] });
  try {
    const res = await lighthouse(
      url,
      { port: chrome.port, onlyCategories: CATS, output: "json", logLevel: "error" },
      device === "desktop" ? desktopConfig : undefined,
    );
    return res.lhr;
  } finally {
    await chrome.kill();
  }
}

const srv = startServer();
try {
  await waitFor(`http://localhost:${PORT}/`);
  for (const t of TARGETS) {
    for (const d of DEVICES) {
      const lhr = await run(`http://localhost:${PORT}${t.path}`, d);
      console.log(`\n===== ${t.name}/${d}  (finalUrl=${lhr.finalDisplayedUrl}) =====`);
      for (const catId of ["seo", "accessibility", "best-practices"]) {
        const cat = lhr.categories[catId];
        const failing = cat.auditRefs
          .map((r) => lhr.audits[r.id])
          .filter((a) => a.score !== null && a.score < 1 && a.scoreDisplayMode !== "notApplicable");
        console.log(`  [${catId}] = ${Math.round(cat.score * 100)}`);
        for (const a of failing) {
          console.log(`    ✗ ${a.id}: ${a.title}`);
          const items = a.details?.items ?? [];
          for (const it of items.slice(0, 5)) {
            const sel = it.node?.selector ?? it.source ?? "";
            const desc = it.node?.explanation ?? it.description ?? it.node?.snippet ?? "";
            console.log(`        · ${String(sel).slice(0, 90)}  ${String(desc).slice(0, 110)}`);
          }
        }
        if (!failing.length) console.log("    ✓ (all pass)");
      }
      const perf = lhr.categories.performance;
      const opps = perf.auditRefs
        .map((r) => lhr.audits[r.id])
        .filter((a) => a.details?.type === "opportunity" && a.numericValue > 0)
        .sort((x, y) => y.numericValue - x.numericValue);
      console.log(`  [performance] = ${Math.round(perf.score * 100)} — top opportunities:`);
      for (const a of opps.slice(0, 6)) console.log(`    · ${a.id}: ~${Math.round(a.numericValue)}ms — ${a.title}`);
      if (!opps.length) console.log("    · (no opportunities)");
    }
  }
} finally {
  srv.kill("SIGTERM");
}
