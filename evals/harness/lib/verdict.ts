// judge가 케이스별로 낸 pass/fail을 집계해 회귀 게이트 판정과 콘솔 리포트를 만든다.

export interface CaseResult {
  id: string;
  expect: "violation" | "pass";
  verdict: "pass" | "fail";
  reasoning: string;
}

export interface EvalSummary {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  failedIds: string[];
}

export function summarize(results: CaseResult[]): EvalSummary {
  const total = results.length;
  const passed = results.filter((result) => result.verdict === "pass").length;
  const failed = total - passed;

  return {
    total,
    passed,
    failed,
    passRate: total === 0 ? 0 : passed / total,
    failedIds: results
      .filter((result) => result.verdict === "fail")
      .map((result) => result.id),
  };
}

export function formatSummary(results: CaseResult[]): string {
  const summary = summarize(results);
  const lines: string[] = ["", "─".repeat(60)];

  for (const result of results) {
    lines.push(
      `${result.verdict === "pass" ? "✓ PASS" : "✗ FAIL"}  ${result.id}`,
    );

    if (result.verdict === "fail") {
      lines.push(`        ↳ ${result.reasoning}`);
    }
  }

  lines.push("─".repeat(60));
  lines.push(
    `결과: ${summary.passed}/${summary.total} 통과 (${Math.round(
      summary.passRate * 100,
    )}%)` +
      (summary.failed > 0
        ? ` · 회귀 ${summary.failed}건: ${summary.failedIds.join(", ")}`
        : " · 회귀 없음"),
  );
  lines.push("");

  return lines.join("\n");
}
