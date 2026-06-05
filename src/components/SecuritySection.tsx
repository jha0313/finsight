import type { ReactNode } from "react";

export interface SecurityItem {
  description: string;
  icon?: ReactNode;
  title: string;
}

export interface SecuritySectionProps {
  description: string;
  eyebrow: string;
  items: SecurityItem[];
  title: string;
}

export function SecuritySection({
  description,
  eyebrow,
  items,
  title,
}: SecuritySectionProps) {
  return (
    <section aria-label={eyebrow} className="bg-surface-soft py-section">
      <div className="mx-auto grid max-w-finsight gap-xxl px-lg lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-start">
        <div>
          <p className="caption-strong">{eyebrow}</p>
          <h2 className="display-md mt-md">{title}</h2>
          <p className="body-md mt-base">{description}</p>
        </div>

        <div className="grid gap-lg">
          {items.map((item) => (
            <article
              className="rounded-card border border-hairline bg-canvas p-xl transition-shadow hover:shadow-card"
              key={item.title}
            >
              <div className="flex items-start gap-base">
                {item.icon === undefined ? null : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-circle bg-surface-strong text-ink">
                    {item.icon}
                  </div>
                )}
                <div>
                  <h3 className="title-md">{item.title}</h3>
                  <p className="body-sm mt-sm">{item.description}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
