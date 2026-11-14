import { FormEvent, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Seo } from "../components/Seo";
import { Panel, SectionHeader, ErrorRow } from "../components/dashboard/primitives";
import { SolidArrowRight, SolidCheck } from "../components/icons/SolidIcons";
import { useWithdrawData } from "../hooks/useWithdrawData";
import { useBalanceVisibility } from "../components/BalanceVisibilityProvider";
import { maskValue } from "../components/portfolio/utils";
import { formatNumber, formatUsd } from "../utils/format";
import {
  estimateWithdrawFees,
  getWithdrawNetworkOption,
  validateWithdrawAddress,
  validateWithdrawAmount,
  withdrawalReference,
  type AddressValidation,
  type AmountValidation,
  type WithdrawCryptoType,
  type WithdrawSymbol
} from "../utils/withdraw";
import { requiredConfirmations } from "../utils/deposit";
import type { WithdrawalRecord } from "../utils/transactions";
import { WithdrawPageHeader } from "../components/withdraw/WithdrawPageHeader";
import { WithdrawEligibilityPanel } from "../components/withdraw/WithdrawEligibilityPanel";
import { MaturityPolicyCard } from "../components/withdraw/MaturityPolicyCard";
import { WithdrawProcessingTimeline } from "../components/withdraw/WithdrawProcessingTimeline";
import {
  WithdrawStepper,
  type WithdrawStep,
  type WithdrawStepState
} from "../components/withdraw/WithdrawStepper";
import { WithdrawAssetSelector } from "../components/withdraw/WithdrawAssetSelector";
import { WithdrawNetworkSelector } from "../components/withdraw/WithdrawNetworkSelector";
import { WithdrawAmountInput } from "../components/withdraw/WithdrawAmountInput";
import { WithdrawDestinationInput } from "../components/withdraw/WithdrawDestinationInput";
import { WithdrawReviewStep } from "../components/withdraw/WithdrawReviewStep";
import { WithdrawalHistory } from "../components/withdraw/WithdrawalHistory";
import { WithdrawalDetailStatus } from "../components/withdraw/WithdrawalDetailStatus";
import { WithdrawLoadingSkeleton } from "../components/withdraw/WithdrawLoadingSkeleton";

const EMPTY_AMOUNT: AmountValidation = { valid: false, empty: true, message: null };
const EMPTY_ADDRESS: AddressValidation = { valid: false, empty: true, message: null };

/** Ordered steps of the withdrawal flow, matching the rendered panels. */
const STEP_LABELS = ["Asset", "Network", "Amount", "Destination", "Review", "Confirm"] as const;
const LAST_STEP = STEP_LABELS.length - 1;

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
}

function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `wd-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function WithdrawPage() {
  const {
    summary,
    withdrawals,
    loading,
    historyLoading,
    summaryError,
    historyError,
    submitting,
    submitWithdrawal,
    refresh,
    refreshHistory
  } = useWithdrawData();

  const { hidden } = useBalanceVisibility();

  const [step, setStep] = useState(0);
  const [symbol, setSymbol] = useState<WithdrawSymbol | null>(null);
  const [cryptoType, setCryptoType] = useState<WithdrawCryptoType | null>(null);
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<WithdrawalRecord | null>(null);
  const idempotencyRef = useRef<string | null>(null);

  const resetIdempotency = () => {
    idempotencyRef.current = null;
  };

  const assets = summary?.supported_assets ?? [];
  const activeSymbol: WithdrawSymbol | null =
    symbol && assets.some((asset) => asset.symbol === symbol)
      ? symbol
      : ((assets[0]?.symbol as WithdrawSymbol | undefined) ?? null);

  const currentAsset = assets.find((asset) => asset.symbol === activeSymbol) ?? null;
  const networks = currentAsset?.networks ?? [];
  const activeCryptoType: WithdrawCryptoType | null =
    cryptoType && networks.some((network) => network.cryptoType === cryptoType)
      ? cryptoType
      : (networks[0]?.cryptoType ?? null);

  const currentNetwork =
    networks.find((network) => network.cryptoType === activeCryptoType) ?? networks[0] ?? null;
  const option = currentNetwork ? getWithdrawNetworkOption(currentNetwork.cryptoType) : null;
  const confirmations = option ? requiredConfirmations(option.cryptoType) : 0;

  const availableBalance = summary
    ? Math.max(
        0,
        summary.withdrawable_balance -
          (summary.maturity.policyInEffect ? summary.maturity.maturingAmount : 0)
      )
    : 0;

  const amountValidation = option ? validateWithdrawAmount(amount, option.decimals) : EMPTY_AMOUNT;
  const addressValidation = option
    ? validateWithdrawAddress(option.cryptoType, address)
    : EMPTY_ADDRESS;

  const parsedAmount = Number(amount);
  const minAmount = currentNetwork?.minAmount ?? 0;
  const maxAmount = currentNetwork?.maxAmount ?? 0;

  const limitMessage = useMemo(() => {
    if (!option || !amountValidation.valid) {
      return null;
    }
    if (parsedAmount > availableBalance) {
      return "Requested amount exceeds your available withdrawal balance.";
    }
    if (minAmount > 0 && parsedAmount < minAmount) {
      return `The minimum withdrawal for ${option.symbolLabel} is ${formatNumber(minAmount, 8)}.`;
    }
    if (maxAmount > 0 && parsedAmount > maxAmount) {
      return `The maximum withdrawal for ${option.symbolLabel} is ${formatNumber(maxAmount, 8)}.`;
    }
    return null;
  }, [option, amountValidation.valid, parsedAmount, availableBalance, minAmount, maxAmount]);

  const fees = estimateWithdrawFees({
    amount: amountValidation.valid ? parsedAmount : 0,
    networkFee: currentNetwork?.networkFee ?? 0,
    platformFeePercent: summary?.platform_fee_percent ?? 0
  });

  const eligible = summary?.eligibility.canWithdraw === true;
  const canAdvanceFromAmount = amountValidation.valid && limitMessage === null;
  const canAdvanceFromDestination = addressValidation.valid;

  const canContinue =
    step === 0
      ? assets.length > 0
      : step === 1
        ? option !== null
        : step === 2
          ? canAdvanceFromAmount
          : step === 3
            ? canAdvanceFromDestination
            : step === 4
              ? eligible && canAdvanceFromAmount && canAdvanceFromDestination
              : false;

  const canSubmit =
    eligible &&
    option !== null &&
    addressValidation.valid &&
    amountValidation.valid &&
    limitMessage === null &&
    fees.netAmount > 0 &&
    confirmed &&
    !submitting;

  const stepState = (index: number): WithdrawStepState =>
    index < step ? "done" : index === step ? "active" : "upcoming";

  const steps: WithdrawStep[] = STEP_LABELS.map((label, index) => ({
    id: label.toLowerCase(),
    label,
    state: stepState(index)
  }));

  const handleSelectSymbol = (nextSymbol: WithdrawSymbol) => {
    if (nextSymbol === activeSymbol) {
      return;
    }
    setSymbol(nextSymbol);
    setCryptoType(null);
    setAddress("");
    setAmount("");
    setConfirmed(false);
    setFormError(null);
    resetIdempotency();
  };

  const handleChangeNetwork = (nextCryptoType: WithdrawCryptoType) => {
    if (nextCryptoType === activeCryptoType) {
      return;
    }
    setCryptoType(nextCryptoType);
    setAddress("");
    setAmount("");
    setConfirmed(false);
    setFormError(null);
    resetIdempotency();
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
    if (!option || !currentNetwork) {
      setFormError("Select a supported asset and network before requesting a withdrawal.");
      return;
    }
    if (!eligible) {
      setFormError("Your account is not currently eligible to withdraw.");
      return;
    }
    if (!addressValidation.valid) {
      setFormError(addressValidation.message ?? "Enter a valid destination address.");
      return;
    }
    if (!amountValidation.valid) {
      setFormError(amountValidation.message ?? "Enter a valid withdrawal amount.");
      return;
    }
    if (limitMessage) {
      setFormError(limitMessage);
      return;
    }
    if (fees.netAmount <= 0) {
      setFormError("Fees exceed the requested amount. Increase the amount to continue.");
      return;
    }
    if (!confirmed) {
      setFormError("Confirm the withdrawal details before submitting.");
      return;
    }

    if (!idempotencyRef.current) {
      idempotencyRef.current = createIdempotencyKey();
    }

    try {
      const created = await submitWithdrawal({
        asset: option.cryptoType,
        network: option.networkType,
        address: address.trim(),
        amount: parsedAmount,
        idempotencyKey: idempotencyRef.current
      });
      setLastSubmitted(created);
      setAmount("");
      setAddress("");
      setConfirmed(false);
      resetIdempotency();
      setStep(0);
    } catch (error) {
      setFormError(
        extractMessage(
          error,
          "We could not submit your withdrawal. Please review the details and try again."
        )
      );
    }
  };

  const showSkeleton = loading && !summary;

  const maturityCondition = summary?.maturity.policyInEffect
    ? `Maturity policy ${summary.maturity.policyVersion}: balances received under it are withdrawable ${summary.maturity.lockupDays} days after the period start. This is a disclosed investment term, and no additional waiting period applies once it elapses.`
    : "No maturity period applies to your balance.";

  const processingNote = option
    ? `Reviewed for security, then broadcast to ${option.networkLabel}. Completion is confirmed after ${confirmations} network confirmation${confirmations === 1 ? "" : "s"}.`
    : "";

  const actionBarClass =
    "fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-40 bg-[#0F0F10]/95 shadow-[0_-1px_0_0_#26272B] backdrop-blur-md lg:static lg:inset-auto lg:z-auto lg:bg-transparent lg:py-0 lg:shadow-none lg:backdrop-blur-none";

  return (
    <div className="page-responsive borderless-ui min-w-0 space-y-8 pb-16 sm:space-y-10 lg:pb-0">
      <Seo
        title="Withdraw funds – secure payouts on supported networks"
        description="Request withdrawals from your matured balance on supported crypto assets and networks, with transparent maturity terms, fees, and on-chain verification."
        path="/withdraw"
      />

      <WithdrawPageHeader
        summary={summary}
        loading={loading}
        error={summaryError}
        busy={loading || historyLoading || submitting}
        onRefresh={refresh}
      />

      {summaryError ? <ErrorRow message={summaryError} onRetry={refresh} /> : null}

      {showSkeleton ? (
        <WithdrawLoadingSkeleton />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <div className="min-w-0 space-y-6">
            <WithdrawEligibilityPanel summary={summary} loading={loading} />

            <div className="min-w-0">
              <WithdrawStepper steps={steps} />
            </div>

            <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
              {step === 0 ? (
                <Panel className="space-y-4">
                  <SectionHeader
                    eyebrow="Step 1 of 6"
                    title="Select asset"
                    description="Only assets supported by the platform are listed. Your withdrawal is settled in the asset you choose."
                  />
                  <WithdrawAssetSelector
                    assets={assets}
                    value={activeSymbol}
                    onSelect={handleSelectSymbol}
                    disabled={submitting}
                  />
                  <p className="text-[11px] text-[#6B7280]">
                    Available to withdraw: {maskValue(hidden, formatUsd(availableBalance))}. Validated
                    against the authoritative ledger when you submit.
                  </p>
                </Panel>
              ) : null}

              {step === 1 ? (
                <Panel className="space-y-5">
                  <SectionHeader
                    eyebrow="Step 2 of 6"
                    title="Select supported network"
                    description="Use the network that matches your destination wallet. Sending on the wrong network can permanently lose funds."
                  />
                  <WithdrawNetworkSelector
                    networks={networks}
                    value={activeCryptoType}
                    onChange={handleChangeNetwork}
                    disabled={submitting}
                  />
                </Panel>
              ) : null}

              {step === 2 && option ? (
                <Panel className="space-y-5">
                  <SectionHeader
                    eyebrow="Step 3 of 6"
                    title="Enter amount"
                    description="Amounts are checked against your available matured balance and the per-network limits."
                  />
                  <WithdrawAmountInput
                    option={option}
                    value={amount}
                    onChange={(next) => {
                      setAmount(next);
                      setConfirmed(false);
                      setFormError(null);
                      resetIdempotency();
                    }}
                    validation={amountValidation}
                    disabled={submitting}
                    availableBalance={availableBalance}
                    networkFee={currentNetwork?.networkFee ?? 0}
                    platformFeePercent={summary?.platform_fee_percent ?? 0}
                    minAmount={minAmount}
                    maxAmount={maxAmount}
                    limitMessage={limitMessage}
                  />
                </Panel>
              ) : null}

              {step === 3 && option ? (
                <Panel className="space-y-5">
                  <SectionHeader
                    eyebrow="Step 4 of 6"
                    title="Enter destination wallet address"
                    description={`The address must match ${option.networkLabel}. Withdrawals cannot be reversed once broadcast.`}
                  />
                  <WithdrawDestinationInput
                    option={option}
                    value={address}
                    onChange={(next) => {
                      setAddress(next);
                      setConfirmed(false);
                      setFormError(null);
                      resetIdempotency();
                    }}
                    validation={addressValidation}
                    disabled={submitting}
                  />
                </Panel>
              ) : null}

              {step === 4 && option ? (
                <Panel className="space-y-5">
                  <SectionHeader
                    eyebrow="Step 5 of 6"
                    title="Review fees and net amount"
                    description="Confirm the applicable fees, processing detail and the net amount you will receive before you commit."
                  />
                  <WithdrawReviewStep
                    option={option}
                    address={address.trim()}
                    amount={amountValidation.valid ? parsedAmount : 0}
                    fees={fees}
                    maturityCondition={maturityCondition}
                    processingNote={processingNote}
                  />
                </Panel>
              ) : null}

              {step === 5 && option ? (
                <Panel className="space-y-5">
                  <SectionHeader
                    eyebrow="Step 6 of 6"
                    title="Confirm withdrawal"
                    description={`You will receive ${formatNumber(fees.netAmount, option.decimals)} ${option.symbolLabel} on ${option.networkLabel}.`}
                  />
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-[#0F0F10] px-3 py-3">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      disabled={submitting}
                      onChange={(event) => {
                        setConfirmed(event.target.checked);
                        setFormError(null);
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#C6A15B]"
                    />
                    <span className="text-[11px] leading-relaxed text-[#9CA3AF]">
                      I have verified the destination address, fees and net amount, and I authorize
                      this withdrawal.
                    </span>
                  </label>
                  {!eligible ? (
                    <ErrorRow message="Your account is not currently eligible to submit a withdrawal." />
                  ) : null}
                </Panel>
              ) : null}

              {formError ? <ErrorRow message={formError} /> : null}

              {lastSubmitted ? (
                <div className="flex gap-2 rounded-xl bg-[#16C784]/10 px-3 py-3">
                  <SolidCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16C784]" />
                  <div className="min-w-0 space-y-0.5 text-[11px]">
                    <p className="font-medium text-[#F5F5F7]">
                      Withdrawal request received ·{" "}
                      {withdrawalReference(lastSubmitted.withdrawal_id)}
                    </p>
                    <p className="text-[#9CA3AF]">
                      The amount is reserved from your matured balance and released automatically if
                      the request is rejected or fails. Completion is only confirmed on-chain.
                    </p>
                  </div>
                </div>
              ) : null}

              <div className={actionBarClass}>
                <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-0 lg:py-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={goBack}
                      disabled={step === 0 || submitting}
                      className="btn btn-secondary btn-md"
                    >
                      Back
                    </button>
                    <span className="text-[11px] text-[#6B7280]">
                      Step {step + 1} of {steps.length}
                    </span>
                  </div>

                  {step < LAST_STEP ? (
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canContinue || submitting}
                      className="btn btn-primary btn-md"
                    >
                      Continue
                      <SolidArrowRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-md">
                      {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <SolidCheck className="h-3.5 w-3.5" />
                      )}
                      {submitting ? "Submitting…" : "Confirm withdrawal"}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="min-w-0 space-y-6">
            <MaturityPolicyCard maturity={summary?.maturity ?? null} loading={loading} />
            <WithdrawProcessingTimeline />
            {lastSubmitted ? <WithdrawalDetailStatus withdrawal={lastSubmitted} /> : null}
          </div>
        </div>
      )}

      <WithdrawalHistory
        withdrawals={withdrawals}
        loading={historyLoading}
        error={historyError}
        onRetry={refreshHistory}
      />
    </div>
  );
}
