export interface HeroPreviewRow {
  label: string;
  value: string;
  tone?: "neutral" | "up" | "down";
}

export interface HeroPreview {
  amount: string;
  amountLabel: string;
  delta: string;
  period: string;
  rows: HeroPreviewRow[];
  title: string;
  trend?: number[];
}

export interface HeroDemoSlot {
  description: string;
  label: string;
  title: string;
}

export interface HeroProps {
  brandName: string;
  ctaHref: string;
  ctaLabel: string;
  demoSlot: HeroDemoSlot;
  description: string;
  eyebrow?: string;
  headline: string;
  preview: HeroPreview;
}

export function Hero({
  brandName,
  ctaHref,
  ctaLabel,
  demoSlot,
  description,
  eyebrow,
  headline,
  preview,
}: HeroProps) {
  return (
    <header className="bg-surface-dark py-section" role="banner">
      <div className="mx-auto grid max-w-finsight gap-xxl px-lg lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1fr)] lg:items-center">
        <div>
          <div className="mb-xl inline-flex items-center gap-sm">
            <span
              aria-hidden="true"
              className="size-8 rounded-circle bg-primary"
            />
            <span className="nav-link !text-on-dark">{brandName}</span>
          </div>

          {eyebrow ? (
            <p className="caption-strong mb-base inline-flex items-center rounded-action bg-surface-dark-elevated px-base py-xs !text-on-dark-soft">
              {eyebrow}
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
          <article className="absolute right-0 top-0 w-[min(100%,420px)] rounded-card border border-hairline-faint bg-surface-dark-elevated p-xl shadow-float">
            <div className="flex items-start justify-between gap-base">
              <div>
                <p className="caption !text-on-dark-soft">{preview.period}</p>
                <h2 className="title-md mt-xs !text-on-dark">
                  {preview.title}
                </h2>
              </div>
              <span className="caption !text-on-dark-soft">
                {preview.amountLabel}
              </span>
            </div>

            <div className="mt-xl">
              <p className="num !text-on-dark !text-[28px]">{preview.amount}</p>
              <p className="num down mt-xs">{preview.delta}</p>
            </div>

            {preview.trend && preview.trend.length > 0 ? (
              <div
                aria-hidden="true"
                className="mt-lg flex h-14 items-end gap-1"
              >
                {preview.trend.map((height, index) => (
                  <span
                    className="block flex-1 rounded-t-[3px]"
                    key={index}
                    style={{
                      background:
                        "linear-gradient(var(--primary), color-mix(in srgb, var(--primary) 20%, transparent))",
                      height: `${height}%`,
                    }}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-xl space-y-sm">
              {preview.rows.map((row) => (
                <div
                  className="flex items-center justify-between gap-base rounded-field border border-hairline-faint bg-surface-dark px-base py-sm"
                  key={row.label}
                >
                  <span className="body-sm !text-on-dark-soft">
                    {row.label}
                  </span>
                  <span className={rowValueClassName(row.tone)}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </article>

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

function rowValueClassName(tone: HeroPreviewRow["tone"]): string {
  if (tone === "up") {
    return "num up";
  }

  if (tone === "down") {
    return "num down";
  }

  return "num !text-on-dark";
}
