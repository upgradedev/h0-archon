"use client";

import { createContext, useContext } from "react";
import type { DashboardVM } from "@/lib/dashboard-vm";

const DashboardDataContext = createContext<DashboardVM | null>(null);

export function DashboardDataProvider({
  value,
  children,
}: {
  value: DashboardVM;
  children: React.ReactNode;
}) {
  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useDashboardData(): DashboardVM {
  const value = useContext(DashboardDataContext);
  if (!value) {
    throw new Error("useDashboardData must be used within a DashboardDataProvider");
  }
  return value;
}
