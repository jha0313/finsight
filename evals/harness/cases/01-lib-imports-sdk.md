---
id: 01-lib-imports-sdk
rule: 레이어 의존성은 단방향이다. lib/는 services/와 외부 SDK(@anthropic-ai/sdk 등)를 import하면 안 된다. lib는 types/의 포트 인터페이스에만 의존하고 실제 어댑터는 route handler에서 주입한다.
rule_source: CLAUDE.md > 아키텍처 규칙 (레이어 의존성)
expect: violation
severity: critical
---

새 분석 유틸이 lib/ 안에서 Anthropic SDK를 직접 생성·호출한다.

```diff
// src/lib/analysis/summarize.ts
+import Anthropic from "@anthropic-ai/sdk";
+
+import type { Transaction } from "@/types/transaction";
+
+export async function summarize(transactions: Transaction[]): Promise<string> {
+  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
+  const message = await client.messages.create({
+    model: "claude-sonnet-4-6",
+    max_tokens: 1024,
+    messages: [{ role: "user", content: JSON.stringify(transactions) }],
+  });
+  return message.content[0].type === "text" ? message.content[0].text : "";
+}
```
