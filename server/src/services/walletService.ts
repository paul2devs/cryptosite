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

/**
 * Environment variable that carries the receiving address for each asset.
 *
 * The mapping lives here (not inline in the loader) so the deposit surface and
 * the missing-configuration diagnostics always agree on the same names.
 */
export const DEPOSIT_ADDRESS_ENV_BY_ASSET: Record<SupportedPlatformAsset, string> = {
  BTC: "BTC_DEPOSIT_ADDRESS",
  ETH: "ETH_DEPOSIT_ADDRESS",
  SOL: "SOL_DEPOSIT_ADDRESS",
  USDT_TRC20: "USDT_TRC20_DEPOSIT_ADDRESS",
  USDT_ERC20: "USDT_ERC20_DEPOSIT_ADDRESS"
};

/** Network label stored on a deposit for each asset. */
const NETWORK_BY_ASSET: Record<SupportedPlatformAsset, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "SOL",
  USDT_TRC20: "TRC20",
  USDT_ERC20: "ERC20"
};

let cachedWallets: PlatformWalletConfig[] | null = null;

function readAddress(envName: string): string | null {
  const raw = process.env[envName];
  if (!raw) {
    return null;
  }
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve the configured receiving addresses.
 *
 * A missing address is skipped rather than thrown: one unconfigured asset must
 * never break the whole deposit surface. Callers that need a specific asset use
 * `getPlatformWallet` and report a clean "method unavailable" for the assets
 * that are genuinely not configured.
 */
export function getPlatformWallets(): PlatformWalletConfig[] {
  if (!cachedWallets) {
    const wallets: PlatformWalletConfig[] = [];
    for (const asset of Object.keys(DEPOSIT_ADDRESS_ENV_BY_ASSET) as SupportedPlatformAsset[]) {
      const address = readAddress(DEPOSIT_ADDRESS_ENV_BY_ASSET[asset]);
      if (!address) {
        continue;
      }
      wallets.push({ asset, address, network: NETWORK_BY_ASSET[asset] });
    }
    cachedWallets = wallets;
  }
  return cachedWallets;
}

export function getPlatformWallet(
  asset: SupportedPlatformAsset
): PlatformWalletConfig | null {
  return getPlatformWallets().find((wallet) => wallet.asset === asset) ?? null;
}

/** Names of the receiving-address environment variables that are not set. */
export function missingDepositAddressEnv(): string[] {
  return (Object.keys(DEPOSIT_ADDRESS_ENV_BY_ASSET) as SupportedPlatformAsset[])
    .filter((asset) => !readAddress(DEPOSIT_ADDRESS_ENV_BY_ASSET[asset]))
    .map((asset) => DEPOSIT_ADDRESS_ENV_BY_ASSET[asset]);
}

/** Clears the memoised addresses so tests can vary the environment. */
export function resetPlatformWalletCache(): void {
  cachedWallets = null;
}
