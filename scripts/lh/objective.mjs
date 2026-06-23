#!/usr/bin/env node
/**
 * scripts/lh/objective.mjs
 * keep-or-revert 판정. 후보 scores.json 을 baseline.json 과 비교한다.
 *
 * 규칙(리포트의 목적함수와 일치):
 *   objective = Σ(가중 카테고리 점수) / N_cells   (cell = target × device × category)
 *   KEEP  ⇐ objective 상승 AND 모든 cell 이 baseline - ε 이상 (ε=1pt)
 *   REVERT ⇐ 그 외
 *
 * 사용: node scripts/lh/objective.mjs <baseline.json> <candidate.json>
 *   exit 0 = KEEP, exit 1 = REVERT
 */
import fs from "node:fs";

const EPS = Number(process.env.LH_EPS ?? 1);
const WEIGHTS = { performance: 1, accessibility: 1, bestPractices: 1, seo: 1 };
const CATS = Object.keys(WEIGHTS);

const load = (p) => JSON.parse(fs.readFileSync(p, "utf8")).results;
const key = (r) => `${r.target}/${r.device}`;

export function cells(results) {
  const out = {};
  for (const r of results) {
    if (r.error) continue;
    for (const c of CATS) if (r[c] != null) out[`${key(r)}/${c}`] = r[c];
  }
  return out;
}

export function objective(results) {
  let sum = 0,
    n = 0;
  for (const r of results) {
    if (r.error) continue;
    for (const c of CATS) {
      if (r[c] == null) continue;
      sum += WEIGHTS[c] * r[c];
      n += 1;
    }
  }
  return n ? sum / n : 0;
}

export function decide(baseline, candidate) {
  const base = cells(baseline);
  const cand = cells(candidate);
  const regressions = [];
  const improvements = [];
  for (const k of Object.keys(base)) {
    if (!(k in cand)) {
      regressions.push({ cell: k, from: base[k], to: null, note: "missing in candidate" });
      continue;
    }
    const d = cand[k] - base[k];
    if (d < -EPS) regressions.push({ cell: k, from: base[k], to: cand[k], delta: d });
    else if (d > 0) improvements.push({ cell: k, from: base[k], to: cand[k], delta: d });
  }
  const objBase = objective(baseline);
  const objCand = objective(candidate);
  const keep = regressions.length === 0 && objCand > objBase;
  return { keep, objBase: +objBase.toFixed(2), objCand: +objCand.toFixed(2), regressions, improvements };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , basePath, candPath] = process.argv;
  if (!basePath || !candPath) {
    console.error("usage: node scripts/lh/objective.mjs <baseline.json> <candidate.json>");
    process.exit(2);
  }
  const r = decide(load(basePath), load(candPath));
  console.log(`objective: ${r.objBase} → ${r.objCand}  (Δ ${(r.objCand - r.objBase).toFixed(2)})`);
  if (r.improvements.length) {
    console.log("improvements:");
    for (const i of r.improvements) console.log(`  + ${i.cell}: ${i.from}→${i.to} (+${i.delta})`);
  }
  if (r.regressions.length) {
    console.log("regressions:");
    for (const i of r.regressions) console.log(`  - ${i.cell}: ${i.from}→${i.to} (${i.delta ?? "n/a"})`);
  }
  console.log(r.keep ? "VERDICT: KEEP ✓" : "VERDICT: REVERT ✗");
  process.exit(r.keep ? 0 : 1);
}
