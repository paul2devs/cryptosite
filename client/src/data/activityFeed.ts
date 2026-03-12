export type ActivityEventType =
  | "deposit"
  | "level_up"
  | "multiplier"
  | "earning";

export interface ActivityEvent {
  id: string;
  userName: string;
  type: ActivityEventType;
  amountUsd?: number;
  description: string;
}

const STORAGE_KEY = "activityFeedSeen";

export const activityFeed: ActivityEvent[] = [
  {
    id: "activity-ali-deposit-3000",
    userName: "Ali",
    type: "deposit",
    amountUsd: 3000,
    description: "Ali deposited $3,000"
  },
  {
    id: "activity-james-level-3",
    userName: "James",
    type: "level_up",
    description: "James reached Level 3"
  },
  {
    id: "activity-sarah-multiplier",
    userName: "Sarah",
    type: "multiplier",
    description: "Sarah activated a new multiplier"
  },
  {
    id: "activity-victor-earning-150",
    userName: "Victor",
    type: "earning",
    amountUsd: 150,
    description: "Victor earned $150 from rewards"
  },
  {
    id: "activity-maria-deposit-7000",
    userName: "Maria",
    type: "deposit",
    amountUsd: 7000,
    description: "Maria deposited $7,000"
  }
];

function readSeenIds(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Set();
    }
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) {
      return new Set();
    }
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const arr = Array.from(ids);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // ignore storage errors to avoid blocking UI
  }
}

export function getRandomUnseenActivityEvent(): ActivityEvent | null {
  const seen = readSeenIds();
  const unseen = activityFeed.filter((event) => !seen.has(event.id));
  if (unseen.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * unseen.length);
  return unseen[index];
}

export function markActivityEventSeen(id: string): void {
  const seen = readSeenIds();
  if (seen.has(id)) {
    return;
  }
  seen.add(id);
  writeSeenIds(seen);
}

