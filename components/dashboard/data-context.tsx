"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { DashboardVM } from "@/lib/dashboard-vm";
import type { PeriodData, TrendPoint } from "@/lib/demo-periods";

// The special selected value for the "All periods" aggregate.
export const ALL_PERIODS = "all";

type PeriodContextValue = {
  data: PeriodData;
  selected: string;
  setSelected: (key: string) => void;
};

const DashboardDataContext = createContext<PeriodContextValue | null>(null);

export function DashboardDataProvider({
  value,
  children,
}: {
  value: PeriodData;
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<string>(value.defaultPeriod);
  const ctx = useMemo<PeriodContextValue>(
    () => ({ data: value, selected, setSelected }),
    [value, selected],
  );
  return <DashboardDataContext.Provider value={ctx}>{children}</DashboardDataContext.Provider>;
}

function usePeriodContext(): PeriodContextValue {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }
  return ctx;
}

// Returns the currently-selected period's view-model. Same return type as before
// (a single DashboardVM) so the existing panels need no changes.
export function useDashboardData(): DashboardVM {
  const { data, selected } = usePeriodContext();
  return selected === ALL_PERIODS ? data.aggregate : data.vmByPeriod[selected];
}

export function useDashboardPeriods(): {
  periods: PeriodData["periods"];
  selected: string;
  setSelected: (key: string) => void;
  trends: TrendPoint[];
} {
  const { data, selected, setSelected } = usePeriodContext();
  return { periods: data.periods, selected, setSelected, trends: data.trends };
}
