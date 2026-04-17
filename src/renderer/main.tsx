import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./context/ThemeContext";
import "./i18n";
import { LocaleProvider } from "./i18n/LocaleContext";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary
      fallback={({ resetErrorBoundary }) => (
        <div className="min-h-screen bg-[var(--color-bg-app)] p-4 sm:p-8 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--color-danger)]/30 bg-[var(--color-bg-surface)] p-5 sm:p-6 shadow-sm">
            <p className="text-xs uppercase tracking-[0.14em] text-[var(--color-danger)]">
              Application Error
            </p>
            <h1 className="mt-2 text-xl font-semibold text-[var(--color-text-primary)]">
              Something went wrong in the app.
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Try reloading the app. If this keeps happening, restart the app window.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => resetErrorBoundary()}
                className="rounded-lg border border-[var(--color-border-default)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-surface-raised)]"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => globalThis.window.location.reload()}
                className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-sm text-[var(--color-accent-text)] hover:bg-[var(--color-accent-hover)]"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      )}
    >
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <ThemeProvider>
            <App />
            <Toaster
            position="bottom-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: "var(--color-text-primary)",
                color: "var(--color-text-inverse)",
                borderRadius: "var(--radius-lg)",
                fontSize: "13px",
                padding: "12px 16px",
                boxShadow: "var(--shadow-overlay)",
              },
            }}
          />
          </ThemeProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
