import clsx from "clsx";

const sizeClasses = {
  sm: "h-4 w-4 border",
  md: "h-6 w-6 border-2",
  lg: "h-9 w-9 border-2",
} as const;

interface LoadingSpinnerProps {
  size?: keyof typeof sizeClasses;
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  size = "md",
  className,
  label = "Loading",
}: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className={clsx(
        "inline-block shrink-0 animate-spin rounded-full border-primary/25 border-t-primary",
        sizeClasses[size],
        className,
      )}
    />
  );
}
