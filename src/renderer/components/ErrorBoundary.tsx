import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback:
    | ReactNode
    | ((props: Readonly<ErrorBoundaryFallbackProps>) => ReactNode);
  resetKeys?: readonly unknown[];
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

function areResetKeysEqual(
  previousResetKeys: readonly unknown[] = [],
  nextResetKeys: readonly unknown[] = []
): boolean {
  if (previousResetKeys.length !== nextResetKeys.length) {
    return false;
  }

  for (let index = 0; index < previousResetKeys.length; index += 1) {
    if (!Object.is(previousResetKeys[index], nextResetKeys[index])) {
      return false;
    }
  }

  return true;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = { error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  public componentDidUpdate(previousProps: Readonly<ErrorBoundaryProps>): void {
    const hasError = this.state.error !== null;
    if (!hasError) {
      return;
    }

    const didResetKeysChange = !areResetKeysEqual(
      previousProps.resetKeys,
      this.props.resetKeys
    );
    if (didResetKeysChange) {
      this.setState({ error: null });
    }
  }

  private readonly resetErrorBoundary = (): void => {
    this.setState({ error: null });
  };

  public render(): ReactNode {
    const { error } = this.state;
    const { children, fallback } = this.props;

    if (error === null) {
      return children;
    }

    if (typeof fallback === "function") {
      return fallback({ error, resetErrorBoundary: this.resetErrorBoundary });
    }

    return fallback;
  }
}

