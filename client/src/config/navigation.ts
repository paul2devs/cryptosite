import type { LucideIcon } from "lucide-react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Crown,
  Gift,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  ReceiptText,
  Settings,
  Share2,
  TrendingUp,
  Trophy,
  Wallet
} from "lucide-react";

export interface NavItem {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  path: string;
  hash?: string;
  icon: LucideIcon;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "main",
    label: "Main",
    items: [
      {
        id: "overview",
        labelKey: "nav_overview",
        fallbackLabel: "Overview",
        path: "/",
        icon: LayoutDashboard
      },
      {
        id: "portfolio",
        labelKey: "nav_portfolio",
        fallbackLabel: "Portfolio",
        path: "/portfolio",
        icon: Wallet
      },
      {
        id: "performance",
        labelKey: "nav_performance",
        fallbackLabel: "Performance",
        path: "/performance",
        icon: LineChart
      },
      {
        id: "deposit",
        labelKey: "nav_deposit",
        fallbackLabel: "Deposit",
        path: "/deposit",
        icon: ArrowDownToLine
      },
      {
        id: "withdraw",
        labelKey: "nav_withdraw",
        fallbackLabel: "Withdraw",
        path: "/withdraw",
        icon: ArrowUpFromLine
      },
      {
        id: "transactions",
        labelKey: "nav_transactions",
        fallbackLabel: "Transactions",
        path: "/transactions",
        icon: ReceiptText
      }
    ]
  },
  {
    id: "growth",
    label: "Growth",
    items: [
      {
        id: "membership",
        labelKey: "nav_membership",
        fallbackLabel: "Membership",
        path: "/membership",
        icon: Crown
      },
      {
        id: "investment-levels",
        labelKey: "nav_levels",
        fallbackLabel: "Investment Levels",
        path: "/investment-levels",
        icon: TrendingUp
      },
      {
        id: "rewards",
        labelKey: "nav_rewards",
        fallbackLabel: "Rewards",
        path: "/rewards",
        icon: Gift
      }
    ]
  },
  {
    id: "community",
    label: "Community",
    items: [
      {
        id: "leaderboard",
        labelKey: "nav_leaderboard",
        fallbackLabel: "Leaderboard",
        path: "/leaderboards",
        icon: Trophy
      },
      {
        id: "referrals",
        labelKey: "nav_referrals",
        fallbackLabel: "Referrals",
        path: "/referrals",
        icon: Share2
      }
    ]
  }
];

export const FOOTER_NAV_ITEMS: NavItem[] = [
  {
    id: "settings",
    labelKey: "nav_settings",
    fallbackLabel: "Settings",
    path: "/settings",
    icon: Settings
  },
  {
    id: "help",
    labelKey: "nav_help",
    fallbackLabel: "Help & Support",
    path: "/settings",
    hash: "#support",
    icon: LifeBuoy
  }
];

export const MOBILE_PRIMARY_NAV_IDS = ["overview", "portfolio", "deposit", "withdraw"];

export const ALL_NAV_ITEMS: NavItem[] = [
  ...NAV_GROUPS.flatMap((group) => group.items),
  ...FOOTER_NAV_ITEMS
];

export const PAGE_TITLES: Array<{ match: (pathname: string) => boolean; title: string }> = [
  { match: (pathname) => pathname === "/", title: "Overview" },
  { match: (pathname) => pathname.startsWith("/portfolio"), title: "Portfolio" },
  { match: (pathname) => pathname.startsWith("/performance"), title: "Performance" },
  { match: (pathname) => pathname.startsWith("/membership"), title: "Membership" },
  { match: (pathname) => pathname.startsWith("/investment-levels"), title: "Investment Levels" },
  { match: (pathname) => pathname.startsWith("/rewards"), title: "Rewards" },
  { match: (pathname) => pathname.startsWith("/deposit"), title: "Deposit" },
  { match: (pathname) => pathname.startsWith("/withdraw"), title: "Withdraw" },
  { match: (pathname) => pathname.startsWith("/transactions"), title: "Transactions" },
  { match: (pathname) => pathname.startsWith("/leaderboards"), title: "Leaderboard" },
  { match: (pathname) => pathname.startsWith("/referrals"), title: "Referrals" },
  { match: (pathname) => pathname.startsWith("/settings"), title: "Settings" },
  { match: (pathname) => pathname.startsWith("/admin/operations"), title: "Operations" },
  { match: (pathname) => pathname.startsWith("/admin/analytics"), title: "Analytics" },
  { match: (pathname) => pathname.startsWith("/admin"), title: "Platform" }
];

export function getPageTitle(pathname: string): string {
  const match = PAGE_TITLES.find((entry) => entry.match(pathname));
  return match ? match.title : "Overview";
}

export function isNavItemActive(item: NavItem, pathname: string, hash: string): boolean {
  if (item.path !== pathname) {
    return false;
  }
  if (item.hash) {
    return hash === item.hash;
  }
  if (item.path === "/") {
    return hash.length === 0;
  }
  return true;
}

export function getNavItemTarget(item: NavItem): string {
  return item.hash ? `${item.path}${item.hash}` : item.path;
}

export function getNavLabel(t: (key: string) => string, item: NavItem): string {
  const translated = t(item.labelKey);
  return translated === item.labelKey ? item.fallbackLabel : translated;
}
