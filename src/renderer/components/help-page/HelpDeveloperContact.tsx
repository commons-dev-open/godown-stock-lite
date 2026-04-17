import { ExternalLink, Mail, MapPin, MessageCircle } from "lucide-react";
import { HelpSectionPanel } from "./HelpSectionPanel";

const DEVELOPER_PHOTO_SRC = new URL(
  "../../../../resources/developer-photo.jpeg",
  import.meta.url
).href;

const DEVELOPER_NAME = "Arindam Hazra";
const FOUNDER_DEVELOPER_LABEL = "Founder and developer";
const DEVELOPER_LOCATION = "West Bengal, India";
const DEVELOPER_LINKEDIN = "https://www.linkedin.com/in/iamarindamhazra/";
const DEVELOPER_EMAIL = "hi@arindamhazra.in";
const WHATSAPP_DISPLAY = "+91 90644 84227";
const WHATSAPP_WA_ME = "https://wa.me/919064484227";

async function openExternalUrl(url: string): Promise<void> {
  const openInShell = globalThis.window?.electron?.openExternal;
  if (openInShell) {
    await openInShell(url);
    return;
  }
  globalThis.window?.open(url, "_blank", "noopener,noreferrer");
}

export function HelpDeveloperContact() {
  return (
    <HelpSectionPanel
      title="Founder and developer"
      description="For product issues, purchase, renewal, or licensing, use the contact options below. WhatsApp is preferred for the quickest replies."
    >
      <div className="px-4 pb-4 pt-1">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,15rem)_1fr] sm:items-start sm:gap-8">
          <div className="mx-auto w-full max-w-[15rem] shrink-0 sm:mx-0 sm:max-w-none">
            <div className="aspect-square w-full overflow-hidden rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
              <img
                src={DEVELOPER_PHOTO_SRC}
                alt={DEVELOPER_NAME}
                width={480}
                height={480}
                decoding="async"
                loading="lazy"
                className="h-full w-full object-cover object-[center_18%]"
              />
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-base font-semibold text-[var(--color-text-primary)]">
                {DEVELOPER_NAME}
              </p>
              <p className="mt-0.5 text-sm font-medium text-[var(--color-accent)]">
                {FOUNDER_DEVELOPER_LABEL}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                <MapPin
                  size={16}
                  strokeWidth={1.75}
                  className="shrink-0 text-[var(--color-text-tertiary)]"
                  aria-hidden="true"
                />
                <span>{DEVELOPER_LOCATION}</span>
              </p>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                className="inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-[var(--color-accent)] bg-[var(--color-bg-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface-raised)] sm:w-auto"
                onClick={() => {
                  void openExternalUrl(WHATSAPP_WA_ME);
                }}
              >
                <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />
                <span className="truncate">WhatsApp {WHATSAPP_DISPLAY}</span>
              </button>
              <p className="text-xs text-[var(--color-text-tertiary)] max-w-xl">
                Prefer WhatsApp for issues, purchase, and renewal — replies are
                usually faster than phone calls.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface-raised)]"
                onClick={() => {
                  void openExternalUrl(`mailto:${DEVELOPER_EMAIL}`);
                }}
              >
                <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>{DEVELOPER_EMAIL}</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-bg-surface-raised)]"
                onClick={() => {
                  void openExternalUrl(DEVELOPER_LINKEDIN);
                }}
              >
                <ExternalLink size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>LinkedIn profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </HelpSectionPanel>
  );
}
