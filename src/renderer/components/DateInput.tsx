import { useState, useEffect } from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useClick,
  useDismiss,
  useInteractions,
  FloatingPortal,
} from "@floating-ui/react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateForForm, parseFormDate } from "../lib/date";

type Props = Readonly<{
  value: string; // YYYY-MM-DD or ""
  onChange: (iso: string) => void;
  placeholder?: string;
  id?: string;
  name?: string;
  required?: boolean;
  className?: string;
}>;

function toISO(year: number, month: number, day: number): string {
  const y = `${year}`;
  const m = month < 10 ? `0${month}` : `${month}`;
  const d = day < 10 ? `0${day}` : `${day}`;
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** Controlled date input that displays and accepts dd/mm/yyyy, with calendar picker. */
export default function DateInput({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
  id,
  name,
  required,
  className,
}: Props) {
  const [local, setLocal] = useState(() =>
    value ? formatDateForForm(value) : ""
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    if (value) {
      const [y] = value.split("-").map(Number);
      return y;
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) {
      const [, m] = value.split("-").map(Number);
      return m;
    }
    return new Date().getMonth() + 1;
  });

  useEffect(() => {
    if (value) {
      setLocal(formatDateForForm(value));
      const [y, m] = value.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m);
    } else {
      setLocal("");
    }
  }, [value]);

  const { refs, floatingStyles, context } = useFloating({
    open: pickerOpen,
    onOpenChange: setPickerOpen,
    placement: "bottom-start",
    middleware: [offset(4), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const click = useClick(context);
  const dismiss = useDismiss(context, {
    escapeKey: true,
    outsidePress: true,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    click,
    dismiss,
  ]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocal(raw);
    const parsed = parseFormDate(raw);
    if (parsed !== "") {
      onChange(parsed);
    } else if (raw.trim() === "") {
      onChange("");
    }
  };

  const handleSelectDate = (iso: string) => {
    onChange(iso);
    setPickerOpen(false);
  };

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const leadingBlanks = firstDay;
  const monthName = new Date(viewYear, viewMonth - 1, 1).toLocaleString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="relative inline-flex min-w-0 max-w-full rounded-lg shadow-sm h-9">
      <input
        type="text"
        id={id}
        name={name}
        value={local}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className={`min-w-0 flex-1 rounded-r-none border-r-0 ${className ?? ""}`}
        autoComplete="off"
        ref={refs.setReference}
        {...getReferenceProps()}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setPickerOpen((o) => !o)}
        className="inline-flex shrink-0 items-center justify-center rounded-r-lg border border-[var(--color-border-strong)] border-l-0 bg-[var(--color-bg-surface-raised)] px-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface-sunken)] focus:outline-none"
        aria-label="Open calendar"
      >
        <Calendar size={18} />
      </button>
      <FloatingPortal>
        {pickerOpen && (
          <div
            ref={refs.setFloating} // eslint-disable-line react-hooks/refs -- floating-ui assigns ref in effect
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 w-64 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-lg hover:bg-[var(--color-bg-surface-raised)] text-[var(--color-text-secondary)]"
                aria-label="Previous month"
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                {monthName}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-lg hover:bg-[var(--color-bg-surface-raised)] text-[var(--color-text-secondary)]"
                aria-label="Next month"
              >
                <ChevronRight size={20} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="py-1 text-[var(--color-text-tertiary)] font-medium">
                  {d}
                </div>
              ))}
              {Array.from({ length: leadingBlanks }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const iso = toISO(viewYear, viewMonth, day);
                const isSelected = value === iso;
                const isToday = todayIso === iso;
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => handleSelectDate(iso)}
                    className={`
                      py-1.5 rounded-lg
                      ${isSelected ? "bg-[var(--color-accent)] text-[var(--color-text-inverse)]" : "hover:bg-[var(--color-bg-surface-raised)] text-[var(--color-text-primary)]"}
                      ${isToday && !isSelected ? "ring-1 ring-[var(--color-accent)]" : ""}
                    `}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </FloatingPortal>
    </div>
  );
}
