export function formatUsd(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) {
    return `$${(0).toFixed(decimals)}`;
  }
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

export function formatUsdCompact(value: number): string {
  if (!Number.isFinite(value)) {
    return "$0.00";
  }
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 10_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return formatUsd(value);
}

export function formatNumber(value: number, decimals = 6): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

export function formatPercent(
  value: number,
  options: { decimals?: number; signed?: boolean } = {}
): string {
  const { decimals = 2, signed = false } = options;
  if (!Number.isFinite(value)) {
    return signed ? "0.00%" : "0.00%";
  }
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

export function formatSignedUsd(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) {
    return formatUsd(0, decimals);
  }
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatUsd(Math.abs(value), decimals)}`;
}

export function parseDecimalString(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatShortDate(value: string | number | Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

export function formatRelativeTime(value: string | number | Date | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  const timestamp = date.getTime();
  if (Number.isNaN(timestamp)) {
    return "-";
  }
  const diffSeconds = Math.round((Date.now() - timestamp) / 1000);
  if (diffSeconds < 60) {
    return "just now";
  }
  const minutes = Math.round(diffSeconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  return formatShortDate(date);
}

export function truncateMiddle(value: string, head = 6, tail = 6): string {
  if (!value) {
    return "";
  }
  if (value.length <= head + tail + 3) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

export function getFirstName(name: string | null | undefined, email: string): string {
  const source = name && name.trim().length > 0 ? name.trim() : email.split("@")[0] || "";
  if (!source) {
    return "there";
  }
  const firstToken = source.split(/\s+/)[0];
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
}

export function getInitials(name: string | null | undefined, email: string): string {
  const source = name && name.trim().length > 0 ? name.trim() : email;
  const tokens = source.split(/[\s@._-]+/).filter(Boolean);
  if (tokens.length === 0) {
    return "NA";
  }
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return `${tokens[0].charAt(0)}${tokens[1].charAt(0)}`.toUpperCase();
}
