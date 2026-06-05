"use client";

import type { ReactNode } from "react";

import { useInView } from "@/hooks/useInView";

export interface FeatureGridCardItem {
  ai?: boolean;
  description: string;
  icon?: ReactNode;
  title: string;
}

export interface FeatureGridCardsProps {
  features: FeatureGridCardItem[];
}

// 절약 인사이트 카드: ai 플래그가 있으면 우선, 없으면 제목으로 휴리스틱 감지(현재 조립 기준).
const AI_TITLE = "절약 인사이트";

const STAGGER_MS = 90;

function isAiCard(feature: FeatureGridCardItem): boolean {
  return feature.ai === true || feature.title === AI_TITLE;
}

/**
 * FeatureGrid의 카드 그리드를 담당하는 client 컴포넌트.
 * - inView 진입 시 .motion-fade-rise 로 아래→위 fade reveal(카드별 stagger).
 * - '절약 인사이트' 카드만 AI 시그니처 악센트(그라데이션 보더·글로우·아이콘 그라데이션).
 * - prefers-reduced-motion / IntersectionObserver 미지원 → 즉시 최종 상태로 노출.
 */
export function FeatureGridCards({ features }: FeatureGridCardsProps) {
  const [ref, inView] = useInView({ rootMargin: "0px 0px -10% 0px" });

  return (
    <div
      className="mt-xxl grid gap-lg md:grid-cols-2 xl:grid-cols-4"
      ref={ref}
    >
      {features.map((feature, index) => {
        const ai = isAiCard(feature);

        return (
          <article
            className={[
              "motion-fade-rise rounded-card border p-xl transition-shadow",
              ai
                ? "ai-border-gradient ai-glow border-transparent bg-surface-dark"
                : "border-hairline bg-canvas hover:shadow-card",
            ].join(" ")}
            data-inview={inView ? "true" : undefined}
            key={feature.title}
            style={{ animationDelay: `${index * STAGGER_MS}ms` }}
          >
            {/* ai-border-gradient::before(z-index:0) 위로 콘텐츠를 올리기 위한 래퍼 */}
            <div className="relative z-10">
              {feature.icon === undefined ? null : (
                <div
                  className={[
                    "mb-md flex size-11 items-center justify-center rounded-circle",
                    ai
                      ? "border border-hairline-faint bg-surface-dark-elevated text-ai-violet"
                      : "bg-surface-strong text-ink",
                  ].join(" ")}
                >
                  {feature.icon}
                </div>
              )}
              <h3 className={ai ? "title-md ai-text-gradient" : "title-md"}>
                {feature.title}
              </h3>
              <p className={ai ? "body-sm mt-sm !text-on-dark-soft" : "body-sm mt-sm"}>
                {feature.description}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
