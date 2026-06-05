import type { ReactNode } from "react";

import { FeatureGridCards } from "./FeatureGridCards";

export interface FeatureGridItem {
  ai?: boolean;
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

        <FeatureGridCards features={features} />

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
