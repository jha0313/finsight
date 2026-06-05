import type { ReactNode } from "react";

export interface FeatureGridItem {
  description: string;
  icon?: ReactNode;
  title: string;
}

export interface FeatureGridDemoSlotContent {
  description: string;
  label: string;
  title: string;
}

export interface FeatureGridProps {
  demoSlot: FeatureGridDemoSlotContent | ReactNode;
  description: string;
  eyebrow: string;
  features: FeatureGridItem[];
  title: string;
}

export function FeatureGrid({
  demoSlot,
  description,
  eyebrow,
  features,
  title,
}: FeatureGridProps) {
  return (
    <section aria-label={eyebrow} className="bg-canvas py-section">
      <div className="mx-auto max-w-finsight px-lg">
        <div className="max-w-3xl">
          <p className="caption-strong">{eyebrow}</p>
          <h2 className="display-md mt-md">{title}</h2>
          <p className="body-md mt-base">{description}</p>
        </div>

        <div className="mt-xxl grid gap-lg md:grid-cols-2 xl:grid-cols-4">
          {features.map((feature) => (
            <article
              className="rounded-card border border-hairline bg-canvas p-xl transition-shadow hover:shadow-card"
              key={feature.title}
            >
              {feature.icon === undefined ? null : (
                <div className="mb-md flex size-11 items-center justify-center rounded-circle bg-surface-strong text-ink">
                  {feature.icon}
                </div>
              )}
              <h3 className="title-md">{feature.title}</h3>
              <p className="body-sm mt-sm">{feature.description}</p>
            </article>
          ))}
        </div>

        {isDemoSlotContent(demoSlot) ? (
          <aside className="mt-lg rounded-card border border-hairline bg-surface-soft p-xl">
            <p className="caption-strong">{demoSlot.label}</p>
            <h3 className="title-lg mt-sm">{demoSlot.title}</h3>
            <p className="body-md mt-sm">{demoSlot.description}</p>
          </aside>
        ) : (
          demoSlot
        )}
      </div>
    </section>
  );
}

function isDemoSlotContent(
  demoSlot: FeatureGridProps["demoSlot"],
): demoSlot is FeatureGridDemoSlotContent {
  return (
    typeof demoSlot === "object" &&
    demoSlot !== null &&
    "description" in demoSlot &&
    "label" in demoSlot &&
    "title" in demoSlot
  );
}
