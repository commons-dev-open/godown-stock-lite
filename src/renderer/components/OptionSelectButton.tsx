import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/** Approximate row height (text-sm + vertical padding) for scroll viewport sizing */
const ROW_HEIGHT_REM = 2.25;

/** Default page size for DB-backed `loadOptions` (e.g. `getItemsPage`). */
export const OPTION_SELECT_REMOTE_ITEM_LIMIT = 20;

const DEFAULT_REMOTE_SEARCH_DEBOUNCE_MS = 250;

export interface OptionSelectOption<
  V extends string | number = string | number,
> {
  value: V;
  label: string;
  /** Extra text used only for filtering (not shown) */
  searchText?: string;
  /** SKU / item code — included in search (not shown) */
  code?: string;
}

export interface OptionSelectButtonProps<
  V extends string | number = string | number,
> {
  options: ReadonlyArray<OptionSelectOption<V>>;
  value: V | null | undefined;
  onChange: (next: V | null) => void;
  placeholder?: string;
  /**
   * How many option rows fit in the list before scrolling.
   * @default 20
   */
  maxVisibleItems?: number;
  disabled?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  /** Renders a hidden input for native form posts */
  name?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  required?: boolean;
  /** Stable `data-testid` for the trigger button. */
  testId?: string;
  /**
   * When set, the list is loaded via this callback (e.g. DB) instead of filtering `options`.
   * Empty string means the default first page. Typing uses a trailing debounce.
   */
  loadOptions?: (
    query: string
  ) => Promise<ReadonlyArray<OptionSelectOption<V>>>;
  /** Debounce for remote search after typing; opening the panel still fetches immediately. */
  remoteSearchDebounceMs?: number;
}

function normalizeFilter(q: string): string {
  return q.trim().toLowerCase();
}

function matchesOption<V extends string | number>(
  opt: OptionSelectOption<V>,
  q: string
): boolean {
  if (q === "") {
    return true;
  }
  const label = opt.label.toLowerCase();
  if (label.includes(q)) {
    return true;
  }
  if (opt.searchText?.toLowerCase().includes(q)) {
    return true;
  }
  if (opt.code?.toLowerCase().includes(q)) {
    return true;
  }
  if (typeof opt.value === "string" && opt.value.toLowerCase().includes(q)) {
    return true;
  }
  return false;
}

export function OptionSelectButton<V extends string | number = string | number>(
  props: Readonly<OptionSelectButtonProps<V>>
) {
  const {
    options,
    value,
    onChange,
    placeholder = "Select…",
    maxVisibleItems = 20,
    disabled = false,
    className = "",
    id: idProp,
    "aria-label": ariaLabel,
    name,
    searchPlaceholder = "Search…",
    emptyText = "No matches",
    required = false,
    testId,
    loadOptions,
    remoteSearchDebounceMs = DEFAULT_REMOTE_SEARCH_DEBOUNCE_MS,
  } = props;
  const reactId = useId();
  const triggerId = idProp ?? `option-select-trigger-${reactId}`;
  const listboxId = `${triggerId}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelWidth, setPanelWidth] = useState<number | undefined>(undefined);
  const [remoteOptions, setRemoteOptions] = useState<
    ReadonlyArray<OptionSelectOption<V>>
  >([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const remoteFetchIdRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
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

  const qNorm = useMemo(() => normalizeFilter(query), [query]);

  const filtered = useMemo(
    () => options.filter((o) => matchesOption(o, qNorm)),
    [options, qNorm]
  );

  const listItems = useMemo(() => {
    if (!loadOptions) {
      return filtered;
    }
    if (qNorm === "") {
      return remoteOptions;
    }
    const fromRemote = remoteOptions.filter((o) => matchesOption(o, qNorm));
    if (fromRemote.length > 0) {
      return fromRemote;
    }
    return options.filter((o) => matchesOption(o, qNorm));
  }, [loadOptions, filtered, remoteOptions, options, qNorm]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      if (loadOptions) {
        remoteFetchIdRef.current += 1;
        setRemoteOptions([]);
        setRemoteLoading(false);
      }
    }
  }, [open, loadOptions]);

  useEffect(() => {
    if (!open || !loadOptions) {
      return;
    }
    const trimmed = query.trim();
    const delay = trimmed === "" ? 0 : remoteSearchDebounceMs;
    const handle = window.setTimeout(() => {
      const fetchId = ++remoteFetchIdRef.current;
      setRemoteLoading(true);
      void (async () => {
        try {
          const rows = await loadOptions(trimmed);
          if (fetchId !== remoteFetchIdRef.current) {
            return;
          }
          setRemoteOptions(rows);
        } catch {
          if (fetchId !== remoteFetchIdRef.current) {
            return;
          }
          setRemoteOptions([]);
        } finally {
          if (fetchId === remoteFetchIdRef.current) {
            setRemoteLoading(false);
          }
        }
      })();
    }, delay);
    return () => {
      window.clearTimeout(handle);
    };
  }, [open, query, loadOptions, remoteSearchDebounceMs]);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    const w = triggerRef.current?.getBoundingClientRect().width;
    if (w && w > 0) {
      setPanelWidth(w);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (loadOptions) {
      const i = listItems.findIndex((o) => o.value === value);
      setActiveIndex(i >= 0 ? i : 0);
      return;
    }
    const i = options.findIndex((o) => o.value === value);
    setActiveIndex(Math.max(0, i));
  }, [open, loadOptions, listItems, options, value]);

  useLayoutEffect(() => {
    if (listItems.length === 0) {
      return;
    }
    setActiveIndex((i) => Math.min(i, listItems.length - 1));
  }, [listItems.length]);

  useEffect(() => {
    if (open) {
      searchInputRef.current?.focus();
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open || listItems.length === 0) {
      return;
    }
    const root = refs.floating.current;
    const el = root?.querySelector(`[data-option-idx="${activeIndex}"]`);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, listItems.length, open, refs.floating]);

  const selectedLabel = useMemo(() => {
    const fromOpts = options.find((o) => o.value === value)?.label;
    if (fromOpts) {
      return fromOpts;
    }
    if (loadOptions) {
      const fromRemote = remoteOptions.find((o) => o.value === value)?.label;
      if (fromRemote) {
        return fromRemote;
      }
    }
    return "";
  }, [loadOptions, options, remoteOptions, value]);

  const listMaxHeight = `min(55vh, ${Math.max(1, maxVisibleItems) * ROW_HEIGHT_REM}rem)`;

  const pick = useCallback(
    (next: V | null) => {
      onChange(next);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange]
  );

  function handleTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) {
      return;
    }
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      if (!open) {
        e.preventDefault();
        setOpen(true);
      }
    }
  }

  function handleSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (listItems.length === 0) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, listItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = listItems[activeIndex];
      if (opt) {
        pick(opt.value);
      }
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(listItems.length - 1);
    }
  }

  const mergedFloatingStyle = useMemo(() => {
    const widthStyle =
      panelWidth !== undefined && panelWidth > 0 ? { width: panelWidth } : {};
    return { ...floatingStyles, ...widthStyle };
  }, [floatingStyles, panelWidth]);

  return (
    <div className={`relative w-full min-w-0 ${className}`.trim()}>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value === null || value === undefined ? "" : String(value)}
          required={required}
        />
      ) : null}
      <button
        ref={(node) => {
          triggerRef.current = node;
          refs.setReference(node);
        }}
        type="button"
        id={triggerId}
        data-testid={testId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        className={`input-base w-full min-w-0 flex items-center justify-between gap-2 text-left ${
          disabled ? "" : "cursor-pointer"
        }`}
        {...getReferenceProps({
          onKeyDown: handleTriggerKeyDown,
        })}
      >
        <span
          className={
            selectedLabel
              ? "text-[var(--color-text-primary)]"
              : "text-[var(--color-text-tertiary)]"
          }
        >
          {selectedLabel || placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--color-text-tertiary)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={mergedFloatingStyle}
            className="z-[100] rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-lg overflow-hidden"
            {...getFloatingProps()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--color-border-default)] px-2 py-1.5">
              <Search
                className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]"
                aria-hidden
              />
              <input
                ref={searchInputRef}
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 bg-transparent py-1 text-sm text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-tertiary)]"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-activedescendant={
                  listItems.length > 0
                    ? `${listboxId}-opt-${activeIndex}`
                    : undefined
                }
              />
            </div>
            <div
              id={listboxId}
              role="listbox"
              aria-labelledby={triggerId}
              className="overflow-y-auto overscroll-contain py-1"
              style={{ maxHeight: listMaxHeight }}
            >
              {loadOptions && remoteLoading && listItems.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-tertiary)]">
                  Loading…
                </div>
              ) : listItems.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-[var(--color-text-tertiary)]">
                  {emptyText}
                </div>
              ) : (
                listItems.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isActive = idx === activeIndex;
                  return (
                    <div
                      key={String(opt.value)}
                      id={`${listboxId}-opt-${idx}`}
                      role="option"
                      tabIndex={-1}
                      aria-selected={isSelected}
                      data-option-idx={idx}
                      className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                        isActive ? "bg-[var(--color-bg-surface-raised)]" : ""
                      } ${isSelected ? "font-medium" : ""}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(opt.value);
                      }}
                    >
                      <span className="min-w-0 flex-1 break-words line-clamp-3 text-[var(--color-text-primary)]">
                        {opt.label}
                      </span>
                      {isSelected ? (
                        <Check
                          className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                          aria-hidden
                        />
                      ) : (
                        <span className="h-4 w-4 shrink-0" aria-hidden />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </FloatingPortal>
      )}
    </div>
  );
}
