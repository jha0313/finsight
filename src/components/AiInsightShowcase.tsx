"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useInView } from "@/hooks/useInView";
import { nextCarouselIndex } from "@/lib/animation";
import type { InsightTab } from "@/lib/landing-insights";

export interface AiInsightShowcaseProps {
  tabs: InsightTab[];
  csvPreview: string[][];
  eyebrow: string;
  title: string;
  description: string;
}

const AUTO_CYCLE_MS = 4200;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AiInsightShowcase({
  tabs,
  csvPreview,
  eyebrow,
  title,
  description,
}: AiInsightShowcaseProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sectionRef, inView] = useInView({ rootMargin: "-10% 0px" });

  // 활성 인덱스가 탭 수를 벗어나지 않도록 방어(탭 props 변동 대비).
  const activeIndex = tabs.length === 0 ? 0 : active % tabs.length;
  const activeTab = tabs[activeIndex];

  const advance = useCallback(() => {
    setActive((current) => nextCarouselIndex(current, tabs.length));
  }, [tabs.length]);

  // 자동 순환: inView이고, 일시정지가 아니며, reduced-motion이 아닐 때만.
  useEffect(() => {
    if (!inView || paused || tabs.length <= 1 || prefersReducedMotion()) {
      return;
    }

    const timer = setInterval(advance, AUTO_CYCLE_MS);
    return () => clearInterval(timer);
  }, [inView, paused, tabs.length, advance]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current) => nextCarouselIndex(current, tabs.length));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) =>
        tabs.length === 0 ? 0 : (current - 1 + tabs.length) % tabs.length,
      );
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(tabs.length === 0 ? 0 : tabs.length - 1);
    }
  }

  return (
    <section
      aria-label={title}
      className="ai-surface-dark py-section"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      ref={sectionRef}
    >
      <div
        className="motion-fade-rise mx-auto max-w-finsight px-lg"
        data-inview={inView ? "true" : undefined}
      >
        <div className="mx-auto max-w-[42rem] text-center">
          <p className="caption-strong mb-base inline-flex items-center gap-xs rounded-action bg-surface-dark-elevated px-base py-xs !text-on-dark-soft">
            <Sparkles
              aria-hidden="true"
              className="text-ai-violet"
              size={14}
              strokeWidth={2}
            />
            {eyebrow}
          </p>
          <h2 className="display-md !text-on-dark">{title}</h2>
          <p className="body-md mx-auto mt-base max-w-[36rem] !text-on-dark-soft">
            {description}
          </p>
        </div>

        <div className="mt-xxl grid items-center gap-lg lg:grid-cols-[minmax(0,0.9fr)_auto_minmax(0,1.1fr)]">
          <CsvPreview rows={csvPreview} />

          <div
            aria-hidden="true"
            className="flex items-center justify-center"
          >
            <span className="ai-glow flex size-11 items-center justify-center rounded-circle bg-surface-dark-elevated">
              <ArrowRight
                className="text-ai-violet lg:hidden"
                size={20}
                strokeWidth={2}
              />
              <ArrowRight
                className="hidden text-ai-violet lg:block lg:rotate-90"
                size={20}
                strokeWidth={2}
              />
            </span>
          </div>

          <InsightCard
            activeIndex={activeIndex}
            onSelect={setActive}
            onTabKeyDown={handleTabKeyDown}
            tab={activeTab}
            tabs={tabs}
          />
        </div>
      </div>
    </section>
  );
}

function CsvPreview({ rows }: { rows: string[][] }) {
  if (rows.length === 0) {
    return null;
  }

  const [header, ...body] = rows;

  return (
    <figure className="rounded-card border border-hairline-faint bg-surface-dark-elevated p-lg">
      <figcaption className="caption mb-sm font-finsight-mono !text-on-dark-soft">
        raw_statement.csv
      </figcaption>
      <div className="overflow-hidden opacity-70 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {header.map((cell, index) => (
                <th
                  className="border-b border-hairline-faint px-xs py-xxs text-left font-finsight-mono text-[11px] font-medium !text-on-dark-soft"
                  key={index}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    className="px-xs py-xxs font-finsight-mono text-[11px] !text-on-dark-soft"
                    key={cellIndex}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

function InsightCard({
  activeIndex,
  onSelect,
  onTabKeyDown,
  tab,
  tabs,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
  onTabKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  tab: InsightTab | undefined;
  tabs: InsightTab[];
}) {
  if (tab === undefined) {
    return null;
  }

  return (
    <div className="ai-border-gradient ai-glow rounded-card bg-surface-dark-elevated">
      <div className="relative z-[1] p-xl">
        <div className="flex items-center gap-xs">
          <Sparkles
            aria-hidden="true"
            className="text-ai-violet"
            size={18}
            strokeWidth={2}
          />
          <p className="title-sm !text-on-dark">AI가 정리한 인사이트</p>
        </div>

        <div
          aria-label="인사이트 종류"
          className="mt-base flex flex-wrap gap-xs"
          role="tablist"
        >
          {tabs.map((item, index) => {
            const selected = index === activeIndex;
            return (
              <button
                aria-controls="ai-insight-panel"
                aria-selected={selected}
                className={
                  selected
                    ? "btn-label rounded-action bg-primary px-base py-xs text-[13px] !text-on-primary"
                    : "btn-label rounded-action border border-hairline-faint px-base py-xs text-[13px] !text-on-dark-soft transition-colors hover:border-ai-violet"
                }
                id={`ai-insight-tab-${item.key}`}
                key={item.key}
                onClick={() => onSelect(index)}
                onKeyDown={onTabKeyDown}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          aria-labelledby={`ai-insight-tab-${tab.key}`}
          className="mt-xl"
          id="ai-insight-panel"
          role="tabpanel"
        >
          <p className="caption !text-on-dark-soft">{tab.caption}</p>
          <p className="ai-text-gradient num mt-xs !text-[40px] !font-finsight-mono">
            {tab.headlineNumber}
          </p>
          <p className="body-md mt-base !text-on-dark-soft">{tab.insight}</p>
        </div>
      </div>
    </div>
  );
}
