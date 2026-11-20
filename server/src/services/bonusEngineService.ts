import { UniqueConstraintError } from "sequelize";
import {
  BONUS_AMOUNT_SCALE,
  BONUS_CREDIT_ACCOUNT,
  BONUS_PERCENT_SCALE,
  BONUS_SOURCE_ACCOUNT,
  BONUS_SOURCE_TYPE,
  BONUS_TRANSACTION_TYPE,
  calculatePromotionalBonus,
  fallbackCampaign,
  resolveBonusCampaign,
  type BonusCampaignRules,
  type BonusEvaluationInput
} from "../domain/bonusRules";
import { formatDecimal, parseDecimal } from "../domain/money";
import { buildLedgerIdempotencyKey } from "../domain/ledgerRules";
import { generateReference } from "../domain/transactionRules";
import { AdminAuditLog } from "../models/AdminAuditLog";
import { BonusCampaign } from "../models/BonusCampaign";
import { BonusCredit } from "../models/BonusCredit";
import { Deposit } from "../models/Deposit";
import { InvestmentPosition } from "../models/InvestmentPosition";
import { LedgerEntry } from "../models/LedgerEntry";
import { User } from "../models/User";
import { UserMembership } from "../models/UserMembership";
import { notifyFinancialEvent } from "./financialNotificationService";
import { trackUserActivity } from "./activityService";
import { postBalancedEntry } from "./financialOperationsService";
import { getBonusSettings } from "./platformSettingsService";

export interface BonusCreditResult {
  credited: boolean;
  creditId: string | null;
  campaignId: string | null;
  campaignName: string;
  percentage: string;
  bonusAmount: string;
  asset: string;
  reference: string;
}

function normalizeDecimal(value: unknown, scale: number): string {
  return formatDecimal(parseDecimal(String(value), scale), scale);
}

function toRules(campaign: BonusCampaign): BonusCampaignRules {
  return {
    campaignId: campaign.campaign_id,
    name: campaign.name,
    percentage: normalizeDecimal(campaign.percentage, BONUS_PERCENT_SCALE),
    minDeposit: normalizeDecimal(campaign.min_deposit, BONUS_AMOUNT_SCALE),
    maxBonus: campaign.max_bonus === null ? null : normalizeDecimal(campaign.max_bonus, BONUS_AMOUNT_SCALE),
    eligibleAssets: campaign.eligible_assets,
    startsAt: campaign.starts_at ? new Date(campaign.starts_at).toISOString() : null,
    endsAt: campaign.ends_at ? new Date(campaign.ends_at).toISOString() : null,
    active: campaign.active,
    priority: campaign.priority,
    eligibility: campaign.eligibility ?? {}
  };
}

async function activeCampaignRules(): Promise<BonusCampaignRules[]> {
  const [campaigns, settings] = await Promise.all([
    BonusCampaign.findAll({ where: { active: true }, order: [["priority", "DESC"]] }),
    getBonusSettings()
  ]);
  const rules = campaigns.map(toRules);
  if (rules.length > 0) return rules;
  if (!settings.active) return [];
  return [
    fallbackCampaign({
      percentage: settings.percentage,
      minDeposit: settings.minDeposit,
      maxBonus: settings.maxBonus,
      eligibleAssets: settings.eligibleAssets
    })
  ];
}

async function evaluationInputFor(deposit: Deposit): Promise<BonusEvaluationInput | null> {
  const user = await User.findByPk(deposit.user_id);
  if (!user) return null;
  const [membership, positions] = await Promise.all([
    UserMembership.findByPk(user.user_id),
    InvestmentPosition.findAll({ where: { user_id: user.user_id } })
  ]);
  const invested = positions.reduce(
    (total, position) => total + parseDecimal(String(position.principal), BONUS_AMOUNT_SCALE),
    0n
  );
  const at = deposit.confirmed_at ? new Date(deposit.confirmed_at) : new Date(deposit.approved_at ?? new Date());
  return {
    amount: Number(deposit.amount).toFixed(BONUS_AMOUNT_SCALE),
    asset: deposit.crypto_type,
    at: at.toISOString(),
    accountCreatedAt: user.created_at ? new Date(user.created_at).toISOString() : null,
    investedAmount: formatDecimal(invested, BONUS_AMOUNT_SCALE),
    hasReferral: Boolean(user.referred_by),
    membershipTierId: membership?.tier_id ?? null
  };
}

// Credits the eligible promotional bonus for a single, independently verified and
// confirmed deposit. The bonus is posted as its own ledger transaction into the
// promotional_credits account, so it is never counted as deposited principal or
// trading profit. A unique deposit_id plus a stable ledger idempotency key make
// repeated confirmations safe: the bonus can only ever be credited once.
export async function creditPromotionalBonus(deposit: Deposit): Promise<BonusCreditResult | null> {
  if (deposit.status !== "Approved" || !deposit.confirmed_at) return null;

  const existing = await BonusCredit.findOne({ where: { deposit_id: deposit.deposit_id } });
  if (existing) {
    return {
      credited: false,
      creditId: existing.credit_id,
      campaignId: existing.campaign_id,
      campaignName: existing.campaign_name,
      percentage: existing.percentage,
      bonusAmount: existing.bonus_amount,
      asset: existing.asset,
      reference: existing.reference
    };
  }

  const [rules, input] = await Promise.all([activeCampaignRules(), evaluationInputFor(deposit)]);
  if (!input || rules.length === 0) return null;

  const decision = resolveBonusCampaign(rules, input);
  if (!decision) return null;

  const bonusAmount = calculatePromotionalBonus({
    amount: input.amount,
    percentage: decision.campaign.percentage,
    maxBonus: decision.campaign.maxBonus
  });
  const amountUnits = BigInt(Math.round(Number(bonusAmount) * 10 ** BONUS_AMOUNT_SCALE));
  if (amountUnits <= 0n) return null;

  const reference = generateReference(BONUS_SOURCE_TYPE, deposit.deposit_id);
  const ledgerKey = buildLedgerIdempotencyKey(BONUS_SOURCE_TYPE, deposit.deposit_id, BONUS_CREDIT_ACCOUNT);

  let credit: BonusCredit;
  try {
    credit = await BonusCredit.create({
      user_id: deposit.user_id,
      deposit_id: deposit.deposit_id,
      campaign_id: decision.campaign.campaignId === "default" ? null : decision.campaign.campaignId,
      campaign_name: decision.campaign.name,
      percentage: decision.campaign.percentage,
      qualifying_amount: input.amount,
      bonus_amount: bonusAmount,
      asset: deposit.crypto_type,
      status: "credited",
      reference,
      ledger_idempotency_key: ledgerKey,
      reason: `Automated ${decision.campaign.name} promotional bonus on deposit ${deposit.deposit_id}.`
    });
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      const duplicate = await BonusCredit.findOne({ where: { deposit_id: deposit.deposit_id } });
      if (!duplicate) return null;
      return {
        credited: false,
        creditId: duplicate.credit_id,
        campaignId: duplicate.campaign_id,
        campaignName: duplicate.campaign_name,
        percentage: duplicate.percentage,
        bonusAmount: duplicate.bonus_amount,
        asset: duplicate.asset,
        reference: duplicate.reference
      };
    }
    throw error;
  }

  await postBalancedEntry({
    userId: deposit.user_id,
    asset: deposit.crypto_type,
    amount: bonusAmount,
    transactionType: BONUS_TRANSACTION_TYPE,
    sourceType: BONUS_SOURCE_TYPE,
    sourceId: deposit.deposit_id,
    debit: BONUS_SOURCE_ACCOUNT,
    credit: BONUS_CREDIT_ACCOUNT
  });

  await AdminAuditLog.create({
    admin_id: deposit.user_id,
    action: "promotional_bonus_credited",
    entity_type: "bonus_credit",
    entity_id: credit.credit_id,
    reason: `Automated promotional bonus for confirmed deposit ${deposit.deposit_id}.`,
    metadata: {
      depositId: deposit.deposit_id,
      campaignId: decision.campaign.campaignId,
      percentage: decision.campaign.percentage,
      qualifyingAmount: input.amount,
      bonusAmount,
      asset: deposit.crypto_type,
      reference,
      automated: true
    }
  });

  await notifyFinancialEvent({
    userId: deposit.user_id,
    type: "promotional_bonus_credited",
    templateKey: "promotionalBonusCredited",
    variables: {
      amount: bonusAmount,
      asset: deposit.crypto_type,
      campaign: decision.campaign.name,
      reference
    },
    fallbackMessage: `Promotional bonus of ${bonusAmount} ${deposit.crypto_type} credited. Reference ${reference}.`,
    email: {
      sourceId: credit.credit_id,
      subject: `Promotional bonus credited: ${bonusAmount} ${deposit.crypto_type}`,
      heading: "Promotional bonus credited",
      preheader: "A promotional bonus has been added to your account.",
      details: [
        { label: "Reference", value: reference },
        { label: "Amount", value: `${bonusAmount} ${deposit.crypto_type}` },
        { label: "Asset", value: deposit.crypto_type },
        { label: "Campaign", value: decision.campaign.name },
        { label: "Date", value: new Date().toISOString() }
      ],
      statusLabel: "Credited",
      statusTone: "positive",
      ctaLabel: "View rewards",
      ctaPath: "/rewards"
    }
  });

  await trackUserActivity(deposit.user_id, "promotional_bonus", {
    credit_id: credit.credit_id,
    deposit_id: deposit.deposit_id,
    campaign_id: decision.campaign.campaignId,
    bonus_amount: bonusAmount,
    asset: deposit.crypto_type,
    reference
  });

  return {
    credited: true,
    creditId: credit.credit_id,
    campaignId: decision.campaign.campaignId,
    campaignName: decision.campaign.name,
    percentage: decision.campaign.percentage,
    bonusAmount,
    asset: deposit.crypto_type,
    reference
  };
}

export interface BonusCampaignInput {
  campaignId?: string;
  name: string;
  description: string;
  percentage: string;
  minDeposit: string;
  maxBonus: string | null;
  eligibleAssets: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  priority: number;
  eligibility: {
    minMembershipTierId?: string | null;
    minInvestedAmount?: string | null;
    newUsersOnly?: boolean;
    requiredReferral?: boolean;
  };
  reason: string;
}

export async function saveBonusCampaign(adminId: string, input: BonusCampaignInput) {
  if (!input.reason.trim()) throw new Error("A reason is required to change a bonus campaign.");
  if (Number(input.percentage) < 0) throw new Error("Bonus percentage cannot be negative.");
  if (Number(input.minDeposit) < 0) throw new Error("Minimum deposit cannot be negative.");
  if (input.maxBonus !== null && Number(input.maxBonus) < 0) throw new Error("Maximum bonus cannot be negative.");
  if (input.startsAt && input.endsAt && new Date(input.startsAt) > new Date(input.endsAt)) {
    throw new Error("The campaign start must be before the campaign end.");
  }
  const payload = {
    name: input.name,
    description: input.description,
    percentage: input.percentage,
    min_deposit: input.minDeposit,
    max_bonus: input.maxBonus,
    eligible_assets: input.eligibleAssets,
    starts_at: input.startsAt ? new Date(input.startsAt) : null,
    ends_at: input.endsAt ? new Date(input.endsAt) : null,
    active: input.active,
    priority: input.priority,
    eligibility: input.eligibility,
    updated_by: adminId
  };
  let campaign: BonusCampaign;
  if (input.campaignId) {
    const existing = await BonusCampaign.findByPk(input.campaignId);
    if (!existing) throw new Error("Bonus campaign not found");
    await existing.update(payload);
    campaign = existing;
  } else {
    campaign = await BonusCampaign.create({ ...payload, created_by: adminId });
  }
  await AdminAuditLog.create({
    admin_id: adminId,
    action: input.campaignId ? "bonus_campaign_updated" : "bonus_campaign_created",
    entity_type: "bonus_campaign",
    entity_id: campaign.campaign_id,
    reason: input.reason,
    metadata: { percentage: input.percentage, minDeposit: input.minDeposit, maxBonus: input.maxBonus, active: input.active }
  });
  return campaign;
}

export async function deactivateBonusCampaign(adminId: string, campaignId: string, reason: string) {
  if (!reason.trim()) throw new Error("A reason is required to deactivate a bonus campaign.");
  const campaign = await BonusCampaign.findByPk(campaignId);
  if (!campaign) throw new Error("Bonus campaign not found");
  campaign.active = false;
  campaign.updated_by = adminId;
  await campaign.save();
  await AdminAuditLog.create({
    admin_id: adminId,
    action: "bonus_campaign_deactivated",
    entity_type: "bonus_campaign",
    entity_id: campaign.campaign_id,
    reason,
    metadata: { name: campaign.name }
  });
  return campaign;
}

export async function deleteBonusCampaign(campaignId: string) {
  const campaign = await BonusCampaign.findByPk(campaignId);
  if (!campaign) throw new Error("Bonus campaign not found");
  await campaign.destroy();
}

export async function listBonusCampaigns() {
  return BonusCampaign.findAll({ order: [["active", "DESC"], ["priority", "DESC"], ["created_at", "DESC"]] });
}

// Seeds a single default campaign from the platform settings when no campaign has
// been configured yet, so the configurable bonus engine is live out of the box and
// visible in the admin console.
export async function ensureDefaultBonusCampaign(): Promise<void> {
  const existing = await BonusCampaign.count();
  if (existing > 0) return;
  const settings = await getBonusSettings();
  if (!settings.active) return;
  await BonusCampaign.create({
    name: "Standard promotional bonus",
    description: settings.campaignDescription,
    percentage: settings.percentage,
    min_deposit: settings.minDeposit,
    max_bonus: settings.maxBonus,
    eligible_assets: settings.eligibleAssets,
    starts_at: null,
    ends_at: null,
    active: true,
    priority: 0,
    eligibility: {},
    created_by: null,
    updated_by: null
  });
}

export async function listBonusCredits(query: { page?: number; pageSize?: number; userId?: string; campaignId?: string }) {
  const page = Math.max(1, Number(query.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 25)));
  const where: Record<string, unknown> = {};
  if (query.userId) where.user_id = query.userId;
  if (query.campaignId) where.campaign_id = query.campaignId;
  const { rows, count } = await BonusCredit.findAndCountAll({
    where,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    order: [["created_at", "DESC"]]
  });
  return { page, pageSize, total: count, credits: rows };
}

export async function bonusAdminSummary() {
  const [campaigns, credits, totalCredited] = await Promise.all([
    BonusCampaign.findAll({ order: [["priority", "DESC"], ["created_at", "DESC"]] }),
    BonusCredit.findAll({ order: [["created_at", "DESC"]], limit: 100 }),
    BonusCredit.findAll({ where: { status: "credited" } })
  ]);
  const total = totalCredited.reduce((sum, credit) => sum + Number(credit.bonus_amount), 0);
  return {
    campaigns: campaigns.map((campaign) => ({
      campaignId: campaign.campaign_id,
      name: campaign.name,
      description: campaign.description,
      percentage: String(campaign.percentage),
      minDeposit: String(campaign.min_deposit),
      maxBonus: campaign.max_bonus === null ? null : String(campaign.max_bonus),
      eligibleAssets: campaign.eligible_assets,
      startsAt: campaign.starts_at,
      endsAt: campaign.ends_at,
      active: campaign.active,
      priority: campaign.priority,
      eligibility: campaign.eligibility,
      createdAt: campaign.created_at
    })),
    recentCredits: credits.map((credit) => ({
      creditId: credit.credit_id,
      userId: credit.user_id,
      depositId: credit.deposit_id,
      campaignName: credit.campaign_name,
      percentage: String(credit.percentage),
      qualifyingAmount: String(credit.qualifying_amount),
      bonusAmount: String(credit.bonus_amount),
      asset: credit.asset,
      status: credit.status,
      reference: credit.reference,
      createdAt: credit.created_at
    })),
    totals: {
      creditCount: totalCredited.length,
      totalCredited: total.toFixed(BONUS_AMOUNT_SCALE)
    }
  };
}

// Compares every recorded bonus credit against the authoritative ledger so a bonus
// can never exist without a balanced promotional_credits entry, and flags confirmed
// deposits that should have received an eligible bonus but did not.
export async function reconcileBonuses(adminId: string, userId?: string) {
  const creditWhere: Record<string, unknown> = { status: "credited" };
  if (userId) creditWhere.user_id = userId;
  const depositWhere: Record<string, unknown> = { status: "Approved" };
  if (userId) depositWhere.user_id = userId;

  const [credits, deposits, ledgerEntries] = await Promise.all([
    BonusCredit.findAll({ where: creditWhere }),
    Deposit.findAll({ where: depositWhere }),
    LedgerEntry.findAll({ where: { transaction_type: BONUS_TRANSACTION_TYPE } })
  ]);

  const ledgerKeys = new Set(ledgerEntries.map((entry) => entry.idempotency_key));
  const creditDepositIds = new Set(credits.map((credit) => credit.deposit_id));
  const issues: Array<{ code: string; reference: string; detail: string }> = [];

  for (const credit of credits) {
    const expectedKey = buildLedgerIdempotencyKey(BONUS_SOURCE_TYPE, credit.deposit_id, BONUS_CREDIT_ACCOUNT);
    if (!ledgerKeys.has(expectedKey)) {
      issues.push({
        code: "bonus_without_ledger_entry",
        reference: credit.reference,
        detail: "Bonus credit has no matching promotional_credits ledger entry."
      });
    }
  }

  for (const entry of ledgerEntries) {
    if (!creditDepositIds.has(entry.source_id) && (!userId || entry.user_id === userId)) {
      issues.push({
        code: "ledger_bonus_without_credit",
        reference: generateReference(BONUS_SOURCE_TYPE, entry.source_id),
        detail: "Ledger holds a promotional bonus entry without a matching bonus credit record."
      });
    }
  }

  const rules = await activeCampaignRules();
  for (const deposit of deposits) {
    if (creditDepositIds.has(deposit.deposit_id)) continue;
    if (rules.length === 0) continue;
    const input = await evaluationInputFor(deposit);
    if (!input) continue;
    const decision = resolveBonusCampaign(rules, input);
    if (!decision) continue;
    issues.push({
      code: "confirmed_deposit_without_bonus",
      reference: generateReference("deposit", deposit.deposit_id),
      detail: `Confirmed deposit ${deposit.deposit_id} is eligible for a ${decision.campaign.name} bonus but no bonus credit was recorded.`
    });
  }

  await AdminAuditLog.create({
    admin_id: adminId,
    action: "bonus_reconciliation",
    entity_type: "bonus_credit",
    entity_id: userId ?? "all",
    reason: `Bonus reconciliation${userId ? ` for user ${userId}` : ""}`,
    metadata: { creditsChecked: credits.length, depositsChecked: deposits.length, issues }
  });

  return {
    scope: userId ?? "all",
    creditsChecked: credits.length,
    depositsChecked: deposits.length,
    mismatched: issues.length,
    issues
  };
}

export async function bonusHistoryForUser(userId: string) {
  const credits = await BonusCredit.findAll({ where: { user_id: userId }, order: [["created_at", "DESC"]] });
  return credits.map((credit) => ({
    creditId: credit.credit_id,
    campaignName: credit.campaign_name,
    percentage: String(credit.percentage),
    qualifyingAmount: String(credit.qualifying_amount),
    bonusAmount: String(credit.bonus_amount),
    asset: credit.asset,
    status: credit.status,
    reference: credit.reference,
    createdAt: credit.created_at,
    depositId: credit.deposit_id
  }));
}

export async function bonusTotalsForUser(userId: string) {
  const credits = await BonusCredit.findAll({ where: { user_id: userId, status: "credited" } });
  const total = credits.reduce((sum, credit) => sum + Number(credit.bonus_amount), 0);
  return { count: credits.length, total: total.toFixed(BONUS_AMOUNT_SCALE) };
}
