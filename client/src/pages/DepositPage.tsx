import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Seo } from "../components/Seo";
import {
  Panel,
  SectionHeader,
  ErrorRow,
  StatStrip,
  Stat
} from "../components/dashboard/primitives";
import { SolidCheck, SolidShield } from "../components/icons/SolidIcons";
import { useDepositData } from "../hooks/useDepositData";
import { useLiveMarket, type LiveMarketSymbol } from "../hooks/useLiveMarket";
import { formatNumber, formatUsd, truncateMiddle } from "../utils/format";
import {
  cryptoTypeFromAssetParam,
  defaultCryptoTypeForSymbol,
  depositReference,
  getNetworkOption,
  symbolForCryptoType,
  validateAmountInput,
  validateTxHashInput,
  type CryptoType,
  type DepositSymbol
} from "../utils/deposit";
import { DepositPageHeader } from "../components/deposit/DepositPageHeader";
import { DepositStepper, type DepositStep } from "../components/deposit/DepositStepper";
import { AssetSelector } from "../components/deposit/AssetSelector";
import { NetworkSelector } from "../components/deposit/NetworkSelector";
import { DepositAmountInput } from "../components/deposit/DepositAmountInput";
import { TransactionHashInput } from "../components/deposit/TransactionHashInput";
import { DepositInstructions } from "../components/deposit/DepositInstructions";
import { DepositHistory } from "../components/deposit/DepositHistory";
import { DepositLoadingSkeleton } from "../components/deposit/DepositLoadingSkeleton";
import { DepositVerificationStatus } from "../components/deposit/DepositVerificationStatus";

const MARKET_SYMBOLS: LiveMarketSymbol[] = ["BTC", "ETH", "SOL", "USDT"];
const LAST_STEP = 5;

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

function ReviewRow({
  label,
  value,
  mono = false
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="shrink-0 text-[11px] text-[#9CA3AF]">{label}</span>
      <span
        className={`min-w-0 break-all text-right text-[11px] text-[#F5F5F7] ${
          mono ? "font-mono" : "financial-figure"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export function DepositPage() {
  const [searchParams] = useSearchParams();
  const initialCryptoType = cryptoTypeFromAssetParam(searchParams.get("asset"));
  const initialSymbol: DepositSymbol = initialCryptoType
    ? symbolForCryptoType(initialCryptoType)
    : "BTC";

  const [step, setStep] = useState(0);
  const [symbol, setSymbol] = useState<DepositSymbol>(initialSymbol);
  const [cryptoType, setCryptoType] = useState<CryptoType>(
    initialCryptoType ?? defaultCryptoTypeForSymbol(initialSymbol)
  );
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  const {
    addresses,
    deposits,
    account,
    loading,
    depositsLoading,
    addressesError,
    accountError,
    depositsError,
    submitting,
    submitDeposit,
    refresh
  } = useDepositData();

  const { data: market, loading: marketLoading, error: marketError } = useLiveMarket(MARKET_SYMBOLS);

  const option = getNetworkOption(cryptoType);
  const usdPrice = market[symbol]?.price ?? null;

  const address = useMemo(
    () => addresses.find((item) => item.asset === option.platformAsset) ?? null,
    [addresses, option.platformAsset]
  );

  const amountValidation = validateAmountInput(amount, option.decimals);
  const txValidation = validateTxHashInput(txHash);

  const parsedAmount = Number(amount);
  const amountValueUsd =
    amountValidation.valid && usdPrice !== null && usdPrice > 0 ? parsedAmount * usdPrice : null;

  const lastSubmittedDeposit = successId
    ? deposits.find((deposit) => deposit.deposit_id === successId) ?? null
    : null;

  const steps: DepositStep[] = [
    { id: "asset", label: "Asset", state: step > 0 ? "done" : "active" },
    {
      id: "network",
      label: "Network",
      state: step > 1 ? "done" : step === 1 ? "active" : "upcoming"
    },
    {
      id: "amount",
      label: "Amount",
      state: step > 2 ? "done" : step === 2 ? "active" : "upcoming"
    },
    {
      id: "address",
      label: "Address",
      state: step > 3 ? "done" : step === 3 ? "active" : "upcoming"
    },
    {
      id: "hash",
      label: "Tx hash",
      state: step > 4 ? "done" : step === 4 ? "active" : "upcoming"
    },
    {
      id: "submit",
      label: "Submit",
      state: lastSubmittedDeposit ? "done" : step === LAST_STEP ? "active" : "upcoming"
    }
  ];

  const canAdvance = (() => {
    if (submitting) {
      return false;
    }
    if (step === 2) {
      return amountValidation.valid;
    }
    if (step === 3) {
      return address !== null;
    }
    if (step === 4) {
      return txValidation.valid;
    }
    return true;
  })();

  const canSubmit =
    address !== null && amountValidation.valid && txValidation.valid && !submitting;

  const handleSelectSymbol = (nextSymbol: DepositSymbol) => {
    if (nextSymbol === symbol) {
      return;
    }
    setSymbol(nextSymbol);
    setCryptoType(defaultCryptoTypeForSymbol(nextSymbol));
    setAmount("");
    setTxHash("");
    setFormError(null);
    setSuccessId(null);
  };

  const handleChangeNetwork = (nextCryptoType: CryptoType) => {
    if (nextCryptoType === cryptoType) {
      return;
    }
    setCryptoType(nextCryptoType);
    setAmount("");
    setTxHash("");
    setFormError(null);
    setSuccessId(null);
  };

  const goNext = () => {
    setFormError(null);
    setStep((current) => Math.min(LAST_STEP, current + 1));
  };

  const goBack = () => {
    setFormError(null);
    setStep((current) => Math.max(0, current - 1));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!address) {
      setFormError("Deposit addresses are unavailable right now. Please refresh and try again.");
      return;
    }
    if (!amountValidation.valid) {
      setFormError(amountValidation.message ?? "Enter a valid deposit amount.");
      return;
    }
    if (!txValidation.valid) {
      setFormError(txValidation.message ?? "Enter a valid transaction hash.");
      return;
    }
    try {
      const created = await submitDeposit({
        crypto_type: cryptoType,
        amount: parsedAmount,
        tx_hash: txHash.trim()
      });
      setSuccessId(created.deposit_id);
      setAmount("");
      setTxHash("");
    } catch (error) {
      setFormError(
        extractMessage(
          error,
          "We could not submit your deposit. Please check the details and try again."
        )
      );
    }
  };

  const showSkeleton = loading && addresses.length === 0 && !account;

  const navButtonClass =
    "inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#0F0F10] px-4 py-3 text-sm font-medium text-[#9CA3AF] transition-colors hover:text-[#F5F5F7] disabled:opacity-40";
  const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-[#C6A15B] px-4 py-3 text-sm font-medium text-[#0F0F10] transition-colors hover:bg-[#D4B070] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="page-responsive borderless-ui min-w-0 space-y-8 overflow-x-hidden sm:space-y-10">
      <Seo
        title="Deposit – add funds with verified on-chain payments"
        description="Add funds to your account using supported crypto assets and networks. Every deposit is verified independently on-chain before it is credited."
        path="/deposit"
      />

      <DepositPageHeader
        account={account}
        loading={loading}
        error={accountError}
        busy={loading || depositsLoading}
        onRefresh={refresh}
      />

      {addressesError ? <ErrorRow message={addressesError} onRetry={refresh} /> : null}

      {showSkeleton ? (
        <DepositLoadingSkeleton />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-6">
            <div className="min-w-0">
              <DepositStepper steps={steps} />
            </div>

            <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
              {step === 0 ? (
                <Panel className="space-y-4">
                  <SectionHeader
                    eyebrow="Step 1"
                    title="Select asset"
                    description="Only assets supported by the platform are shown."
                  />
                  <AssetSelector value={symbol} onSelect={handleSelectSymbol} disabled={submitting} />
                </Panel>
              ) : null}

              {step === 1 ? (
                <Panel className="space-y-4">
                  <SectionHeader
                    eyebrow="Step 2"
                    title="Select network"
                    description="Use the exact network shown. Deposits sent on another network cannot be recovered."
                  />
                  <NetworkSelector
                    symbol={symbol}
                    value={cryptoType}
                    onChange={handleChangeNetwork}
                    disabled={submitting}
                  />
                </Panel>
              ) : null}

              {step === 2 ? (
                <Panel className="space-y-5">
                  <SectionHeader
                    eyebrow="Step 3"
                    title="Enter amount"
                    description={`The ${option.symbolLabel} amount you enter is what you send on the ${option.networkLabel} network.`}
                  />
                  <DepositAmountInput
                    option={option}
                    value={amount}
                    onChange={(next) => {
                      setAmount(next);
                      setFormError(null);
                    }}
                    validation={amountValidation}
                    disabled={submitting}
                    usdPrice={usdPrice}
                    priceLoading={marketLoading}
                    priceError={marketError}
                  />
                </Panel>
              ) : null}

              {step === 3 ? (
                <DepositInstructions
                  option={option}
                  address={address}
                  amount={amount}
                  loading={loading}
                  error={addressesError}
                  onRetry={refresh}
                />
              ) : null}

              {step === 4 ? (
                <Panel className="space-y-5">
                  <SectionHeader
                    eyebrow="Step 5"
                    title="Enter transaction hash"
                    description="After sending the funds, paste the on-chain transaction hash so we can verify it."
                  />
                  <TransactionHashInput
                    option={option}
                    value={txHash}
                    onChange={(next) => {
                      setTxHash(next);
                      setFormError(null);
                    }}
                    validation={txValidation}
                    disabled={submitting}
                  />
                </Panel>
              ) : null}

              {step === LAST_STEP ? (
                <Panel className="space-y-5">
                  <SectionHeader
                    eyebrow="Step 6"
                    title="Submit deposit for verification"
                    description="Review the details below. Submitting does not credit your balance — we verify the transaction on-chain first."
                  />

                  <div className="space-y-2 rounded-xl bg-[#0F0F10] px-3 py-3">
                    <ReviewRow label="Asset" value={option.symbolLabel} />
                    <ReviewRow label="Network" value={option.networkLabel} />
                    <ReviewRow
                      label="Amount"
                      value={`${formatNumber(parsedAmount, option.decimals)} ${option.symbolLabel}`}
                    />
                    <ReviewRow
                      label="Transaction hash"
                      value={txHash.trim() ? truncateMiddle(txHash.trim(), 14, 10) : "—"}
                      mono
                    />
                  </div>

                  {formError ? <ErrorRow message={formError} /> : null}

                  {lastSubmittedDeposit ? (
                    <div className="flex gap-2 rounded-xl bg-[#16C784]/8 px-3 py-3">
                      <SolidCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16C784]" />
                      <div className="min-w-0 space-y-0.5 text-[11px] text-[#F5F5F7]">
                        <p className="font-medium">
                          Deposit submitted · {depositReference(lastSubmittedDeposit.deposit_id)}
                        </p>
                        <p className="text-[#9CA3AF]">
                          We are verifying this transaction on-chain. It stays pending until the
                          backend confirms it independently.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-[#6B7280]">
                      Submitting a transaction hash does not credit your balance. Your deposit is
                      only confirmed after the platform verifies it on-chain.
                    </p>
                  )}
                </Panel>
              ) : null}

              {step !== LAST_STEP && formError ? <ErrorRow message={formError} /> : null}

              <div className="buttons-row sm:flex sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0 || submitting}
                  className={navButtonClass}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back
                </button>

                {step < LAST_STEP ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canAdvance}
                    className={primaryButtonClass}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button type="submit" disabled={!canSubmit} className={primaryButtonClass}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <SolidShield className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{submitting ? "Submitting for verification…" : "Submit for verification"}</span>
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="min-w-0 space-y-6 lg:sticky lg:top-6">
            <Panel className="space-y-4">
              <SectionHeader eyebrow="Summary" title="Deposit summary" />
              <StatStrip>
                <Stat label="Asset" value={option.symbolLabel} hint={option.networkLabel} />
                <Stat label="Network" value={option.networkLabel} hint={`${option.networkType} network`} />
                <Stat
                  label="Amount"
                  value={
                    amountValidation.valid
                      ? `${formatNumber(parsedAmount, option.decimals)} ${option.symbolLabel}`
                      : "—"
                  }
                  hint={amountValidation.valid ? "Amount you transfer" : "Enter an amount"}
                />
                <Stat
                  label="Estimated value"
                  value={amountValueUsd !== null ? formatUsd(amountValueUsd) : "—"}
                  hint="Live market estimate"
                />
              </StatStrip>
            </Panel>

            {lastSubmittedDeposit ? (
              <DepositVerificationStatus deposit={lastSubmittedDeposit} />
            ) : null}
          </div>
        </div>
      )}

      <DepositHistory
        deposits={deposits}
        loading={depositsLoading}
        error={depositsError}
        onRetry={refresh}
      />
    </div>
  );
}
