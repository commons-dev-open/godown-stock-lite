import {
  useState,
  useId,
  useRef,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  arrow,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingArrow,
  type Placement,
} from "@floating-ui/react";

type Props = Readonly<{
  content: ReactNode;
  children: ReactElement;
  /** Delay in ms before showing tooltip (default 200) */
  delay?: number;
  /** Tooltip placement (default "top") */
  placement?: Placement;
}>;

/**
 * Accessible tooltip using Floating UI. Wraps a single element and shows
 * content on hover/focus with proper positioning and ARIA.
 */
export default function Tooltip({ content, children, delay = 200, placement = "top" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const id = useId();
  const arrowRef = useRef<SVGSVGElement>(null);

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement,
    middleware: [
      offset(10),
      arrow({ element: arrowRef }), // eslint-disable-line react-hooks/refs -- floating-ui reads ref in layout effect
      flip(),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, { move: false, delay: { open: delay } });
  const focus = useFocus(context);
  const dismiss = useDismiss(context, { escapeKey: true });
  const role = useRole(context, { role: "tooltip" });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  if (!isValidElement(children)) {
    return <>{children}</>;
  }

  const mergedProps = {
    ...(typeof children.props === "object" && children.props !== null
      ? children.props
      : {}),
    ref: refs.setReference,
    ...getReferenceProps(),
  };
  return (
    <>
      {cloneElement(
        children,
        mergedProps as React.Attributes & Record<string, unknown>
      )}
      <FloatingPortal>
        {isOpen && (
          <div
            id={id}
            ref={refs.setFloating}
            style={floatingStyles}
            {...getFloatingProps()}
            className="relative z-50 max-w-xs rounded-md border border-[var(--color-border-default)] bg-[var(--color-text-primary)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-inverse)] shadow-lg"
          >
            {content}
            <FloatingArrow
              ref={arrowRef}
              context={context}
              className="fill-[var(--color-text-primary)]"
              stroke="var(--color-border-default)"
              strokeWidth={1}
            />
          </div>
        )}
      </FloatingPortal>
    </>
  );
}
