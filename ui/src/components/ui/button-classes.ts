import clsx from "clsx";

/** Primary CTA — pill shape, brand fill. Use for connect, save, and main actions. */
export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-primary px-5 py-2.5 text-sm font-semibold text-text-inverse transition-all hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function primaryButtonClassName(
  ...extra: Array<string | false | null | undefined>
): string {
  return clsx(primaryButtonClass, ...extra);
}
