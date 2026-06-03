"use client";

import clsx from "clsx";
import { useState, type ComponentType } from "react";

export interface HubTab {
  id: string;
  label: string;
  Panel: ComponentType;
}

interface PreviewHubProps {
  tabs: HubTab[];
}

export function PreviewHub({ tabs }: PreviewHubProps) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const ActivePanel = (tabs.find((t) => t.id === active) ?? tabs[0])?.Panel;

  return (
    <div className="space-y-5">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={clsx(
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all",
              active === t.id
                ? "border-primary bg-primary-soft text-primary"
                : "border-border text-text-muted hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {ActivePanel ? <ActivePanel /> : null}
    </div>
  );
}
