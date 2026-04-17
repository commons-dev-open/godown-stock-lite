import { type ReactNode } from "react";

interface UsersSectionPanelProps {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
}

export function UsersSectionPanel({
  title,
  description,
  badge,
  children,
}: Readonly<UsersSectionPanelProps>) {
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
