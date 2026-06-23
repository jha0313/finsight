---
id: 03-service-role-public-env
rule: service_role 키는 웹훅 모듈에서만 쓰고 import "server-only"로 가드한다. NEXT_PUBLIC_에는 어떤 비밀키도 두지 않는다.
rule_source: CLAUDE.md > 아키텍처 규칙 (RLS·시크릿)
expect: violation
severity: critical
---

클라이언트 번들에 노출되는 NEXT_PUBLIC_ 변수로 service_role 키를 읽어 admin 클라이언트를 만든다.

```diff
// src/lib/supabase/admin-client.ts
+import { createClient } from "@supabase/supabase-js";
+
+export const adminClient = createClient(
+  process.env.NEXT_PUBLIC_SUPABASE_URL!,
+  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
+);
```
