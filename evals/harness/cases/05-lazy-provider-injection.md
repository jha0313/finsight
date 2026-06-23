---
id: 05-lazy-provider-injection
rule: (오탐 방지) lib는 포트 인터페이스(types/)에만 의존하고 외부 SDK를 import하지 않는다. 실제 어댑터는 주입된 factory로 호출 시점에 지연 생성한다.
rule_source: CLAUDE.md > 아키텍처 규칙 (레이어 의존성·지연 생성) — 정상 코드
expect: pass
severity: none
---

lib/orchestration이 InsightProvider를 직접 만들지 않고, 주입받은 factory로 호출 시점에 지연 생성한다. 외부 결합을 다루는 것처럼 보이지만 SDK import 없이 포트 인터페이스에만 의존하므로 정상이다. (실제 레포 패턴)

```ts
// src/lib/orchestration/insight-provider.ts
import type { InsightProvider } from "@/types/ports";

function createLazyInsightProvider(
  insightProviderFactory: () => InsightProvider,
): InsightProvider {
  let provider: InsightProvider | null = null;

  return {
    generate(input) {
      provider ??= insightProviderFactory();

      return provider.generate(input);
    },
  };
}
```
