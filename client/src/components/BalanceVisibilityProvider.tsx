import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type BalanceVisibilityContextType = {
  hidden: boolean;
  toggle: () => void;
  mask: (value: string | number) => string;
};

const BalanceVisibilityContext = createContext<BalanceVisibilityContextType | null>(null);

export function BalanceVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem("balanceHidden");
      return raw === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("balanceHidden", hidden ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [hidden]);

  const value = useMemo<BalanceVisibilityContextType>(
    () => ({
      hidden,
      toggle: () => setHidden((prev) => !prev),
      mask: (v) => (hidden ? "******" : String(v))
    }),
    [hidden]
  );

  return <BalanceVisibilityContext.Provider value={value}>{children}</BalanceVisibilityContext.Provider>;
}

export function useBalanceVisibility(): BalanceVisibilityContextType {
  const ctx = useContext(BalanceVisibilityContext);
  if (!ctx) {
    throw new Error("useBalanceVisibility must be used within BalanceVisibilityProvider");
  }
  return ctx;
}

export function BalanceToggle({ className }: { className?: string }) {
  const { hidden, toggle } = useBalanceVisibility();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={hidden ? "Show balances" : "Hide balances"}
      aria-pressed={hidden}
      title={hidden ? "Show balances" : "Hide balances"}
      className={
        className ||
        "inline-flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full text-[#6B7280] transition-colors hover:bg-[#17181A] hover:text-[#F5F5F7] sm:h-8 sm:w-8"
      }
    >
      {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}
