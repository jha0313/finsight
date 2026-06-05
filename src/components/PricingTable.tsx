import { Check } from "lucide-react";

export interface PricingPlan {
  badge?: string;
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
          {plans.map((plan, index) => {
            const featured = index === plans.length - 1 && plans.length > 1;

            return (
              <article className={planCardClassName(featured)} key={plan.name}>
                <div className="flex items-center justify-between gap-base">
                  <p
                    className={featured ? "title-md !text-on-dark" : "title-md"}
                  >
                    {plan.name}
                  </p>
                  {plan.badge ? (
                    <span className="caption-strong inline-flex items-center rounded-action bg-canvas px-sm py-xxs text-ink">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>

                <p
                  className={
                    featured
                      ? "body-sm mt-sm !text-on-dark-soft"
                      : "body-sm mt-sm"
                  }
                >
                  {plan.description}
                </p>

                <p
                  className={
                    featured ? "num mt-lg !text-on-dark" : "num mt-lg text-ink"
                  }
                >
                  {plan.price}
                </p>

                <ul className="mt-lg space-y-sm">
                  {plan.features.map((feature) => (
                    <li
                      className={
                        featured
                          ? "body-sm flex items-start gap-sm !text-on-dark-soft"
                          : "body-sm flex items-start gap-sm"
                      }
                      key={feature}
                    >
                      <Check
                        aria-hidden="true"
                        className={
                          featured
                            ? "mt-[0.15em] shrink-0 !text-on-dark"
                            : "mt-[0.15em] shrink-0 text-ink"
                        }
                        size={16}
                        strokeWidth={2.5}
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <a className={pricingCtaClassName(featured)} href={plan.ctaHref}>
                  {plan.ctaLabel}
                </a>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function planCardClassName(featured: boolean): string {
  const base = "flex flex-col rounded-card p-xl";

  if (featured) {
    return `${base} ai-border-gradient ai-glow bg-surface-dark`;
  }

  return `${base} border border-hairline bg-canvas transition-shadow hover:shadow-card`;
}

function pricingCtaClassName(featured: boolean): string {
  const base =
    "btn-label mt-xl inline-flex min-h-12 w-full items-center justify-center rounded-action px-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

  if (featured) {
    return `${base} bg-primary !text-on-primary hover:bg-primary-active focus-visible:outline-primary`;
  }

  return `${base} bg-surface-strong !text-ink hover:bg-hairline-soft focus-visible:outline-ink`;
}
