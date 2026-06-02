import clsx from "clsx";

interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  className?: string;
}

export function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  className,
}: FilterSelectProps) {
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-xs font-semibold text-text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-[var(--radius-sm)] border-0 bg-surface px-3 py-2.5 text-sm font-medium text-text card-shadow outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map((option) => (
          <option key={option.value || "all"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
