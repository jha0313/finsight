// golden 케이스(.md)의 frontmatter(라벨)와 본문(입력)을 분리해 읽는다.
// 라벨이 '정답'이고 본문이 subject에게 줄 입력이다. 의존성 없이 최소 파서만 둔다.
// kind=review: 본문=코드, 리뷰어가 위반을 잡는지 채점(expect/severity/rule).
// kind=qa: 본문=질문, 응답자가 코드베이스 사실을 맞히는지 채점(must/mustNot).

export type CaseKind = "review" | "qa" | "oncall";

export interface GoldenCase {
  id: string;
  kind: CaseKind;
  rule: string;
  ruleSource: string;
  expect: "violation" | "pass";
  severity: string;
  triage: "noise" | "signal" | "none"; // oncall: 기대 판정(노이즈/신호)
  must: string[]; // qa/oncall: 답변/escalation에 반드시 담겨야 할 사실
  mustNot: string[]; // qa/oncall: 사실처럼 말하면 안 되는 오답
  input: string;
}

export function parseCase(filename: string, raw: string): GoldenCase {
  const text = raw.replace(/\r\n/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);

  if (match === null) {
    throw new Error(`${filename}: frontmatter(--- ... ---)를 찾을 수 없습니다.`);
  }

  const [, front, body] = match;
  const meta: Record<string, string> = {};

  for (const line of front.split("\n")) {
    if (line.trim() === "") {
      continue;
    }

    const idx = line.indexOf(":");

    if (idx === -1) {
      continue;
    }

    meta[line.slice(0, idx).trim()] = stripQuotes(line.slice(idx + 1).trim());
  }

  const kind = meta.kind ?? "review";

  if (kind !== "review" && kind !== "qa" && kind !== "oncall") {
    throw new Error(
      `${filename}: kind는 "review"·"qa"·"oncall" 중 하나여야 합니다 (받음: ${kind}).`,
    );
  }

  if (!meta.id) {
    throw new Error(`${filename}: id가 없습니다.`);
  }

  if (kind === "oncall") {
    const triage = meta.triage;

    if (triage !== "noise" && triage !== "signal") {
      throw new Error(
        `${filename}: oncall 케이스의 triage는 "noise" 또는 "signal"여야 합니다 (받음: ${triage ?? "없음"}).`,
      );
    }

    const must = splitList(meta.must);

    if (must.length === 0) {
      throw new Error(
        `${filename}: oncall 케이스는 must(판정/escalation 요건)가 필요합니다.`,
      );
    }

    return {
      id: meta.id,
      kind,
      rule: meta.rule ?? "",
      ruleSource: meta.rule_source ?? "",
      expect: "pass", // oncall은 expect를 쓰지 않는다(run은 kind로 분기). 인터페이스 충족용.
      severity: "none",
      triage,
      must,
      mustNot: splitList(meta.must_not),
      input: body.trim(),
    };
  }

  if (kind === "qa") {
    const must = splitList(meta.must);

    if (must.length === 0) {
      throw new Error(`${filename}: qa 케이스는 must(기대 사실)가 필요합니다.`);
    }

    return {
      id: meta.id,
      kind,
      rule: meta.rule ?? "",
      ruleSource: meta.rule_source ?? "",
      expect: "pass", // qa는 expect를 쓰지 않는다(run은 kind로 분기). 인터페이스 충족용.
      severity: "none",
      triage: "none",
      must,
      mustNot: splitList(meta.must_not),
      input: body.trim(),
    };
  }

  const expect = meta.expect;

  if (expect !== "violation" && expect !== "pass") {
    throw new Error(
      `${filename}: expect는 "violation" 또는 "pass"여야 합니다 (받음: ${expect ?? "없음"}).`,
    );
  }

  if (!meta.rule) {
    throw new Error(`${filename}: rule이 없습니다.`);
  }

  return {
    id: meta.id,
    kind,
    rule: meta.rule,
    ruleSource: meta.rule_source ?? "",
    expect,
    severity: meta.severity ?? "none",
    triage: "none",
    must: [],
    mustNot: [],
    input: body.trim(),
  };
}

function splitList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(";")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function stripQuotes(value: string): string {
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));

  return quoted && value.length >= 2 ? value.slice(1, -1) : value;
}
