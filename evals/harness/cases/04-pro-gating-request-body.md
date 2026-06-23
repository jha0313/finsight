---
id: 04-pro-gating-request-body
rule: Pro 게이팅은 서버측 DB 구독상태(status active AND current_period_end > now())로만 판정한다. 요청 본문/헤더의 tier를 신뢰하지 않는다.
rule_source: CLAUDE.md > 아키텍처 규칙 (Pro 게이팅)
expect: violation
severity: critical
---

/api/analyze가 DB 구독 조회 대신 요청 본문의 tier 값으로 Pro 여부를 판정한다.

```diff
// src/app/api/analyze/route.ts
 export async function POST(request: Request) {
-  const subscription = await getSubscription(user.id);
-  const isPro =
-    subscription?.status === "active" &&
-    subscription.currentPeriodEnd > new Date();
+  const body = await request.json();
+  const isPro = body.tier === "pro";
   const insights = isPro
     ? await runOpus(transactions)
     : await runSonnet(transactions);
   return Response.json({ insights });
 }
```
