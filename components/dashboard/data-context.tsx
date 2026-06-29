"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { DashboardVM } from "@/lib/dashboard-vm";
import type { PeriodData, TrendPoint } from "@/lib/demo-periods";

// The special selected value for the "All periods" aggregate.
export const ALL_PERIODS = "all";

type PeriodContextValue = {
  // The CURRENT period data — starts as the canonical close, but the agent-ledger
  // upload can swap in a per-session recomputed dataset (see setPeriodData).
  data: PeriodData;
  // The original canonical close, kept so "Reset to demo" can revert.
  baseData: PeriodData;
  selected: string;
  setSelected: (key: string) => void;
  // Per-session recompute: swap the whole dataset (never persisted).
  setPeriodData: (data: PeriodData) => void;
  // Revert to the canonical close.
  resetPeriodData: () => void;
  // True when the session is showing a recomputed (uploaded-document) dataset.
  isCustom: boolean;
  // Tiles to flash (keys: `kpi:<id>`, "pnl", "cash", "payroll"). Cleared after the
  // animation window so the same tile can flash again on the next upload.
  flashKeys: ReadonlySet<string>;
  flash: (keys: string[]) => void;
};

const DashboardDataContext = createContext<PeriodContextValue | null>(null);

// Pure selection of the view-model for a period key (shared by the hook and the
// upload handler so both resolve the same VM, including the "all" aggregate).
export function selectVM(data: PeriodData, selected: string): DashboardVM {
  if (selected === ALL_PERIODS) return data.aggregate;
  return data.vmByPeriod[selected] ?? data.vmByPeriod[data.defaultPeriod] ?? data.aggregate;
}

export function DashboardDataProvider({
  value,
  children,
}: {
  value: PeriodData;
  children: React.ReactNode;
}) {
  const [data, setData] = useState<PeriodData>(value);
  const [selected, setSelected] = useState<string>(value.defaultPeriod);
  const [isCustom, setIsCustom] = useState(false);
  const [flashKeys, setFlashKeys] = useState<ReadonlySet<string>>(() => new Set());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPeriodData = useCallback((next: PeriodData) => {
    setData(next);
    setIsCustom(true);
  }, []);

  const resetPeriodData = useCallback(() => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setData(value);
    setSelected(value.defaultPeriod);
    setIsCustom(false);
    setFlashKeys(new Set());
  }, [value]);

  const flash = useCallback((keys: string[]) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlashKeys(new Set(keys));
    // Slightly longer than the 1.5s CSS animation so it always runs to completion.
    flashTimer.current = setTimeout(() => setFlashKeys(new Set()), 1600);
  }, []);

  const ctx = useMemo<PeriodContextValue>(
    () => ({
      data,
      baseData: value,
      selected,
      setSelected,
      setPeriodData,
      resetPeriodData,
      isCustom,
      flashKeys,
      flash,
    }),
    [data, value, selected, setPeriodData, resetPeriodData, isCustom, flashKeys, flash],
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
  return selectVM(data, selected);
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

// Per-session mutation surface for the agent-ledger upload flow: swap the dataset,
// reset to the demo, and flash the tiles that changed.
export function useDashboardSession(): {
  data: PeriodData;
  baseData: PeriodData;
  selected: string;
  setPeriodData: (data: PeriodData) => void;
  resetPeriodData: () => void;
  isCustom: boolean;
  flash: (keys: string[]) => void;
} {
  const { data, baseData, selected, setPeriodData, resetPeriodData, isCustom, flash } =
    usePeriodContext();
  return { data, baseData, selected, setPeriodData, resetPeriodData, isCustom, flash };
}

// True when a given tile key is currently flashing.
export function useTileFlash(key: string): boolean {
  return usePeriodContext().flashKeys.has(key);
}
