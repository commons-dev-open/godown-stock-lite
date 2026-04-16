import React from "react";
import ReactDOM from "react-dom/client";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./context/ThemeContext";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30 * 1000 },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  </React.StrictMode>
);
