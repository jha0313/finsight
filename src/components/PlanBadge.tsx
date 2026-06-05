import { Sparkles } from "lucide-react";

import type { Tier } from "@/types/tier";

export interface PlanBadgeProps {
  tier: Tier;
}

// Free=회색 라벨, Pro=AI 시그니처 그라데이션(AI 맥락 한정 허용).
export function PlanBadge({ tier }: PlanBadgeProps) {
  if (tier === "pro") {
    return (
      <span className="inline-flex items-center gap-xxs rounded-pill bg-surface-strong px-sm py-xxs">
        <Sparkles
          aria-hidden="true"
          className="text-ai-violet"
          size={13}
          strokeWidth={2}
        />
        <span className="caption-strong ai-text-gradient">Pro</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-pill bg-surface-strong px-sm py-xxs">
      <span className="caption-strong text-muted">Free</span>
    </span>
  );
}
