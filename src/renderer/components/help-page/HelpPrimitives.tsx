import { type ReactNode } from "react";

interface HelpSubSectionProps {
  title: string;
  children: ReactNode;
}

export function HelpSubSection({ title, children }: Readonly<HelpSubSectionProps>) {
  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-5 shadow-xs last:mb-0 mb-4">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] mb-3">
        {title}
      </h3>
      <div className="text-sm text-[var(--color-text-secondary)] space-y-2">{children}</div>
    </div>
  );
}

export function HelpStepList({ steps }: Readonly<{ steps: string[] }>) {
  return (
    <ol className="list-decimal list-inside space-y-1.5 text-[var(--color-text-secondary)]">
      {steps.map((step) => (
        <li key={step.slice(0, 80)}>{step}</li>
      ))}
    </ol>
  );
}

export function HelpBulletList({ items }: Readonly<{ items: string[] }>) {
  return (
    <ul className="list-disc list-inside space-y-1 text-[var(--color-text-secondary)]">
      {items.map((item) => (
        <li key={item.slice(0, 80)}>{item}</li>
      ))}
    </ul>
  );
}
