#!/usr/bin/env node
/**
 * scripts/lh/measure.mjs
 * 격리 distDir(.next-lh)로 build → next start(격리 port) → Lighthouse 매트릭스
 * (페이지 × 기기, median-of-3) → scores.json + reports/<target>-<device>.html
 *
 * 대시보드(/dashboard)는 인증이 필요하므로, 이 스크립트를 부르기 전에
 * scripts/lh/run.sh 가 부록 F-1 미들웨어 우회를 임시 적용한 상태에서 build 한다.
 *
 * 사용:
 *   node scripts/lh/measure.mjs                 # 전체 매트릭스, build 포함
 *   node scripts/lh/measure.mjs --no-build      # 기존 .next-lh 재사용
 *   node scripts/lh/measure.mjs --only=landing  # 한 페이지만
 *   LH_RUNS=1 node scripts/lh/measure.mjs       # 빠른 스모크(중앙값 없이)
 */
import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";
import { spawn, execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import path from "node:path";

const ROOT = process.cwd();
const NEXT = path.join(ROOT, "node_modules", ".bin", "next");
const OUTDIR = path.join(ROOT, "scripts", "lh");
const REPORTS = path.join(OUTDIR, "reports");

const PORT = Number(process.env.LH_PORT ?? 4187);
const DIST = process.env.LH_DIST ?? ".next-lh";
const RUNS = Number(process.env.LH_RUNS ?? 3);

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const TARGETS = [
  { name: "landing", path: "/" },
  { name: "dashboard", path: "/dashboard" },
];
const DEVICES = ["mobile", "desktop"];

const argv = process.argv.slice(2);
const SKIP_BUILD = argv.includes("--no-build");
const ONLY = argv.find((a) => a.startsWith("--only="))?.split("=")[1];

const log = (...a) => console.log("[lh]", ...a);

function build() {
  log(`build (distDir=${DIST}) ...`);
  execSync(`"${NEXT}" build`, {
    stdio: "inherit",
    env: { ...process.env, NEXT_DIST_DIR: DIST },
  });
}

function startServer() {
  log(`next start -p ${PORT} (distDir=${DIST}) ...`);
  return spawn(NEXT, ["start", "-p", String(PORT)], {
    env: { ...process.env, NEXT_DIST_DIR: DIST },
    stdio: ["ignore", "ignore", "ignore"],
  });
}

async function waitForServer(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status > 0) return true;
    } catch {
      /* not ready */
    }
    await sleep(1000);
  }
  throw new Error("server not ready: " + url);
}

async function runLH(url, device) {
  const chrome = await launch({
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const flags = {
      port: chrome.port,
      onlyCategories: CATEGORIES,
      output: ["json", "html"],
      logLevel: "error",
    };
    const config = device === "desktop" ? desktopConfig : undefined;
    return await lighthouse(url, flags, config);
  } finally {
    await chrome.kill();
  }
}

async function measureTarget(t, device) {
  const url = `http://localhost:${PORT}${t.path}`;
  const ok = [];
  for (let i = 0; i < RUNS; i++) {
    log(`  ${t.name}/${device} run ${i + 1}/${RUNS}`);
    try {
      const { lhr, report } = await runLH(url, device);
      const c = lhr.categories;
      const a = lhr.audits;
      const s = (k) => (c[k]?.score != null ? Math.round(c[k].score * 100) : null);
      const ms = (k) => (a[k]?.numericValue != null ? Math.round(a[k].numericValue) : null);
      ok.push({
        performance: s("performance"),
        accessibility: s("accessibility"),
        bestPractices: s("best-practices"),
        seo: s("seo"),
        metrics: {
          lcp: ms("largest-contentful-paint"),
          tbt: ms("total-blocking-time"),
          cls: a["cumulative-layout-shift"]?.numericValue ?? null,
          fcp: ms("first-contentful-paint"),
          si: ms("speed-index"),
        },
        finalUrl: lhr.finalDisplayedUrl,
        html: report[1],
      });
    } catch (e) {
      log(`  ! ${t.name}/${device} run ${i + 1} failed: ${e.message}`);
    }
  }
  if (!ok.length) return { target: t.name, device, error: "all runs failed", performance: null };
  const sorted = [...ok].sort((x, y) => x.performance - y.performance);
  const med = sorted[Math.floor(sorted.length / 2)];
  mkdirSync(REPORTS, { recursive: true });
  writeFileSync(path.join(REPORTS, `${t.name}-${device}.html`), med.html);
  delete med.html;
  return {
    target: t.name,
    device,
    runsOk: ok.length,
    perfRuns: ok.map((r) => r.performance),
    ...med,
  };
}

async function main() {
  if (!SKIP_BUILD) build();
  const srv = startServer();
  const results = [];
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    log("server ready");
    const targets = ONLY ? TARGETS.filter((t) => t.name === ONLY) : TARGETS;
    for (const t of targets) {
      for (const d of DEVICES) {
        results.push(await measureTarget(t, d));
      }
    }
  } finally {
    srv.kill("SIGTERM");
  }
  const out = { generatedAt: new Date().toISOString(), port: PORT, dist: DIST, runs: RUNS, results };
  writeFileSync(path.join(OUTDIR, "scores.json"), JSON.stringify(out, null, 2));
  log("=== SUMMARY ===");
  for (const r of results) {
    if (r.error) {
      log(`${r.target}/${r.device}: ERROR ${r.error}`);
      continue;
    }
    const warn = r.finalUrl && !r.finalUrl.includes(TARGETS.find((t) => t.name === r.target).path)
      ? `  ⚠ finalUrl=${r.finalUrl}` : "";
    log(
      `${r.target}/${r.device}: P=${r.performance} A=${r.accessibility} BP=${r.bestPractices} SEO=${r.seo}` +
        ` | LCP=${r.metrics.lcp}ms TBT=${r.metrics.tbt}ms CLS=${r.metrics.cls} FCP=${r.metrics.fcp}ms${warn}`,
    );
  }
  log(`wrote ${path.relative(ROOT, path.join(OUTDIR, "scores.json"))}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
