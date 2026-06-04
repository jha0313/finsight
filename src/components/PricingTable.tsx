export interface PricingPlan {
  ctaHref: string;
  ctaLabel: string;
  description: string;
  features: string[];
  name: string;
  price: string;
}

export interface PricingTableProps {
  description: string;
  eyebrow: string;
  plans: PricingPlan[];
  title: string;
}

export function PricingTable({
  description,
  eyebrow,
  plans,
  title,
}: PricingTableProps) {
  return (
    <section aria-label={eyebrow} className="bg-canvas py-section">
      <div className="mx-auto max-w-finsight px-lg">
        <div className="mx-auto max-w-3xl text-center">
          <p className="caption-strong">{eyebrow}</p>
          <h2 className="display-md mt-md">{title}</h2>
          <p className="body-md mt-base">{description}</p>
        </div>

        <div className="mx-auto mt-xxl grid max-w-4xl gap-lg md:grid-cols-2">
          {plans.map((plan, index) => (
            <article
              className="rounded-card border border-hairline bg-canvas p-xl"
              key={plan.name}
            >
              <p className="title-md">{plan.name}</p>
              <p className="body-sm mt-sm">{plan.description}</p>
              <p className="num mt-lg text-ink">{plan.price}</p>

              <ul className="mt-lg space-y-sm">
                {plan.features.map((feature) => (
                  <li className="body-sm flex gap-sm" key={feature}>
                    <span
                      aria-hidden="true"
                      className="mt-[0.55em] size-1.5 rounded-circle bg-ink"
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                className={pricingCtaClassName(index)}
                href={plan.ctaHref}
              >
                {plan.ctaLabel}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function pricingCtaClassName(index: number): string {
  const base =
    "btn-label mt-xl inline-flex min-h-12 w-full items-center justify-center rounded-action px-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  if (index === 0) {
    return `${base} bg-surface-strong text-ink hover:bg-hairline-soft focus-visible:outline-ink`;
  }

  return `${base} bg-primary text-on-primary hover:bg-primary-active focus-visible:outline-primary`;
}
