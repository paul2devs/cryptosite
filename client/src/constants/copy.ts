/**
 * Centralised user-facing copy.
 *
 * Repeated platform text lives here so terminology, disclosures, statuses and
 * error messages stay consistent across the product. The rules this module
 * encodes:
 *
 *  - One meaning per financial term. Promotional bonuses are never called
 *    "profit" or "earnings"; pending deposits are never called "confirmed
 *    funds"; unrealised value is never called "withdrawable cash"; projected
 *    figures are never presented as earned returns.
 *  - No unsupported claims. We do not assert audits, certifications,
 *    partnerships, regulatory status, insurance, fund protection, trading
 *    activity or guaranteed outcomes that the platform cannot evidence.
 *  - Clear, professional, transparent, concise, human and trustworthy in tone.
 */

export const BRAND = {
  name: "NexaCrypto",
  positioning: "Digital Asset Investment Platform",
  description:
    "NexaCrypto is a digital asset investment platform designed to help users manage their digital asset portfolios, explore investment opportunities and monitor their account activity.",
  tagline: "Manage your digital asset portfolio with clarity.",
  supportEmail: "support@nexacrypto.app",
  telegram: "https://t.me/+17624566897",
  x: "https://x.com/nexo",
  /**
   * Official X/Twitter handle. Leave empty until the account is configured so
   * `twitter:site` is only emitted once a real account exists.
   */
  twitterHandle: "",
  /**
   * Canonical production origin. Referral links and static metadata resolve
   * against this value; local development keeps the live window origin so the
   * invite code still round-trips through the local registration flow.
   */
  url: "https://nexocrypto.org"
} as const;

/**
 * Default keyword set for public pages. Kept factual and aligned with the
 * official positioning; never claims regulatory status or guaranteed returns.
 */
export const DEFAULT_KEYWORDS = [
  "nexacrypto",
  "digital asset investment platform",
  "digital asset portfolio",
  "portfolio management",
  "investment management",
  "digital asset wallet",
  "account security",
  "investment performance"
] as const;

/**
 * Canonical labels for recurring financial concepts. Use these instead of
 * ad-hoc synonyms so every screen uses the same word for the same thing.
 */
export const TERMINOLOGY = {
  /** Promotional credit granted by a campaign, never trading profit. */
  promotionalBonus: "Promotional bonus",
  /** Gains produced by independently verified activity. */
  tradingProfit: "Trading profit",
  /** A deposit submitted but not yet confirmed on-chain. */
  pendingDeposit: "Pending deposit",
  /** Balance that has been independently confirmed on-chain. */
  confirmedBalance: "Confirmed balance",
  /** Value that can move with the market and is not yet realised. */
  unrealisedValue: "Unrealised value",
  /** Balance that can actually be withdrawn under the platform rules. */
  withdrawableBalance: "Withdrawable balance",
  /** A modelled projection, never a promise of future results. */
  illustrativeProjection: "Projected performance"
} as const;

/**
 * Standing disclosures. Reuse these verbatim wherever a screen or message could
 * otherwise imply a guarantee, an audited status or an instant payout.
 */
export const DISCLOSURES = {
  platformWallets:
    "NexaCrypto is a digital asset investment platform: the assets you deposit are held in platform-operated wallets and every balance is tracked in your account ledger.",
  noGuarantee:
    "Nothing on this platform is a promise of future returns. Projected figures are shown for context and are never credited as earnings.",
  depositsNotCredited:
    "Funds appear only after it's verifies the transaction on-chain.",
  onChainVerification:
    "Every deposit is verified on-chain before it is credited. Until that verification completes, the deposit remains pending.",
  illustrativeProjectionOnly:
    "Projected figures only. A modelled rate applied to deposited principal is not a guaranteed or manufactured return and is never credited. Only independently verified valuations produce reportable performance.",
  rateSource:
    "Conversion rates come from the platform's configured market data provider and are refreshed automatically. Rates are never hardcoded.",
  wrongNetworkRisk:
    "Only send the selected asset on the selected network. Transfers sent on another network or to an incorrect address may be permanently lost."
} as const;

/**
 * The standing "what we do not claim" list. Published once on the dedicated
 * disclosures page rather than repeated inline in every marketing section.
 */
export const NOT_CLAIMED = [
  "No guaranteed returns, and no fixed income.",
  "Promotional credits are never presented as trading profit.",
  "Unrealised market value is not withdrawable cash.",
  "No audit, insurance or regulatory status we cannot evidence.",
  "No published performance figures unless they are verified.",
  "No automatic payout or renewal, and no fixed rate, term or maturity per level.",
  "No unconditional withdrawal: every request is reviewed."
] as const;

/**
 * Shared empty-state copy. Keeping these together prevents each list from
 * inventing its own tone and length.
 */
export const EMPTY_STATES = {
  noTransactions: {
    title: "No transactions yet",
    description: "Your confirmed deposits, withdrawals and account activity will appear here."
  },
  noDeposits: {
    title: "No deposits yet",
    description: "Once you submit a deposit it will appear here while it is verified on-chain."
  },
  noWithdrawals: {
    title: "No withdrawals yet",
    description: "Submitted withdrawal requests and their status will appear here."
  },
  noNotifications: {
    title: "No notifications",
    description: "Account updates and verification results will be shown here."
  }
} as const;

/**
 * Standard error messages for shared failure modes. Prefer these over
 * generic, technical or blame-oriented phrasing.
 */
export const ERRORS = {
  generic: "Something went wrong. Please try again.",
  rateUnavailable: {
    title: "Current conversion pricing is temporarily unavailable. Please try again shortly.",
    body: ""
  },
  rateStale: {
    title: "This exchange rate is out of date.",
    body: "The last rate we received is too old to price a conversion. Refresh the rate to continue."
  },
  addressUnavailable: "Deposit addresses are unavailable right now. Please refresh and try again."
} as const;

/**
 * Step 3 (estimated conversion) status copy. The conversion is always an
 * estimate: it prices the deposit at the current rate and is never presented as
 * the final credited amount.
 */
export const DEPOSIT_CONVERSION = {
  fetching: "Fetching current exchange rate...",
  retry: "Retry",
  cachedNote:
    "Showing a cached rate. Live pricing is temporarily unavailable, so this rate may be slightly out of date.",
  estimateNote:
    "This is an estimate based on the current rate. The final amount is confirmed once your deposit is verified on-chain."
} as const;
