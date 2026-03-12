import { requireEnv } from "../config/env";

export type SupportedPlatformAsset =
  | "BTC"
  | "ETH"
  | "SOL"
  | "USDT_TRC20"
  | "USDT_ERC20";

export interface PlatformWalletConfig {
  asset: SupportedPlatformAsset;
  address: string;
  network: string;
}

let cachedWallets: PlatformWalletConfig[] | null = null;

function loadWalletsFromEnv(): PlatformWalletConfig[] {
  const btc = requireEnv("BTC_DEPOSIT_ADDRESS");
  const eth = requireEnv("ETH_DEPOSIT_ADDRESS");
  const sol = requireEnv("SOL_DEPOSIT_ADDRESS");
  const usdtTrc20 = requireEnv("USDT_TRC20_DEPOSIT_ADDRESS");
  const usdtErc20 = requireEnv("USDT_ERC20_DEPOSIT_ADDRESS");

  return [
    {
      asset: "BTC",
      address: btc,
      network: "Bitcoin"
    },
    {
      asset: "ETH",
      address: eth,
      network: "Ethereum"
    },
    {
      asset: "SOL",
      address: sol,
      network: "Solana"
    },
    {
      asset: "USDT_TRC20",
      address: usdtTrc20,
      network: "TRC20"
    },
    {
      asset: "USDT_ERC20",
      address: usdtErc20,
      network: "ERC20"
    }
  ];
}

export function getPlatformWallets(): PlatformWalletConfig[] {
  if (!cachedWallets) {
    cachedWallets = loadWalletsFromEnv();
  }
  return cachedWallets;
}

