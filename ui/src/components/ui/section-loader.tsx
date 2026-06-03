import clsx from "clsx";

import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface SectionLoaderProps {
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function SectionLoader({
  message = "Loading…",
  className,
  size = "lg",
}: SectionLoaderProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-3 py-12",
        className,
      )}
      aria-busy="true"
      aria-live="polite"
    >
      <LoadingSpinner size={size} />
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}
