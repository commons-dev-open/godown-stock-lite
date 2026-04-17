import { memo, type ReactNode } from "react";
import DateInput from "../DateInput";
import { DATE_PRESETS } from "./datePresets";

interface RangeCompositionSectionProps {
  totalFrom: string;
  totalTo: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onPresetClick: (label: string) => void;
  isPresetActive: (label: string) => boolean;
  content: ReactNode;
}

function RangeCompositionSectionComponent({
  totalFrom,
  totalTo,
  onFromChange,
  onToChange,
  onPresetClick,
  isPresetActive,
  content,
}: Readonly<RangeCompositionSectionProps>) {
  return (
    <article className="dashboard-panel min-h-[23rem]">
      <div className="dashboard-section-head">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            Range Composition
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Invoice, misc, and expenditure for selected period.
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
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onPresetClick(preset.label)}
              className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                isPresetActive(preset.label)
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]"
                  : "border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] hover:bg-[var(--color-bg-surface)]"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
      {content}
    </article>
  );
}

export const RangeCompositionSection = memo(RangeCompositionSectionComponent);
