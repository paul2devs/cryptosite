import type { AmountValidation, DepositNetworkOption } from "../../utils/deposit";

export function TransactionHashInput({
  value,
  onChange,
  validation,
  option,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  validation: AmountValidation;
  option: DepositNetworkOption;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="deposit-tx-hash" className="text-[11px] uppercase tracking-[0.14em] text-[#6B7280]">
        Transaction hash (TXID)
      </label>
      <input
        id="deposit-tx-hash"
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value.trim())}
        placeholder="Paste the blockchain transaction hash"
        aria-invalid={!validation.empty && !validation.valid}
        className={`w-full rounded-xl border bg-[#0F0F10] px-3 py-3 font-mono text-xs text-[#F5F5F7] outline-none transition-colors placeholder:font-sans placeholder:text-[#4B5563] disabled:opacity-60 ${
          !validation.empty && !validation.valid
            ? "border-[#EA3943]/60"
            : "border-[#26272B] focus:border-[#C6A15B]/70"
        }`}
      />
      {!validation.empty && !validation.valid && validation.message ? (
        <p className="text-[11px] text-[#EA3943]">{validation.message}</p>
      ) : (
        <p className="text-[11px] text-[#6B7280]">
          {option.symbolLabel} hashes are typically 64+ characters. Find it in your wallet&apos;s
          transaction history or a {option.networkLabel} block explorer, then paste it here. We
          verify every deposit on-chain before it is credited.
        </p>
      )}
    </div>
  );
}
