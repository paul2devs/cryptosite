import { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

export type Tone = "neutral" | "positive" | "negative" | "gold";

const toneText: Record<Tone, string> = {
  neutral: "text-[#9CA3AF]",
  positive: "text-[#16C784]",
  negative: "text-[#EA3943]",
  gold: "text-[#C6A15B]"
};

const toneBackground: Record<Tone, string> = {
  neutral: "bg-[#26272B]/60 text-[#9CA3AF]",
  positive: "bg-[#16C784]/12 text-[#16C784]",
  negative: "bg-[#EA3943]/12 text-[#EA3943]",
  gold: "bg-[#C6A15B]/12 text-[#C6A15B]"
};

const toneBar: Record<Tone, string> = {
  neutral: "bg-[#6B7280]",
  positive: "bg-[#16C784]",
  negative: "bg-[#EA3943]",
  gold: "bg-[#C6A15B]"
};

export function getToneText(tone: Tone): string {
  return toneText[tone];
}

export function getToneBar(tone: Tone): string {
  return toneBar[tone];
}

export function Section({
  id,
  children,
  className = ""
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-24 ${className}`}>
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  className = ""
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0 space-y-1">
        {eyebrow ? (
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6B7280]">{eyebrow}</p>
        ) : null}
        <h2 className="display-font text-[15px] font-medium tracking-tight text-[#F5F5F7] sm:text-base">
          {title}
        </h2>
        {description ? (
          <p className="max-w-xl text-xs leading-relaxed text-[#9CA3AF]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
  id
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={`card px-4 py-4 sm:px-5 sm:py-5 ${className}`}>
      {children}
    </div>
  );
}

export function Divider({ className = "" }: { className?: string }) {
  return <div className={`h-px w-full bg-[#1F2023] ${className}`} />;
}

export function StatStrip({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`stat-strip ${className}`}>{children}</div>;
}

export function ListRow({
  children,
  className = "",
  onClick
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`list-row w-full text-left transition-colors hover:bg-[#17181A] ${className}`}
      >
        {children}
      </button>
    );
  }
  return <div className={`list-row ${className}`}>{children}</div>;
}

export function Stat({
  label,
  value,
  hint,
  tone = "neutral"
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0 py-1">
      <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
      <p className={`financial-figure mt-1 truncate text-sm font-medium ${toneText[tone]}`}>
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-[10px] text-[#9CA3AF]">{hint}</p> : null}
    </div>
  );
}

export function StatusBadge({ tone = "neutral", label }: { tone?: Tone; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] ${toneBackground[tone]}`}
    >
      {label}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone = "neutral",
  align = "left",
  valueClassName = "text-lg"
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  align?: "left" | "right";
  valueClassName?: string;
}) {
  return (
    <div className={`min-w-0 space-y-1 ${align === "right" ? "text-right" : "text-left"}`}>
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">{label}</p>
      <p className={`financial-figure font-medium ${valueClassName} ${toneText[tone]}`}>{value}</p>
      {hint ? <p className="truncate text-[11px] text-[#9CA3AF]">{hint}</p> : null}
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "gold",
  className = ""
}: {
  value: number;
  tone?: Tone;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-[#26272B] ${className}`}>
      <div
        className={`h-full rounded-full transition-[width] duration-500 ease-out ${toneBar[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap items-center gap-0.5 rounded-2xl bg-[#0F0F10] p-0.5 ring-1 ring-inset ring-[#26272B]"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
              isActive
                ? "bg-[#C6A15B]/12 text-[#C6A15B]"
                : "text-[#9CA3AF] hover:text-[#F5F5F7]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-2 py-6 sm:items-center sm:text-center">
      <p className="text-sm font-medium text-[#F5F5F7]">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-[#9CA3AF]">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

export function SkeletonBlock({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[#26272B] ${className}`} />;
}

export function LoadingRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-6 text-xs text-[#9CA3AF]">
      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorRow({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#EA3943]/8 px-3 py-2.5">
      <div className="flex items-center gap-2 text-xs text-[#EA3943]">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{message}</span>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-[#EA3943]/40 px-3 py-1 text-[11px] font-medium text-[#EA3943] transition-colors hover:bg-[#EA3943]/10"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
