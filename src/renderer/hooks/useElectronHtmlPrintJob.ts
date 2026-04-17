import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";

export interface HtmlPrintJobBase {
  mode: "browser" | "pdf";
  documentTitle: string;
  defaultPdfPath: string;
  /** Passed to Electron printToPDF; defaults to true (landscape A4 tables). */
  pdfLandscape?: boolean;
  pdfPageSize?: unknown;
}

export interface UseElectronHtmlPrintJobCallbacks {
  onPdfFinished?: (result: { saved: boolean }) => void;
  onPdfError?: (err: unknown) => void;
}

/**
 * Renders a print root in the DOM, then either opens the system print dialog
 * or saves the current document via Electron printToPDF (HTML → PDF).
 */
export function useElectronHtmlPrintJob<T extends HtmlPrintJobBase>(
  job: T | null,
  setJob: Dispatch<SetStateAction<T | null>>,
  api: {
    printCurrentToPdf: (opts?: {
      defaultPath?: string;
      landscape?: boolean;
      pageSize?: unknown;
    }) => Promise<{ saved: false } | { saved: true; path: string }>;
  },
  callbacks?: UseElectronHtmlPrintJobCallbacks
): void {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!job) {
      return;
    }
    const previousTitle = document.title;
    document.title = job.documentTitle;

    if (job.mode === "browser") {
      const onAfterPrint = () => {
        document.title = previousTitle;
        setJob(null);
      };
      globalThis.addEventListener("afterprint", onAfterPrint);
      const timeoutId = setTimeout(() => globalThis.print(), 100);
      return () => {
        clearTimeout(timeoutId);
        document.title = previousTitle;
        globalThis.removeEventListener("afterprint", onAfterPrint);
        setJob(null);
      };
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      void (async () => {
        try {
          if (cancelled) {
            return;
          }
          const result = await api.printCurrentToPdf({
            defaultPath: job.defaultPdfPath,
            landscape: job.pdfLandscape ?? true,
            ...(job.pdfPageSize !== undefined
              ? { pageSize: job.pdfPageSize }
              : {}),
          });
          if (cancelled) {
            return;
          }
          document.title = previousTitle;
          setJob(null);
          callbacksRef.current?.onPdfFinished?.({ saved: result.saved });
        } catch (err) {
          if (cancelled) {
            return;
          }
          document.title = previousTitle;
          setJob(null);
          callbacksRef.current?.onPdfError?.(err);
        }
      })();
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      document.title = previousTitle;
      setJob(null);
    };
  }, [job, setJob, api]);
}
