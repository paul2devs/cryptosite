"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformWallets = getPlatformWallets;
const env_1 = require("../config/env");
let cachedWallets = null;
function loadWalletsFromEnv() {
    const btc = (0, env_1.requireEnv)("BTC_DEPOSIT_ADDRESS");
    const eth = (0, env_1.requireEnv)("ETH_DEPOSIT_ADDRESS");
    const sol = (0, env_1.requireEnv)("SOL_DEPOSIT_ADDRESS");
    const usdtTrc20 = (0, env_1.requireEnv)("USDT_TRC20_DEPOSIT_ADDRESS");
    const usdtErc20 = (0, env_1.requireEnv)("USDT_ERC20_DEPOSIT_ADDRESS");
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
function getPlatformWallets() {
    if (!cachedWallets) {
        cachedWallets = loadWalletsFromEnv();
    }
    return cachedWallets;
}
