// 하네스 Eval 러너 — golden set을 돌려 회귀를 잡는 게이트.
// 각 케이스: 리뷰어(Sonnet)가 코드를 리뷰 → judge(Opus)가 기대 대비 채점 → 집계.
// 하나라도 실패하면 exit 1 (CI/로컬 회귀 게이트). 키가 없으면 exit 2.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createClaudeJudge } from "./judge";
import { type GoldenCase, parseCase } from "./lib/case";
import { type CaseResult, formatSummary, summarize } from "./lib/verdict";
import { createClaudeResponder } from "./responder";
import { createClaudeReviewer } from "./reviewer";
import { createClaudeTriager } from "./triager";

export const CASES_DIR = fileURLToPath(new URL("./cases/", import.meta.url));

export function loadCases(dir: string): GoldenCase[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort()
    .map((file) => parseCase(file, readFileSync(path.join(dir, file), "utf8")));
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "✗ ANTHROPIC_API_KEY가 없습니다. .env에 키를 두거나 환경변수로 전달하세요.",
    );
    process.exit(2);
  }

  const cases = loadCases(CASES_DIR);
  const reviewer = createClaudeReviewer();
  const responder = createClaudeResponder();
  const triager = createClaudeTriager();
  const judge = createClaudeJudge();

  console.log(
    `\n하네스 Eval — CLAUDE.md 룰 준수 · golden set ${cases.length}개\n`,
  );

  const results: CaseResult[] = [];

  for (const goldenCase of cases) {
    const stage =
      goldenCase.kind === "qa"
        ? "응답 → 채점"
        : goldenCase.kind === "oncall"
          ? "분류 → 채점"
          : "리뷰 → 채점";
    process.stdout.write(`  · [${goldenCase.id}] ${stage} …`);

    const verdict =
      goldenCase.kind === "qa"
        ? await judge.judgeQa({
            question: goldenCase.input,
            must: goldenCase.must,
            mustNot: goldenCase.mustNot,
            answer: await responder.answer(goldenCase.input),
          })
        : goldenCase.kind === "oncall"
          ? await judge.judgeOncall({
              // kind==="oncall"이면 parseCase가 triage를 noise|signal로 보장한다.
              expectTriage: goldenCase.triage as "noise" | "signal",
              must: goldenCase.must,
              mustNot: goldenCase.mustNot,
              triagerOutput: await triager.triage(goldenCase.input),
            })
          : await judge.judge({
              rule: goldenCase.rule,
              expect: goldenCase.expect,
              severity: goldenCase.severity,
              reviewerOutput: await reviewer.review(goldenCase.input),
            });

    results.push({
      id: goldenCase.id,
      expect: goldenCase.expect,
      verdict: verdict.verdict,
      reasoning: verdict.reasoning,
    });

    console.log(
      `\r  ${verdict.verdict === "pass" ? "✓" : "✗"} [${goldenCase.id}]                         `,
    );
  }

  console.log(formatSummary(results));

  process.exit(summarize(results).failed > 0 ? 1 : 0);
}

// 엔트리포인트로 직접 실행될 때만 돈다(테스트가 loadCases를 import할 땐 실행 안 함).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(2);
  });
}
