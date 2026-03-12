import { Op } from "sequelize";
import { Bonus } from "../models/Bonus";
import { setCachedJson, getCachedJson } from "../config/cache";
import { getDynamicBonusFactor } from "./bonusOptimizationService";

const ACTIVE_BONUS_CACHE_KEY = "bonuses:active";
const ACTIVE_BONUS_TTL_SECONDS = 15;

export async function getActiveBonuses(): Promise<Bonus[]> {
  const now = new Date();
  const cached = await getCachedJson<BonusAttributesSerialized[]>(
    ACTIVE_BONUS_CACHE_KEY
  );
  if (cached) {
    return cached.map(deserializeBonus);
  }

  const bonuses = await Bonus.findAll({
    where: {
      start_time: { [Op.lte]: now },
      end_time: { [Op.gt]: now }
    },
    order: [["multiplier", "DESC"]]
  });

  await setCachedJson(
    ACTIVE_BONUS_CACHE_KEY,
    bonuses.map(serializeBonus),
    ACTIVE_BONUS_TTL_SECONDS
  );

  return bonuses;
}

export async function getActiveBonusMultiplierForCrypto(
  cryptoType: string
): Promise<number> {
  const bonuses = await getActiveBonuses();
  if (bonuses.length === 0) {
    return 1;
  }
  const applicable = bonuses.filter((b) => {
    const conditions = (b.conditions as any) || {};
    const allowedAssets: string[] | undefined = conditions.assets;
    if (!allowedAssets || allowedAssets.length === 0) {
      return true;
    }
    return allowedAssets.includes(cryptoType);
  });

  if (applicable.length === 0) {
    return 1;
  }

  const base = applicable.reduce((acc, b) => acc * b.multiplier, 1);
  const dynamic = await getDynamicBonusFactor();
  return base * dynamic;
}

export async function getPublicActiveBonuses(): Promise<
  Array<{
    bonus_id: string;
    label: string;
    multiplier: number;
    start_time: string;
    end_time: string;
  }>
> {
  const bonuses = await getActiveBonuses();
  return bonuses.map((b) => ({
    bonus_id: b.bonus_id,
    label: b.label,
    multiplier: b.multiplier,
    start_time: b.start_time.toISOString(),
    end_time: b.end_time.toISOString()
  }));
}

interface BonusAttributesSerialized {
  bonus_id: string;
  type: string;
  label: string;
  multiplier: number;
  start_time: string;
  end_time: string;
  conditions: unknown;
  is_active: boolean;
}

function serializeBonus(b: Bonus): BonusAttributesSerialized {
  return {
    bonus_id: b.bonus_id,
    type: b.type,
    label: b.label,
    multiplier: b.multiplier,
    start_time: b.start_time.toISOString(),
    end_time: b.end_time.toISOString(),
    conditions: b.conditions,
    is_active: b.is_active
  };
}

function deserializeBonus(attrs: BonusAttributesSerialized): Bonus {
  return Bonus.build({
    bonus_id: attrs.bonus_id,
    type: attrs.type as any,
    label: attrs.label,
    multiplier: attrs.multiplier,
    start_time: new Date(attrs.start_time),
    end_time: new Date(attrs.end_time),
    conditions: attrs.conditions,
    is_active: attrs.is_active
  });
}

