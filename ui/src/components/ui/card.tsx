import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: "default" | "elevated" | "ghost";
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingClasses = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

const variantClasses = {
  default: "border border-border bg-surface card-shadow",
  elevated: "border border-border/60 bg-surface-elevated card-shadow",
  ghost: "bg-transparent",
};

export function Card({
  children,
  variant = "default",
  padding = "md",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        "rounded-[var(--radius-card)]",
        variantClasses[variant],
        paddingClasses[padding],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
