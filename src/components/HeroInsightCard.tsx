"use client";

import { Sparkles } from "lucide-react";

import { useCountUp } from "@/hooks/useCountUp";
import { useInView } from "@/hooks/useInView";
import { formatMoney } from "@/lib/format";

export interface HeroAiInsight {
  amount: string;
  amountValue: number;
  caption: string;
  currency?: string;
  label: string;
  lines: string[];
}

export interface HeroInsightCardProps {
  insight: HeroAiInsight;
  trend?: number[];
}

export function HeroInsightCard({ insight, trend }: HeroInsightCardProps) {
  const [ref, inView] = useInView({ once: true, rootMargin: "-40px" });
  const count = useCountUp(insight.amountValue, { start: inView });
  const amount =
    count >= insight.amountValue
      ? insight.amount
      : formatMoney(String(Math.round(count)), insight.currency);

  return (
    <article
      className="ai-border-gradient ai-glow relative w-[min(100%,420px)] bg-surface-dark-elevated p-xl shadow-float"
      data-inview={inView ? "true" : undefined}
      ref={ref}
    >
      <div className="relative z-[1]">
        <div className="flex items-center gap-sm">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-circle bg-surface-dark">
            <Sparkles
              aria-hidden="true"
              className="text-ai-violet"
              size={18}
              strokeWidth={2}
            />
          </span>
          <span className="ai-text-gradient ai-shimmer caption-strong">
            {insight.label}
          </span>
        </div>

        <div className="mt-xl">
          <p className="caption !text-on-dark-soft">{insight.caption}</p>
          <p className="num mt-xs !text-on-dark !text-[32px]">{amount}</p>
        </div>

        <ul className="mt-lg space-y-sm">
          {insight.lines.map((line) => (
            <li className="body-sm flex gap-sm !text-on-dark-soft" key={line}>
              <span
                aria-hidden="true"
                className="mt-[0.55em] size-1.5 shrink-0 rounded-circle bg-ai-violet"
              />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {trend && trend.length > 0 ? (
          <div
            aria-hidden="true"
            className="motion-fade-rise mt-xl flex h-14 items-end gap-1"
            data-inview={inView ? "true" : undefined}
          >
            {trend.map((height, index) => (
              <span
                className="block flex-1 rounded-t-[3px]"
                key={index}
                style={{
                  background:
                    "linear-gradient(var(--ai-violet), color-mix(in srgb, var(--primary) 20%, transparent))",
                  height: `${height}%`,
                }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
