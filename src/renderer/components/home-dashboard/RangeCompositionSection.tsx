import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { type DatePresetKey } from "./types";

interface RangeCompositionSectionProps {
  datePresets: readonly { key: DatePresetKey; getFrom: () => string; getTo: () => string }[];
  totalFrom: string;
  totalTo: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onPresetClick: (key: DatePresetKey) => void;
  isPresetActive: (key: DatePresetKey) => boolean;
  content: ReactNode;
}

function RangeCompositionSectionComponent({
  datePresets,
  onPresetClick,
  isPresetActive,
  content,
}: Readonly<RangeCompositionSectionProps>) {
  const { t } = useTranslation("home");

  return (
    <article className="dashboard-panel min-h-[23rem]">
      <div className="dashboard-section-head">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            {t("rangeComposition.title")}
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            {t("rangeComposition.subtitle")}
          </p>
        </div>
      </div>
      <div className="space-y-3 mb-3">
        {/* <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>From</span>
          <DateInput
            value={totalFrom}
            onChange={onFromChange}
            className="border border-[var(--color-border-strong)] rounded px-2.5 py-1.5 text-xs bg-[var(--color-bg-surface)] w-[9rem]"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
          <span>To</span>
          <DateInput
            value={totalTo}
            onChange={onToChange}
            className="border border-[var(--color-border-strong)] rounded px-2.5 py-1.5 text-xs bg-[var(--color-bg-surface)] w-[9rem]"
          />
        </div> */}
        <div className="flex flex-wrap gap-1.5">
          {datePresets.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onPresetClick(preset.key)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                isPresetActive(preset.key)
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] hover:bg-[var(--color-bg-surface)]"
              }`}
            >
              {t(`rangeComposition.presets.${preset.key}`)}
            </button>
          ))}
        </div>
      </div>
      {content}
    </article>
  );
}

export const RangeCompositionSection = memo(RangeCompositionSectionComponent);
