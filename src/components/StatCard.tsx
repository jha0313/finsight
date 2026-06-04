import type { ReactNode } from "react";

export interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: ReactNode;
  valueClassName?: string;
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  valueClassName,
}: StatCardProps) {
  const valueClasses = ["num", "text-ink", valueClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="rounded-card border border-hairline bg-canvas p-xl">
      <div className="flex items-start justify-between gap-base">
        <div>
          <p className="caption">{label}</p>
          <p className={valueClasses}>{value}</p>
        </div>
        {icon === undefined ? null : (
          <div className="flex size-11 items-center justify-center rounded-circle bg-surface-strong text-ink">
            {icon}
          </div>
        )}
      </div>
      {detail === undefined ? null : (
        <p className="body-sm mt-sm">{detail}</p>
      )}
    </article>
  );
}
