import { type ReactNode } from "react";

interface UnitsSectionPanelProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
}

export function UnitsSectionPanel({
  title,
  description,
  badge,
  children,
}: Readonly<UnitsSectionPanelProps>) {
  return (
    <article className="dashboard-panel min-h-[14rem]">
      <div className="dashboard-section-head">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] inline-flex flex-wrap items-center gap-2">
            <span>{title}</span>
            {badge}
          </h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--color-text-tertiary)] max-w-4xl">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </article>
  );
}
