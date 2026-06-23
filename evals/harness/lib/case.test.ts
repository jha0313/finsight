import { describe, expect, it } from "vitest";

import { parseCase } from "./case";

const SAMPLE = `---
id: 01-sample
rule: lib는 외부 SDK를 import하면 안 된다
rule_source: CLAUDE.md > 아키텍처 규칙
expect: violation
severity: critical
---

설명 한 줄.

\`\`\`diff
+import Anthropic from "@anthropic-ai/sdk";
\`\`\`
`;

describe("parseCase", () => {
  it("frontmatter 라벨과 본문 입력을 분리한다", () => {
    const result = parseCase("01-sample.md", SAMPLE);

    expect(result.id).toBe("01-sample");
    expect(result.rule).toBe("lib는 외부 SDK를 import하면 안 된다");
    expect(result.ruleSource).toBe("CLAUDE.md > 아키텍처 규칙");
    expect(result.expect).toBe("violation");
    expect(result.severity).toBe("critical");
    expect(result.input).toContain("import Anthropic");
    expect(result.input).toContain("설명 한 줄.");
    expect(result.input.startsWith("---")).toBe(false);
  });

  it("값의 양끝 따옴표를 제거한다", () => {
    const raw = `---
id: q
rule: "따옴표로 감싼 룰"
expect: pass
---
body`;

    expect(parseCase("q.md", raw).rule).toBe("따옴표로 감싼 룰");
  });

  it("rule_source/severity가 없으면 기본값을 채운다", () => {
    const raw = `---
id: minimal
rule: 최소 룰
expect: pass
---
body`;
    const result = parseCase("minimal.md", raw);

    expect(result.ruleSource).toBe("");
    expect(result.severity).toBe("none");
  });

  it("frontmatter가 없으면 throw한다", () => {
    expect(() => parseCase("bad.md", "no frontmatter here")).toThrow(
      /frontmatter/,
    );
  });

  it("expect가 violation/pass가 아니면 throw한다", () => {
    const raw = `---
id: bad
rule: r
expect: maybe
---
body`;

    expect(() => parseCase("bad.md", raw)).toThrow(/expect/);
  });

  it("id가 없으면 throw한다", () => {
    const raw = `---
rule: r
expect: pass
---
body`;

    expect(() => parseCase("noid.md", raw)).toThrow(/id/);
  });

  it("kind를 안 적으면 review로 기본 처리한다", () => {
    expect(parseCase("01-sample.md", SAMPLE).kind).toBe("review");
  });

  it("qa 케이스는 본문(질문)과 must/mustNot 리스트를 분리한다", () => {
    const raw = `---
id: q01
kind: qa
must: 사실 A; 사실 B
must_not: 오답 X
rule_source: CLAUDE.md > 어딘가
---

질문 본문입니다.`;
    const result = parseCase("q01.md", raw);

    expect(result.kind).toBe("qa");
    expect(result.must).toEqual(["사실 A", "사실 B"]);
    expect(result.mustNot).toEqual(["오답 X"]);
    expect(result.input).toBe("질문 본문입니다.");
  });

  it("qa 케이스에 must가 없으면 throw한다", () => {
    const raw = `---
id: q
kind: qa
---
body`;

    expect(() => parseCase("q.md", raw)).toThrow(/must/);
  });

  it("oncall 케이스는 triage 라벨과 must/mustNot을 분리한다", () => {
    const raw = `---
id: t01
kind: oncall
triage: signal
must: 신호로 분류; 권장 다음 액션
must_not: 노이즈로 분류
rule_source: oncall/references/triage-rubric.md
---

prod alert 본문`;
    const result = parseCase("t01.md", raw);

    expect(result.kind).toBe("oncall");
    expect(result.triage).toBe("signal");
    expect(result.must).toEqual(["신호로 분류", "권장 다음 액션"]);
    expect(result.mustNot).toEqual(["노이즈로 분류"]);
    expect(result.input).toBe("prod alert 본문");
  });

  it("oncall 케이스의 triage가 noise/signal이 아니면 throw한다", () => {
    const raw = `---
id: t
kind: oncall
triage: maybe
must: x
---
body`;

    expect(() => parseCase("t.md", raw)).toThrow(/triage/);
  });

  it("oncall 케이스에 must가 없으면 throw한다", () => {
    const raw = `---
id: t
kind: oncall
triage: noise
---
body`;

    expect(() => parseCase("t.md", raw)).toThrow(/must/);
  });
});
