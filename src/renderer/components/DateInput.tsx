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
    <div className="relative inline-flex min-w-0 max-w-full rounded-md shadow-sm">
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
        className="inline-flex shrink-0 items-center justify-center rounded-r-md border border-gray-300 border-l-0 bg-gray-50 px-2 text-gray-600 hover:bg-gray-100 focus:outline-none"
        aria-label="Open calendar"
      >
        <CalendarIcon />
      </button>
      <FloatingPortal>
        {pickerOpen && (
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="z-50 w-64 rounded-lg border border-gray-200 bg-white shadow-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded hover:bg-gray-100 text-gray-600"
                aria-label="Previous month"
              >
                <ChevronLeft />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {monthName}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded hover:bg-gray-100 text-gray-600"
                aria-label="Next month"
              >
                <ChevronRight />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d} className="py-1 text-gray-500 font-medium">
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
                      py-1.5 rounded
                      ${isSelected ? "bg-blue-600 text-white" : "hover:bg-gray-100 text-gray-900"}
                      ${isToday && !isSelected ? "ring-1 ring-blue-400" : ""}
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

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
