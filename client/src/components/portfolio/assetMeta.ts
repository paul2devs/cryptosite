import bnbLogo from "../../assets/crypto/bnb.svg";
import btcLogo from "../../assets/crypto/btc.svg";
import ethLogo from "../../assets/crypto/eth.svg";
import solLogo from "../../assets/crypto/sol.svg";
import usdtLogo from "../../assets/crypto/usdt.svg";
import xrpLogo from "../../assets/crypto/xrp.svg";

export interface AssetMeta {
  name: string;
  logo: string;
}

export const ASSET_META: Record<string, AssetMeta> = {
  BTC: { name: "Bitcoin", logo: btcLogo },
  ETH: { name: "Ethereum", logo: ethLogo },
  SOL: { name: "Solana", logo: solLogo },
  USDT: { name: "Tether", logo: usdtLogo },
  BNB: { name: "BNB", logo: bnbLogo },
  XRP: { name: "XRP", logo: xrpLogo }
};

const FALLBACK_META: AssetMeta = { name: "Asset", logo: usdtLogo };

export function getAssetMeta(symbol: string): AssetMeta {
  return ASSET_META[symbol] ?? { ...FALLBACK_META, name: symbol };
}

const GOLD_RAMP = ["#C6A15B", "#B08F4F", "#94793F", "#75633A", "#5A4E33", "#3F3930"];

export function getAllocationColor(index: number): string {
  return GOLD_RAMP[index % GOLD_RAMP.length];
}
