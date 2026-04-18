import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { DashboardSectionBoundary } from "../components/home-dashboard";
import { AsyncDataPanel } from "../components/async-data-panel";
import {
  HelpDeveloperContact,
  HelpEmptyState,
  HelpHero,
  HelpSectionPanel,
  HelpSegmentedTabs,
  HELP_TAB_ORDER,
  helpLocaleString,
  helpPanelMetaKey,
  type HelpTabId,
  loadHelpGuide,
} from "../components/help-page";
export default function Help() {
  const { t, i18n } = useTranslation("help");
  const [activeTab, setActiveTab] = useState<HelpTabId>("overview");
  const panelKey = helpPanelMetaKey(activeTab);
  const sectionTitle = helpLocaleString(i18n, `panelMeta.${panelKey}.title`);
  const sectionDescription = helpLocaleString(
    i18n,
    `panelMeta.${panelKey}.description`,
  );

  const guideQuery = useQuery({
    queryKey: ["help", "guide", i18n.language],
    queryFn: loadHelpGuide,
    staleTime: Infinity,
  });

  const bodies = guideQuery.data;
  const activeBody = bodies ? bodies[activeTab] : null;
  const activeGuideBody =
    activeBody === null ? null : <div className="pt-1">{activeBody}</div>;

  return (
    <div className="space-y-4 home-dashboard pb-3 max-w-5xl mx-auto w-full">
      <HelpHero topicCount={HELP_TAB_ORDER.length} />
      <HelpSegmentedTabs active={activeTab} onChange={setActiveTab} />

      <DashboardSectionBoundary
        sectionTitle={sectionTitle}
        containerClassName="dashboard-panel"
        resetKeys={[activeTab, guideQuery.status, guideQuery.dataUpdatedAt, i18n.language]}
      >
        <HelpSectionPanel title={sectionTitle} description={sectionDescription}>
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
                guideQuery.isSuccess && bodies != null && activeBody === null
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
              errorTitle={t("loadError.title")}
              errorDescription={t("loadError.description")}
              retryLabel={t("loadError.retry")}
            >
              {activeGuideBody}
            </AsyncDataPanel>
          </div>
        </HelpSectionPanel>
      </DashboardSectionBoundary>

      <HelpDeveloperContact />
    </div>
  );
}
