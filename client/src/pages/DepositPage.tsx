import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Loader2, PlusCircle } from "lucide-react";
import { Seo } from "../components/Seo";
import {
  Panel,
  SectionHeader,
  ErrorRow,
  StatStrip,
  Stat
} from "../components/dashboard/primitives";
import { DISCLOSURES } from "../constants/copy";
import { useDepositData, type DepositPaymentInstructions } from "../hooks/useDepositData";
import { useDepositQuote } from "../hooks/useDepositQuote";
import { formatUsd } from "../utils/format";
import type { DepositRecord } from "../utils/transactions";
import {
  cryptoTypeFromAssetParam,
  defaultCryptoTypeForSymbol,
  getNetworkOption,
  symbolForCryptoType,
  validateUsdAmountInput,
  type CryptoType,
  type DepositSymbol
} from "../utils/deposit";
import { DepositPageHeader } from "../components/deposit/DepositPageHeader";
import { DepositStepper, type DepositStep } from "../components/deposit/DepositStepper";
import { AssetSelector } from "../components/deposit/AssetSelector";
import { NetworkSelector } from "../components/deposit/NetworkSelector";
import { DepositAmountInput } from "../components/deposit/DepositAmountInput";
import { DepositInstructions } from "../components/deposit/DepositInstructions";
import { DepositHistory } from "../components/deposit/DepositHistory";
import { DepositLoadingSkeleton } from "../components/deposit/DepositLoadingSkeleton";
import { DepositVerificationStatus } from "../components/deposit/DepositVerificationStatus";

/** Step 3 is the payment screen, created only after the pending record exists. */
const PAYMENT_STEP = 3;

/** The created pending deposit plus the server-supplied payment instructions. */
interface PaymentState {
  deposit: DepositRecord;
  instructions: DepositPaymentInstructions;
}

function extractMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } } | undefined;
  const message = candidate?.response?.data?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
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
  const [formError, setFormError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentState | null>(null);
  const [txHash, setTxHash] = useState("");
  const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const stepAnchorRef = useRef<HTMLDivElement | null>(null);
  const previousStepRef = useRef(step);

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
    submittingTransaction,
    createDeposit,
    submitTransaction,
    rescanDeposit,
    refresh
  } = useDepositData();

  const option = getNetworkOption(cryptoType);

  const address = useMemo(
    () => addresses.find((item) => item.asset === option.platformAsset) ?? null,
    [addresses, option.platformAsset]
  );

  // `amount` holds the USD value the user enters. The crypto equivalent is
  // always derived by the backend pricing service via the deposit quote.
  const amountValidation = validateUsdAmountInput(amount);
  const parsedUsd = Number(amount);
  const usdAmount = amountValidation.valid && Number.isFinite(parsedUsd) ? parsedUsd : null;

  const {
    quote,
    loading: quoteLoading,
    error: quoteError,
    refresh: refreshQuote
  } = useDepositQuote(cryptoType, usdAmount);

  const conversionReady =
    quote?.available === true && quote.cryptoAmount !== null && quote.cryptoAmountLabel !== null;
  const cryptoAmountLabel = conversionReady ? quote!.cryptoAmountLabel! : "-";

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
      id: "payment",
      label: "Payment",
      state: step === PAYMENT_STEP ? "active" : "upcoming"
    }
  ];

  const canAdvance = (() => {
    if (submitting) {
      return false;
    }
    if (step === 1) {
      return address !== null;
    }
    return true;
  })();

  const canCreate =
    address !== null && amountValidation.valid && conversionReady && !submitting;

  const handleSelectSymbol = (nextSymbol: DepositSymbol) => {
    if (nextSymbol === symbol) {
      return;
    }
    setSymbol(nextSymbol);
    setCryptoType(defaultCryptoTypeForSymbol(nextSymbol));
    setAmount("");
    setFormError(null);
  };

  const handleChangeNetwork = (nextCryptoType: CryptoType) => {
    if (nextCryptoType === cryptoType) {
      return;
    }
    setCryptoType(nextCryptoType);
    setAmount("");
    setFormError(null);
  };

  const goNext = () => {
    setFormError(null);
    setStep((current) => Math.min(PAYMENT_STEP, current + 1));
  };

  const goBack = () => {
    setFormError(null);
    setStep((current) => Math.max(0, current - 1));
  };

  const resetFlow = () => {
    setFormError(null);
    setSubmissionError(null);
    setVerificationMessage(null);
    setPayment(null);
    setTxHash("");
    setAmount("");
    setStep(0);
  };

  // Whenever the step changes, bring the start of the newly displayed section
  // to the top of the viewport instead of leaving the user at the bottom of the page.
  useEffect(() => {
    if (previousStepRef.current === step) {
      return;
    }
    previousStepRef.current = step;
    const anchor = stepAnchorRef.current;
    if (!anchor) {
      return;
    }
    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = window.scrollY + anchor.getBoundingClientRect().top - 72;
    window.scrollTo({ top: Math.max(0, top), behavior: prefersReduced ? "auto" : "smooth" });
  }, [step]);

  /**
   * Create the pending deposit. Creation only needs the authenticated user, a
   * supported asset/network and an amount: the backend allocates the unique
   * reference, stores the record as PENDING and returns the payment
   * instructions. No wallet is credited here and admin approval is still
   * required before any balance changes.
   */
  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!address) {
      setFormError("Deposit addresses are unavailable right now. Please refresh and try again.");
      return;
    }
    if (!amountValidation.valid || usdAmount === null) {
      setFormError(amountValidation.message ?? "Enter a valid deposit amount.");
      return;
    }
    if (!quote || quote.available !== true || quote.cryptoAmount === null) {
      setFormError(
        "We cannot fix the exact amount to send until a verified rate is available. Please refresh the rate and try again."
      );
      return;
    }
    try {
      const created = await createDeposit({
        crypto_type: cryptoType,
        amount: quote.cryptoAmount,
        usd_amount: usdAmount
      });
      setPayment({ deposit: created.deposit, instructions: created.instructions });
      setVerificationMessage(null);
      setSubmissionError(null);
      setTxHash("");
      setStep(PAYMENT_STEP);
    } catch (error) {
      setFormError(
        extractMessage(error, "We could not create your deposit right now. Please try again.")
      );
    }
  };

  const handleSubmitHash = async () => {
    if (!payment) {
      return;
    }
    setSubmissionError(null);
    setVerificationMessage(null);
    try {
      const result = await submitTransaction(payment.instructions.reference, txHash.trim());
      setPayment({ deposit: result.deposit, instructions: result.instructions });
      setVerificationMessage(result.message);
      setTxHash("");
    } catch (error) {
      setSubmissionError(
        extractMessage(error, "We could not verify that transaction right now.")
      );
    }
  };

  const handleRescan = async () => {
    if (!payment) {
      return;
    }
    setSubmissionError(null);
    setVerificationMessage(null);
    try {
      const result = await rescanDeposit(payment.instructions.reference);
      setPayment({
        deposit: result.deposit,
        instructions: result.instructions ?? payment.instructions
      });
    } catch (error) {
      setSubmissionError(
        extractMessage(error, "We could not check that deposit right now.")
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
        description="Add funds to your account using supported crypto assets and networks. Every deposit is verified independently on-chain and approved by an administrator before it is credited."
        path="/deposit"
        robots="noindex,nofollow"
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
            <div ref={stepAnchorRef} className="min-w-0">
              <DepositStepper steps={steps} />
            </div>

            <form onSubmit={handleCreate} className="min-w-0 space-y-6">
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
                    description={`Enter the amount you want to deposit in USD. We convert it to ${option.symbolLabel} at the current verified rate.`}
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
                    quote={quote}
                    quoteLoading={quoteLoading}
                    quoteError={quoteError}
                    onRefreshRate={refreshQuote}
                  />
                </Panel>
              ) : null}

              {step === PAYMENT_STEP && payment ? (
                <DepositInstructions
                  deposit={payment.deposit}
                  instructions={payment.instructions}
                  option={getNetworkOption(payment.instructions.cryptoType)}
                  txHash={txHash}
                  onTxHashChange={(next) => {
                    setTxHash(next);
                    setSubmissionError(null);
                    setVerificationMessage(null);
                  }}
                  onSubmitHash={handleSubmitHash}
                  onRescan={handleRescan}
                  submitting={submittingTransaction}
                  scanning={submittingTransaction}
                  message={verificationMessage}
                  error={submissionError}
                />
              ) : null}

              {step !== PAYMENT_STEP && formError ? <ErrorRow message={formError} /> : null}

              <div className="buttons-row sm:flex sm:flex-row sm:items-center sm:justify-between">
                {step > 0 && step < PAYMENT_STEP ? (
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={submitting}
                    className={navButtonClass}
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                    Back
                  </button>
                ) : (
                  <span />
                )}

                {step < 2 ? (
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canAdvance}
                    className={primaryButtonClass}
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : step === 2 ? (
                  <button type="submit" disabled={!canCreate} className={primaryButtonClass}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    <span>{submitting ? "Creating deposit…" : "Continue"}</span>
                  </button>
                ) : (
                  <button type="button" onClick={resetFlow} className={navButtonClass}>
                    <PlusCircle className="h-4 w-4" aria-hidden="true" />
                    Create another deposit
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="min-w-0 space-y-6 lg:sticky lg:top-6">
            {step === PAYMENT_STEP && payment ? (
              <DepositVerificationStatus deposit={payment.deposit} />
            ) : (
              <Panel className="space-y-4">
                <SectionHeader eyebrow="Summary" title="Deposit summary" />
                <StatStrip>
                  <Stat label="Asset" value={option.symbolLabel} hint={option.networkLabel} />
                  <Stat
                    label="Network"
                    value={option.networkLabel}
                    hint={`${option.networkType} network`}
                  />
                  <Stat
                    label="Amount"
                    value={amountValidation.valid && usdAmount !== null ? formatUsd(usdAmount) : "-"}
                    hint={amountValidation.valid ? "USD you deposit" : "Enter an amount"}
                  />
                  <Stat
                    label="You send"
                    value={conversionReady ? cryptoAmountLabel : "-"}
                    hint={conversionReady ? "Equivalent at the verified rate" : "Waiting for a live rate"}
                  />
                </StatStrip>
                <p className="text-[11px] leading-relaxed text-[#6B7280]">
                  {DISCLOSURES.depositsNotCredited}
                </p>
              </Panel>
            )}
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
