import { HeroInsightCard, type HeroAiInsight } from "./HeroInsightCard";

export interface HeroDemoSlot {
  description: string;
  label: string;
  title: string;
}

export interface HeroProps {
  aiInsight: HeroAiInsight;
  brandName: string;
  ctaHref: string;
  ctaLabel: string;
  demoSlot: HeroDemoSlot;
  description: string;
  eyebrow?: string;
  headline: string;
  trend?: number[];
}

export function Hero({
  aiInsight,
  brandName,
  ctaHref,
  ctaLabel,
  demoSlot,
  description,
  eyebrow,
  headline,
  trend,
}: HeroProps) {
  return (
    <header
      className="ai-surface-dark overflow-hidden py-section"
      role="banner"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-10%] size-[480px] rounded-circle blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--ai-violet) 32%, transparent), transparent 70%)",
        }}
      />
      <div className="relative mx-auto grid max-w-finsight gap-xxl px-lg lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)] lg:items-center">
        <div>
          <div className="mb-xl inline-flex items-center gap-sm">
            <span
              aria-hidden="true"
              className="size-8 rounded-circle bg-primary"
            />
            <span className="nav-link !text-on-dark">{brandName}</span>
          </div>

          {eyebrow ? (
            <p className="caption-strong mb-base inline-flex items-center gap-xs rounded-action bg-surface-dark-elevated px-base py-xs !text-on-dark-soft">
              <span className="ai-text-gradient">{eyebrow}</span>
            </p>
          ) : null}

          <h1 className="font-finsight-display text-[44px] leading-none font-normal tracking-[-0.025em] break-keep !text-on-dark sm:text-[64px] lg:text-[80px]">
            {headline}
          </h1>
          <p className="body-md mt-lg max-w-[36rem] !text-on-dark-soft">
            {description}
          </p>
          <div className="mt-xl">
            <a
              className="btn-label inline-flex min-h-12 items-center justify-center rounded-action bg-primary px-lg !text-on-primary transition-colors hover:bg-primary-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              href={ctaHref}
            >
              {ctaLabel}
            </a>
          </div>
        </div>

        <div className="relative min-h-[460px]">
          <div className="absolute right-0 top-0">
            <HeroInsightCard insight={aiInsight} trend={trend} />
          </div>

          <aside className="absolute bottom-0 left-0 w-[min(82%,320px)] -rotate-2 rounded-card border border-hairline-faint bg-surface-dark-elevated p-lg shadow-float">
            <p className="caption !text-on-dark-soft">{demoSlot.label}</p>
            <h2 className="title-md mt-xs !text-on-dark">{demoSlot.title}</h2>
            <p className="body-sm mt-sm !text-on-dark-soft">
              {demoSlot.description}
            </p>
          </aside>
        </div>
      </div>
    </header>
  );
}
