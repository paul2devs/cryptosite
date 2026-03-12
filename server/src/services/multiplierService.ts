import { Op } from "sequelize";
import { ActiveMultiplier } from "../models/ActiveMultiplier";
import { User } from "../models/User";

const DEFAULT_MAX_STACKED_MULTIPLIER = 2;
const DEFAULT_DIMINISHING_FACTOR = 0.5;

function getMaxStackedMultiplier(): number {
  const raw = process.env.MULTIPLIER_MAX_STACKED;
  if (!raw) {
    return DEFAULT_MAX_STACKED_MULTIPLIER;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_STACKED_MULTIPLIER;
  }
  return parsed;
}

function getDiminishingFactor(): number {
  const raw = process.env.MULTIPLIER_DIMINISHING_FACTOR;
  if (!raw) {
    return DEFAULT_DIMINISHING_FACTOR;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DIMINISHING_FACTOR;
  }
  return parsed;
}

export async function getUserActiveMultiplierFactor(userId: string): Promise<number> {
  const now = new Date();
  const multipliers = await ActiveMultiplier.findAll({
    where: {
      user_id: userId,
      expires_at: { [Op.gt]: now }
    }
  });

  if (multipliers.length === 0) {
    return 1;
  }

  const sum = multipliers.reduce((acc, m) => acc + m.value, 0);
  if (sum <= 0) {
    return 1;
  }

  const diminishingFactor = getDiminishingFactor();
  const adjusted = sum / (1 + diminishingFactor * sum);
  const capped = Math.min(adjusted, getMaxStackedMultiplier() - 1);
  return 1 + Math.max(0, capped);
}

export async function grantTemporaryMultiplier(
  params: {
    user: User;
    type: "time_limited" | "referral" | "loyalty" | "retention" | "risk_adjustment";
    value: number;
    durationMinutes: number;
  }
): Promise<void> {
  const expiresAt = new Date(Date.now() + params.durationMinutes * 60 * 1000);
  await ActiveMultiplier.create({
    user_id: params.user.user_id,
    type: params.type,
    value: params.value,
    expires_at: expiresAt
  });
}

export async function cleanExpiredMultipliers(): Promise<number> {
  const now = new Date();
  const result = await ActiveMultiplier.destroy({
    where: {
      expires_at: {
        [Op.lte]: now
      }
    }
  });
  return result;
}

