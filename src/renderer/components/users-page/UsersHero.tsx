import { memo } from "react";
import { Plus, UserCog } from "lucide-react";
import { useTranslation } from "react-i18next";
import Button from "../Button";
import { useFormatters } from "../../i18n/useFormatters";
import type { NumberAbbreviationStyle } from "../../../shared/numbers";

interface UsersHeroProps {
  abbreviationStyle: NumberAbbreviationStyle;
  totalUsers: number;
  activeUsers: number;
  showAddButton: boolean;
  onAdd: () => void;
}

function UsersHeroComponent({
  abbreviationStyle,
  totalUsers,
  activeUsers,
  showAddButton,
  onAdd,
}: Readonly<UsersHeroProps>) {
  const { t } = useTranslation("users");
  const { formatAbbreviatedInteger } = useFormatters();
  return (
    <div className="dashboard-hero-sticky dashboard-hero-sticky--compact">
      <div className="dashboard-hero rounded-2xl border border-[var(--color-border-default)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:justify-between dashboard-hero-row--compact">
          <div className="flex min-w-0 flex-col justify-center gap-1 lg:max-w-[14rem] shrink-0">
            <div className="flex items-center gap-2">
              <UserCog
                size={22}
                strokeWidth={1.5}
                className="shrink-0 text-[var(--color-accent)]"
                aria-hidden="true"
              />
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)] leading-tight">
                {t("hero.title")}
              </h1>
            </div>
          </div>
          <div className="flex w-full min-w-0 flex-col gap-3 lg:w-auto lg:flex-row lg:items-center lg:gap-3 lg:shrink-0">
            <div className="dashboard-hero-metrics min-w-0 w-full max-w-full lg:w-auto lg:shrink-0">
              <div className="grid w-full max-w-full grid-cols-2 gap-2 sm:gap-2.5 lg:w-max lg:grid-flow-col lg:auto-cols-max">
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.metrics.members")}
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {formatAbbreviatedInteger(totalUsers, abbreviationStyle)}
                  </p>
                </div>
                <div className="dashboard-metric-card">
                  <p className="text-xs text-[var(--color-text-tertiary)]">
                    {t("hero.metrics.active")}
                  </p>
                  <p className="dashboard-hero-kpi-value text-[var(--color-text-primary)] tabular-nums">
                    {formatAbbreviatedInteger(activeUsers, abbreviationStyle)}
                  </p>
                </div>
              </div>
            </div>
            {showAddButton ? (
              <div className="flex w-full justify-end lg:w-auto shrink-0 lg:items-center">
                <Button
                  type="button"
                  onClick={onAdd}
                  className="w-full sm:w-auto"
                >
                  <Plus size={18} className="mr-1.5 shrink-0" aria-hidden="true" />
                  {t("actions.addUser")}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export const UsersHero = memo(UsersHeroComponent);
