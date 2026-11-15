/**
 * Demonstration activity for the live activity banner.
 *
 * We do not yet have a base of real accounts generating genuine level
 * advancements, so the banner cycles through demonstration activity for the
 * initial development stage. Each entry is shown at most once per device,
 * recorded in localStorage, so a page refresh never replays an entry that has
 * already been seen.
 *
 * The copy mirrors the investment-level and membership-tier benefits defined
 * in `server/src/services/investmentLevelService.ts` and
 * `server/src/services/membershipService.ts`.
 */

export interface DemoActivity {
  id: string;
  message: string;
}

export const DEMO_ACTIVITY: DemoActivity[] = [
  {
    id: "demo-level-2-deposit",
    message: "a member advanced to Level 2 after making an additional deposit."
  },
  {
    id: "demo-level-3-verification",
    message: "a member reached Level 3 and unlocked priority deposit verification."
  },
  {
    id: "demo-silver-membership",
    message: "a member joined the Silver membership tier and unlocked raised withdrawal limits."
  },
  {
    id: "demo-level-4-fees",
    message: "a member advanced to Level 4 and unlocked discounted withdrawal fees."
  },
  {
    id: "demo-level-5-accelerator",
    message: "a member reached Level 5 and activated the rewards accelerator."
  },
  {
    id: "demo-gold-membership",
    message: "a member joined the Gold membership tier and unlocked early campaign access."
  },
  {
    id: "demo-level-7-payouts",
    message: "a member advanced to Level 7 and unlocked the priority payout queue."
  },
  {
    id: "demo-platinum-membership",
    message: "a member reached the Platinum membership tier and was assigned a dedicated specialist."
  },
  {
    id: "demo-level-9-referrals",
    message: "a member advanced to Level 9 and unlocked elevated referral commissions."
  },
  {
    id: "demo-level-10-private-client",
    message: "a member reached Level 10 and unlocked the private client desk."
  }
];

const STORAGE_KEY = "demoActivity.seen.v1";

export function loadSeenDemoActivity(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as { seen?: string[] };
    return new Set(parsed.seen ?? []);
  } catch {
    return new Set();
  }
}

export function markDemoActivitySeen(id: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const seen = loadSeenDemoActivity();
    if (seen.has(id)) {
      return;
    }
    seen.add(id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ seen: Array.from(seen) }));
  } catch {
    return;
  }
}
