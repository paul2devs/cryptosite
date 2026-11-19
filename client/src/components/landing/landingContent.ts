import btcLogo from "../../assets/crypto/btc.svg";
import ethLogo from "../../assets/crypto/eth.svg";
import solLogo from "../../assets/crypto/sol.svg";
import usdtLogo from "../../assets/crypto/usdt.svg";

/**
 * Facts and copy for the public landing page.
 *
 * Every figure below mirrors the actual platform configuration so the marketing
 * site cannot drift from the product. Sources:
 *  - Deposit assets / networks: server/src/domain/depositRules.ts
 *  - Deposit USD range: server/src/domain/depositQuote.ts (100 – 100,000)
 *  - Membership tiers and benefits: server/src/services/membershipService.ts
 *  - Investment levels: server/src/services/investmentLevelService.ts
 *  - Rewards and multipliers: server/src/services/gamificationService.ts,
 *    bonusService.ts and multiplierService.ts
 *  - Performance reporting: server/src/services/performanceEngineService.ts
 *
 * Nothing here describes a feature that is not implemented, and nothing here
 * promises a financial outcome. Deposit-based progression is a platform
 * mechanic; promotional rewards are credits; performance can rise or fall.
 */

/**
 * Navigation targets for the public site. The list is intentionally short,
 * mirroring the narrative sections rather than every feature.
 */
export const LANDING_SECTIONS = [
  { id: "opportunity", label: "How it works" },
  { id: "platform", label: "Platform" },
  { id: "membership", label: "Membership" },
  { id: "assets", label: "Assets" },
  { id: "faq", label: "FAQ" }
] as const;

export interface SupportedAsset {
  symbol: "BTC" | "ETH" | "SOL" | "USDT";
  name: string;
  logo: string;
  networks: string[];
  description: string;
}

export const SUPPORTED_ASSETS: SupportedAsset[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    logo: btcLogo,
    networks: ["Bitcoin"],
    description: "Deposited on the Bitcoin network and verified on-chain before it is credited."
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    logo: ethLogo,
    networks: ["Ethereum"],
    description: "Deposited on the Ethereum network and verified on-chain before it is credited."
  },
  {
    symbol: "SOL",
    name: "Solana",
    logo: solLogo,
    networks: ["Solana"],
    description: "Deposited on the Solana network and verified on-chain before it is credited."
  },
  {
    symbol: "USDT",
    name: "Tether",
    logo: usdtLogo,
    networks: ["Ethereum (ERC20)", "TRON (TRC20)"],
    description: "Available on two networks. Always use the network shown with your deposit address."
  }
];

export const MARKET_SYMBOLS = ["BTC", "ETH", "SOL", "USDT"] as const;

export const DEPOSIT_USD_MIN = 100;
export const DEPOSIT_USD_MAX = 100_000;

/**
 * The four connected parts of the platform. These are shown as a woven system
 * rather than as separate feature cards, because each one depends on the next.
 */
export interface OpportunityPillar {
  index: string;
  label: string;
  title: string;
  detail: string;
}

export const OPPORTUNITY_PILLARS: OpportunityPillar[] = [
  {
    index: "01",
    label: "Participation",
    title: "Put supported crypto to work in a structured account.",
    detail:
      "Deposit BTC, ETH, SOL or USDT and your capital is recorded as a confirmed balance, allocated to your investment account and tracked from that point forward. Every deposit is priced at the live rate and verified on-chain before it counts."
  },
  {
    index: "02",
    label: "Progression",
    title: "Two independent tracks reward what you actually deposit.",
    detail:
      "Membership tiers follow the USD value of your confirmed deposits, from Bronze at $100 to Private Client at $100,000. Investment levels track invested principal across ten stages. Each track unlocks its own benefits and neither one is a market return."
  },
  {
    index: "03",
    label: "Rewards",
    title: "Promotional and referral credits you can redeem.",
    detail:
      "Campaign bonuses, activity streaks and referral rewards are earned under their published conditions, credited to a separate rewards balance and redeemed into your account on request. They are promotional credits, never trading profit."
  },
  {
    index: "04",
    label: "Oversight",
    title: "One place to see prices, activity and standing.",
    detail:
      "Live market prices, a ledger-backed transaction history, withdrawal status stages and non-identifying leaderboards give you a single, honest view of your account as it develops."
  }
];

/**
 * The distinct balances a member can hold. Keeping these separate is the core
 * of the platform's honesty: principal, allocated capital, recorded
 * performance, promotional credits and withdrawable funds are never merged
 * into one misleading number.
 */
export interface GrowthLayer {
  label: string;
  value: string;
  detail: string;
}

export const GROWTH_LAYERS: GrowthLayer[] = [
  {
    label: "Deposited principal",
    value: "What you put in",
    detail:
      "The USD value of your confirmed deposits. This is the figure that determines your membership tier."
  },
  {
    label: "Allocated capital",
    value: "What is at work",
    detail:
      "Principal placed into your investment participation and tracked against your investment level."
  },
  {
    label: "Investment profit or loss",
    value: "What the market did",
    detail:
      "Where performance is recorded, it is calculated from your account records against the market price of the assets held. It can rise or fall and is reported separately from your capital."
  },
  {
    label: "Promotional rewards",
    value: "What the platform granted",
    detail:
      "Campaign, streak and referral credits earned under published conditions and redeemable into your balance. Never presented as investment return."
  },
  {
    label: "Membership progression",
    value: "Where you stand",
    detail:
      "Your tier and the amount remaining to the next tier, updated as your confirmed deposits change over time."
  },
  {
    label: "Withdrawable balance",
    value: "What you can move",
    detail:
      "The funds you can actually withdraw under the published rules, net of any disclosed maturity period and applicable fees."
  }
];

/**
 * The surface areas of the signed-in product. Used by the platform section to
 * present large interface previews rather than a grid of feature cards.
 */
export interface PlatformView {
  id: string;
  label: string;
  title: string;
  body: string;
}

export const PLATFORM_VIEWS: PlatformView[] = [
  {
    id: "portfolio",
    label: "Portfolio",
    title: "Your holdings, priced live.",
    body:
      "Every asset you deposit is listed with its current market price and 24-hour movement, refreshed automatically from the platform's market data provider."
  },
  {
    id: "transactions",
    label: "Transactions",
    title: "Every movement, with its status.",
    body:
      "Deposits and withdrawals pass through named stages, from requested or verifying through to processing, credited or completed, and each item can be opened to inspect its record."
  },
  {
    id: "performance",
    label: "Performance",
    title: "Performance, separated from principal.",
    body:
      "Where performance is recorded, it is reported against the market price of the assets held and shown apart from your deposited capital, so a gain or a loss is never confused with a deposit."
  },
  {
    id: "progression",
    label: "Progression",
    title: "Your standing, in one view.",
    body:
      "Membership tier, progress to the next tier, investment level and eligible rewards sit together, so you always know what your account has earned you."
  }
];

export interface MembershipTier {
  name: string;
  thresholdLabel: string;
  emblemClass: string;
  summary: string;
}

export const MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    name: "Bronze",
    thresholdLabel: "From $100",
    emblemClass: "emblem-bronze",
    summary: "Discounted platform fees and a welcome promotional credit the moment membership begins."
  },
  {
    name: "Silver",
    thresholdLabel: "From $1,000",
    emblemClass: "emblem-silver",
    summary: "Raised withdrawal limits and reduced withdrawal fees across every supported network."
  },
  {
    name: "Gold",
    thresholdLabel: "From $5,000",
    emblemClass: "emblem-gold",
    summary: "An elevated rewards multiplier plus first access to new promotional campaigns."
  },
  {
    name: "Platinum",
    thresholdLabel: "From $20,000",
    emblemClass: "emblem-platinum",
    summary: "A dedicated account specialist and expedited payouts on approved withdrawals."
  },
  {
    name: "Diamond",
    thresholdLabel: "From $50,000",
    emblemClass: "emblem-diamond",
    summary: "Higher reward rates and increased withdrawal ceilings for high-value accounts."
  },
  {
    name: "Private Client",
    thresholdLabel: "From $100,000",
    emblemClass: "emblem-private",
    summary: "The private client desk, with the highest limits, the lowest fee schedule and a scheduled relationship review."
  }
];

export const INVESTMENT_LEVEL_FACTS = [
  { label: "Levels", value: "1 – 10" },
  { label: "Qualification", value: "Invested principal" },
  { label: "Level 1 from", value: "$1,000 invested principal" },
  { label: "Level 10 from", value: "$25,000 invested principal" }
];

/**
 * The platform's investment options.
 *
 * NexaCrypto does not sell fixed-return "plans". Investable capital is
 * structured into ten investment levels, each reached once approved,
 * on-chain verified invested principal passes its threshold, and each
 * unlocking an account benefit that grows in value as you climb. The values
 * below mirror the live configuration in
 * `server/src/services/investmentLevelService.ts` (DEFAULT_LEVELS and
 * DEFAULT_BENEFITS) so the public site cannot drift from the product.
 *
 * The benefits are platform privileges: fee schedules, limits, processing
 * priority, reward rates and service access. Nothing here is a return, a
 * rate or a duration. The levels unlock account benefits; investment value
 * is derived from the market price of the assets held and can rise or fall
 * (see `server/src/domain/performanceRules.ts`).
 */
export interface InvestmentLevelOption {
  levelNumber: number;
  name: string;
  description: string;
  thresholdUsd: number;
  unlock: {
    name: string;
    description: string;
    requiresActivation: boolean;
  };
}

export const INVESTMENT_LEVELS: InvestmentLevelOption[] = [
  {
    levelNumber: 1,
    name: "Level 1",
    description: "Entry level. Reduced platform fees on everything you deposit and withdraw.",
    thresholdUsd: 1_000,
    unlock: {
      name: "Fee-advantaged account",
      description:
        "Your deposits and withdrawals are processed on a reduced fee schedule, so a smaller share of every movement is consumed by platform charges.",
      requiresActivation: false
    }
  },
  {
    levelNumber: 2,
    name: "Level 2",
    description: "Priority handling as your deposits verify on-chain, so funds land sooner.",
    thresholdUsd: 3_000,
    unlock: {
      name: "Priority deposit verification",
      description:
        "Your deposits are queued ahead of standard on-chain verification, so confirmed funds and updated invested principal reach your account faster.",
      requiresActivation: false
    }
  },
  {
    levelNumber: 3,
    name: "Level 3",
    description: "A higher withdrawal allowance for larger and more frequent payouts.",
    thresholdUsd: 5_000,
    unlock: {
      name: "Higher withdrawal allowance",
      description:
        "Your daily and per-transaction withdrawal limits are raised, giving you more headroom to move funds whenever you need them.",
      requiresActivation: false
    }
  },
  {
    levelNumber: 4,
    name: "Level 4",
    description: "Discounted withdrawal fees across every supported network.",
    thresholdUsd: 7_000,
    unlock: {
      name: "Reduced withdrawal fees",
      description:
        "Network and platform fees on withdrawals are discounted at your level, so more of each payout arrives at your destination address.",
      requiresActivation: false
    }
  },
  {
    levelNumber: 5,
    name: "Level 5",
    description: "An accelerated rewards rate on the deposits that qualify.",
    thresholdUsd: 10_000,
    unlock: {
      name: "Rewards accelerator",
      description:
        "Qualifying deposits earn an elevated promotional reward rate, accelerating the credits added to your rewards balance. Activate it to enroll in the acceleration programme.",
      requiresActivation: true
    }
  },
  {
    levelNumber: 6,
    name: "Level 6",
    description: "First access to every new promotional campaign before general release.",
    thresholdUsd: 12_000,
    unlock: {
      name: "Early access to bonus campaigns",
      description:
        "New campaigns open to you before general release, so you can capture the strongest available reward conditions first.",
      requiresActivation: false
    }
  },
  {
    levelNumber: 7,
    name: "Level 7",
    description: "Your approved withdrawals move to the front of the broadcast queue.",
    thresholdUsd: 15_000,
    unlock: {
      name: "Priority payout queue",
      description:
        "Approved withdrawals are placed at the front of the broadcast queue, shortening the wait between your request and the on-chain transaction.",
      requiresActivation: false
    }
  },
  {
    levelNumber: 8,
    name: "Level 8",
    description: "A named specialist assigned to guide your allocation and account planning.",
    thresholdUsd: 18_000,
    unlock: {
      name: "Dedicated account strategist",
      description:
        "A named specialist is assigned to your account for allocation guidance and account planning. Activate it to book your first strategy session.",
      requiresActivation: true
    }
  },
  {
    levelNumber: 9,
    name: "Level 9",
    description: "Increased commissions on every referral you invite to the platform.",
    thresholdUsd: 22_000,
    unlock: {
      name: "Elevated referral commissions",
      description:
        "Referrals you invite are rewarded at an increased commission rate, so your network contributes more to your rewards balance.",
      requiresActivation: false
    }
  },
  {
    levelNumber: 10,
    name: "Level 10",
    description: "The platform's most complete service tier, with maximum limits and the lowest fees.",
    thresholdUsd: 25_000,
    unlock: {
      name: "Private client desk",
      description:
        "Maximum limits, the lowest available fee schedule and a private client desk for direct, priority assistance.",
      requiresActivation: false
    }
  }
];

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "what-is-nexacrypto",
    question: "What is NexaCrypto?",
    answer:
      "NexaCrypto is a digital asset investment platform. You deposit supported crypto, the platform verifies each deposit on-chain before crediting it, and you manage your balances, membership progression, investment levels and eligible rewards from a single dashboard."
  },
  {
    id: "what-can-i-do",
    question: "What can I actually do on the platform?",
    answer:
      "Deposit supported assets, hold a confirmed balance that is tracked in a ledger, participate in the platform's investment mechanism where it applies to your account, progress through membership tiers and investment levels, earn promotional and referral rewards, track performance where it is recorded, and request withdrawals against your eligible balance."
  },
  {
    id: "supported-assets",
    question: "Which cryptocurrencies can I deposit?",
    answer:
      "Bitcoin (BTC), Ethereum (ETH), Solana (SOL), and Tether (USDT) on the Ethereum (ERC20) and TRON (TRC20) networks. The exact asset and network available to you is shown in the deposit flow."
  },
  {
    id: "how-to-deposit",
    question: "How do I make a deposit?",
    answer:
      "Open the Deposit page, choose an asset and network, enter the amount you want to deposit in USD, review the live conversion, then send the displayed cryptocurrency amount to the deposit address shown. Finally, submit the transaction hash so the payment can be matched."
  },
  {
    id: "conversion",
    question: "How is the deposit amount converted into cryptocurrency?",
    answer:
      "You enter an amount in USD and the platform calculates the cryptocurrency equivalent using its configured market data provider, the same live pricing service used across the app. The rate, its source and the last-updated time are shown, and rates are never hardcoded."
  },
  {
    id: "verification",
    question: "How are deposits verified?",
    answer:
      "After you submit a transaction hash, the platform checks the relevant blockchain for the correct asset, network, destination address and confirmations. The deposit is credited only after verification completes; until then it stays pending."
  },
  {
    id: "investment-levels",
    question: "What are investment levels?",
    answer:
      "Investment levels are a separate progression track from membership. There are ten levels, and they are determined by invested principal rather than by total deposits. Level 1 begins from $1,000 of invested principal and Level 10 from $25,000. Your current level and progress to the next are shown in your account."
  },
  {
    id: "membership",
    question: "How do membership tiers work?",
    answer:
      "Membership tiers are determined by the USD value of your confirmed deposits, from Bronze at $100 up to Private Client at $100,000. Each tier unlocks specific benefits, and your progress to the next tier is shown in your account. Tiers do not downgrade."
  },
  {
    id: "rewards",
    question: "How do rewards work?",
    answer:
      "Promotional and referral rewards are earned under their published conditions. When a reward qualifies it is credited to your rewards balance, and you can redeem it into your account balance. Rewards are promotional credits and are not trading profits."
  },
  {
    id: "multiplier",
    question: "What is the multiplier?",
    answer:
      "The multiplier is a promotional and progression score, not a market return. It responds to your level, your consecutive active-day streak, deposit timing, qualifying referrals and any active campaign, and it applies to the modelled pending value recorded when a deposit is confirmed. Temporary boosts combine with diminishing effect and are capped, and a multiplier never changes the market price of an asset you hold."
  },
  {
    id: "performance",
    question: "How is investment performance calculated?",
    answer:
      "Where performance is recorded, it is calculated from your account records against the market price of the assets held, and it is displayed separately from your deposited capital. Performance can rise or fall and is not guaranteed."
  },
  {
    id: "withdrawals",
    question: "How do withdrawals work?",
    answer:
      "You request a withdrawal against your eligible balance. Eligibility depends on your confirmed balance, any disclosed maturity period that applies to funds you received, applicable fees and account review. Requested, under-review, processing and completed stages are shown in your account."
  },
  {
    id: "maturity",
    question: "What are the investment maturity requirements?",
    answer:
      "Some funds may be received under a disclosed holding period. When that applies, the maturity date and remaining time are shown in your account, and the funds become withdrawable once the period elapses. When no such period applies, the platform states that plainly."
  },
  {
    id: "security",
    question: "How are deposits and accounts secured?",
    answer:
      "Deposit addresses are issued from platform-operated wallets and bound to a specific asset and network, and the deposit flow states which network to use. Deposits are verified against the relevant blockchain before credit, and a transaction hash alone never credits a balance. Sign-in uses short-lived access tokens with rotating refresh tokens, and passwords are stored as salted hashes. Account movements are written to a ledger so balances can be reconciled against the underlying activity."
  },
  {
    id: "leaderboards",
    question: "Are my balances or activity public?",
    answer:
      "No. Leaderboards rank non-identifying account aliases only. Balances, personal details and full account history are never published, and referral activity is visible only inside your own account."
  },
  {
    id: "delayed-transactions",
    question: "What happens if a transaction is delayed?",
    answer:
      "Blockchain networks can be congested, so a transfer may take time to confirm. A deposit stays pending until it is verified. If a transaction cannot be matched automatically, it is flagged for review, and you can track its status in your account."
  },
  {
    id: "support",
    question: "How can I contact support?",
    answer:
      "Use the support option in your account or email our team. Support requests from members on higher tiers are routed through a priority queue."
  }
];
