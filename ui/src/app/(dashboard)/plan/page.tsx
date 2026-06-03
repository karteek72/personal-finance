"use client";

import { PreviewHub } from "@/components/preview/preview-hub";
import { BudgetsPanel } from "@/components/preview/panels/budgets-panel";
import { CalendarPanel } from "@/components/preview/panels/calendar-panel";
import { ForecastPanel } from "@/components/preview/panels/forecast-panel";
import { RecurringPanel } from "@/components/preview/panels/recurring-panel";

export default function PlanPage() {
  return (
    <PreviewHub
      tabs={[
        { id: "budgets", label: "Budgets & Goals", Panel: BudgetsPanel },
        { id: "calendar", label: "Money Calendar", Panel: CalendarPanel },
        { id: "forecast", label: "Forecast", Panel: ForecastPanel },
        { id: "recurring", label: "Recurring", Panel: RecurringPanel },
      ]}
    />
  );
}
