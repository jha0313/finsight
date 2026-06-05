export interface CtaBandProps {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  title: string;
}

export function CtaBand({
  ctaHref,
  ctaLabel,
  description,
  title,
}: CtaBandProps) {
  return (
    <section
      aria-label={title}
      className="relative overflow-hidden bg-surface-dark py-section"
    >
      <span
        aria-hidden="true"
        className="ai-shimmer pointer-events-none absolute left-1/2 top-1/3 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-circle opacity-30 blur-[120px]"
      />
      <div className="relative mx-auto max-w-finsight px-lg text-center">
        <h2 className="display-md !text-on-dark">{title}</h2>
        <p className="body-md mx-auto mt-base max-w-[34rem] !text-on-dark-soft">
          {description}
        </p>
        <div className="mt-xl flex justify-center">
          <a
            className="btn-label inline-flex min-h-12 items-center justify-center rounded-action bg-primary px-lg !text-on-primary transition-colors hover:bg-primary-active focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            href={ctaHref}
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}
