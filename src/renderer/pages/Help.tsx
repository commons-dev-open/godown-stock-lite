import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import { AsyncDataPanel } from "../components/async-data-panel";
import {
  HelpEmptyState,
  HelpHero,
  HelpSectionPanel,
  HelpSegmentedTabs,
  HELP_SECTION_META,
  HELP_TAB_ORDER,
  type HelpTabId,
  loadHelpGuide,
} from "../components/help-page";

export default function Help() {
  const [activeTab, setActiveTab] = useState<HelpTabId>("overview");
  const sectionMeta = HELP_SECTION_META[activeTab];

  const guideQuery = useQuery({
    queryKey: ["help", "guide"],
    queryFn: loadHelpGuide,
    staleTime: Infinity,
  });

  const bodies = guideQuery.data;
  const activeBody = bodies ? bodies[activeTab] : null;

  return (
    <div className="space-y-4 home-dashboard pb-3 max-w-5xl mx-auto w-full">
      <HelpHero activeTab={activeTab} topicCount={HELP_TAB_ORDER.length} />
      <HelpSegmentedTabs active={activeTab} onChange={setActiveTab} />

      <DashboardSectionBoundary
        sectionTitle={sectionMeta.title}
        containerClassName="dashboard-panel"
        resetKeys={[activeTab, guideQuery.status, guideQuery.dataUpdatedAt]}
      >
        <HelpSectionPanel
          title={sectionMeta.title}
          description={sectionMeta.description}
        >
          <div
            role="tabpanel"
            id={`help-panel-${activeTab}`}
            aria-labelledby={`help-tab-${activeTab}`}
          >
            <AsyncDataPanel
              isLoading={guideQuery.isPending}
              isError={guideQuery.isError}
              onRetry={() => {
                void guideQuery.refetch();
              }}
              isEmpty={
                guideQuery.isSuccess &&
                bodies != null &&
                activeBody === null
              }
              empty={
                <HelpEmptyState
                  onRetry={() => {
                    void guideQuery.refetch();
                  }}
                />
              }
              loaderColumns={1}
              loaderRows={8}
              errorTitle="Could not load help"
              errorDescription="The guide module failed to load. Check the installation and try again."
            >
              {activeBody === null ? null : (
                <div className="pt-1">{activeBody}</div>
              )}
            </AsyncDataPanel>
          </div>
        </HelpSectionPanel>
      </DashboardSectionBoundary>

      <footer className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface-raised)] px-4 py-3 text-center text-xs text-[var(--color-text-tertiary)]">
        For more support, contact your provider or refer to your purchase
        documentation.
      </footer>
    </div>
  );
}
