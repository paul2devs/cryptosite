import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, X } from "lucide-react";
import {
  Section,
  SectionHeader,
  Panel,
  ProgressBar,
  EmptyState,
  SkeletonBlock,
  ErrorRow
} from "../dashboard/primitives";
import { useBalanceVisibility } from "../BalanceVisibilityProvider";
import { formatNumber, formatPercent, formatUsd } from "../../utils/format";
import { getAssetMeta } from "./assetMeta";
import { maskValue } from "./utils";
import type { PortfolioHoldingView } from "../../hooks/usePortfolioData";

const DEPOSIT_ASSET_PARAM: Record<string, string> = {
  BTC: "BTC",
  ETH: "ETH",
  SOL: "SOL",
  USDT: "ERC20"
};

function depositHref(symbol: string): string {
  const asset = DEPOSIT_ASSET_PARAM[symbol];
  return asset ? `/deposit?asset=${asset}` : "/deposit";
}

function HoldingDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-[#9CA3AF]">{label}</span>
      <span className="financial-figure text-xs font-medium text-[#F5F5F7]">{value}</span>
    </div>
  );
}

function HoldingDrawer({
  holding,
  onClose
}: {
  holding: PortfolioHoldingView | null;
  onClose: () => void;
}) {
  const { hidden } = useBalanceVisibility();

  useEffect(() => {
    if (!holding) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [holding, onClose]);

  if (!holding) {
    return null;
  }

  const meta = getAssetMeta(holding.symbol);

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close asset details"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${meta.name} holding details`}
        className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto surface-strong px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src={meta.logo}
              alt={meta.name}
              className="h-9 w-9 rounded-full"
              loading="lazy"
            />
            <div>
              <p className="text-sm font-medium text-[#F5F5F7]">{meta.name}</p>
              <p className="text-[11px] text-[#6B7280]">{holding.symbol}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full border border-[#26272B] bg-[#17181A] p-1.5 text-[#9CA3AF] transition-colors hover:text-[#F5F5F7]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <HoldingDetailRow
            label="Quantity"
            value={`${formatNumber(holding.quantity, 8)} ${holding.symbol}`}
          />
          <HoldingDetailRow label="Current price" value={formatUsd(holding.price)} />
          <HoldingDetailRow
            label="Value"
            value={maskValue(hidden, formatUsd(holding.value))}
          />
          <HoldingDetailRow
            label="Profit / loss"
            value="Unavailable"
          />
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between text-[11px] text-[#9CA3AF]">
            <span>Allocation</span>
            <span className="financial-figure text-[#F5F5F7]">
              {formatPercent(holding.allocationPercent)}
            </span>
          </div>
          <ProgressBar value={holding.allocationPercent} className="mt-2" />
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-[#9CA3AF]">
          Per-asset profit and loss requires a recorded cost basis, which is not available for this
          position. Your portfolio-level unrealised result is reported in the performance breakdown.
        </p>

        <Link
          to={depositHref(holding.symbol)}
          className="mt-5 inline-flex items-center justify-center gap-1.5 rounded-full bg-[#C6A15B] px-4 py-2 text-xs font-medium text-[#0F0F10] transition-colors hover:bg-[#B08F4F]"
        >
          Add to {holding.symbol} position
        </Link>
      </div>
    </div>
  );
}

const DESKTOP_GRID =
  "grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1.3fr)] gap-3";

export function AssetHoldingsTable({
  holdings,
  loading,
  error,
  onRetry
}: {
  holdings: PortfolioHoldingView[];
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
}) {
  const { hidden } = useBalanceVisibility();
  const [active, setActive] = useState<PortfolioHoldingView | null>(null);

  return (
    <Section id="portfolio-holdings">
      <SectionHeader
        title="Asset holdings"
        description="Live quantities, prices and allocation for each asset you hold."
      />
      <Panel className="mt-4 p-0">
        {loading && holdings.length === 0 ? (
          <div className="space-y-3 px-5 py-5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <SkeletonBlock className="h-7 w-32" />
                <SkeletonBlock className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : error && holdings.length === 0 ? (
          <div className="p-4">
            <ErrorRow message={error} onRetry={onRetry} />
          </div>
        ) : holdings.length === 0 ? (
          <div className="px-5 py-6">
            <EmptyState
              title="No assets in your portfolio yet."
              description="Once a deposit is confirmed, your holdings and live valuation appear here."
              action={
                <Link
                  to="/deposit"
                  className="inline-flex items-center rounded-full bg-[#C6A15B] px-4 py-1.5 text-xs font-medium text-[#0F0F10]"
                >
                  Make a deposit
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className={`hidden md:block ${DESKTOP_GRID} border-b border-[#26272B] px-5 py-3 text-[10px] uppercase tracking-[0.14em] text-[#6B7280]`}>
              <span>Asset</span>
              <span className="text-right">Quantity</span>
              <span className="text-right">Current price</span>
              <span className="text-right">Value</span>
              <span className="text-right">P/L</span>
              <span>Allocation</span>
            </div>

            <div className="hidden md:block">
              {holdings.map((holding) => {
                const meta = getAssetMeta(holding.symbol);
                return (
                  <button
                    key={holding.symbol}
                    type="button"
                    onClick={() => setActive(holding)}
                    className={`w-full ${DESKTOP_GRID} items-center border-b border-[#26272B]/60 px-5 py-3 text-left transition-colors hover:bg-[#1F2023]`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <img src={meta.logo} alt={meta.name} className="h-7 w-7 rounded-full" loading="lazy" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-[#F5F5F7]">{meta.name}</p>
                        <p className="text-[10px] text-[#6B7280]">{holding.symbol}</p>
                      </div>
                    </div>
                    <span className="financial-figure text-right text-xs text-[#F5F5F7]">
                      {formatNumber(holding.quantity, 8)}
                    </span>
                    <span className="financial-figure text-right text-xs text-[#F5F5F7]">
                      {formatUsd(holding.price)}
                    </span>
                    <span className="financial-figure text-right text-xs font-medium text-[#F5F5F7]">
                      {maskValue(hidden, formatUsd(holding.value))}
                    </span>
                    <span className="text-right text-xs text-[#6B7280]">Unavailable</span>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={holding.allocationPercent} className="flex-1" />
                      <span className="financial-figure w-12 shrink-0 text-right text-[11px] text-[#9CA3AF]">
                        {formatPercent(holding.allocationPercent, { decimals: 1 })}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" aria-hidden="true" />
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="divide-y divide-[#26272B]/60 md:hidden">
              {holdings.map((holding) => {
                const meta = getAssetMeta(holding.symbol);
                return (
                  <button
                    key={holding.symbol}
                    type="button"
                    onClick={() => setActive(holding)}
                    className="block w-full px-4 py-4 text-left transition-colors hover:bg-[#1F2023]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <img src={meta.logo} alt={meta.name} className="h-8 w-8 rounded-full" loading="lazy" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#F5F5F7]">{meta.name}</p>
                          <p className="text-[10px] text-[#6B7280]">{holding.symbol}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="financial-figure text-sm font-medium text-[#F5F5F7]">
                          {maskValue(hidden, formatUsd(holding.value))}
                        </p>
                        <p className="text-[10px] text-[#9CA3AF]">
                          {formatPercent(holding.allocationPercent, { decimals: 1 })} allocation
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-[11px]">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-[#6B7280]">Quantity</p>
                        <p className="financial-figure mt-0.5 text-[#F5F5F7]">
                          {formatNumber(holding.quantity, 8)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-[#6B7280]">Price</p>
                        <p className="financial-figure mt-0.5 text-[#F5F5F7]">
                          {formatUsd(holding.price)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.12em] text-[#6B7280]">P/L</p>
                        <p className="mt-0.5 text-[#6B7280]">Unavailable</p>
                      </div>
                    </div>
                    <ProgressBar value={holding.allocationPercent} className="mt-3" />
                  </button>
                );
              })}
            </div>

            <p className="px-5 py-3 text-[11px] leading-relaxed text-[#9CA3AF]">
              Per-asset profit and loss requires a recorded cost basis and is shown as unavailable
              when none exists.
            </p>
          </>
        )}
      </Panel>

      <HoldingDrawer holding={active} onClose={() => setActive(null)} />
    </Section>
  );
}
