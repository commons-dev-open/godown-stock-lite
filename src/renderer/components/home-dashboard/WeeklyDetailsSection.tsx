import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import DateInput from "../DateInput";

interface WeeklyDetailsSectionProps {
  weeklyDate: string;
  onWeeklyDateChange: (value: string) => void;
  onSetToday: () => void;
  content: ReactNode;
}

function WeeklyDetailsSectionComponent({
  weeklyDate,
  onWeeklyDateChange,
  onSetToday,
  content,
}: Readonly<WeeklyDetailsSectionProps>) {
  const { t } = useTranslation("home");

  return (
    <article className="dashboard-panel xl:col-span-2">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
        {t("sections.weeklyDetails")}
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-3">
        {t("weeklyDetails.subtitle")}
      </p>
      <div className="flex flex-nowrap items-center gap-3 p-3 bg-[var(--color-bg-surface-raised)] rounded-xl border border-[var(--color-border-default)] overflow-hidden mb-4">
        <label className="flex items-center gap-1.5 shrink-0 text-sm text-[var(--color-text-secondary)]">
          {t("weeklyDetails.date")}
          <DateInput
            value={weeklyDate}
            onChange={onWeeklyDateChange}
            className="border border-[var(--color-border-strong)] rounded px-3 py-1.5 text-sm bg-[var(--color-bg-surface)] w-[10rem] shrink-0 min-w-0"
          />
        </label>
        <button
          type="button"
          onClick={onSetToday}
          className="inline-flex items-center gap-1 shrink-0 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          {t("weeklyDetails.today")}
        </button>
      </div>
      {content}
    </article>
  );
}

export const WeeklyDetailsSection = memo(WeeklyDetailsSectionComponent);
