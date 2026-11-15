import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  value,
  label = "Copy",
  className
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    let nextState: "copied" | "failed" = "failed";
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        nextState = "copied";
      }
    } catch {
      nextState = "failed";
    }
    setState(nextState);
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => setState("idle"), 2000);
  };

  const baseClass =
    className ||
    "inline-flex items-center justify-center gap-1.5 rounded-full border border-[#26272B] bg-[#17181A] px-3 py-1.5 text-[11px] font-medium text-[#F5F5F7] transition-colors hover:border-[#C6A15B]/60 hover:text-[#C6A15B]";

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!value}
      aria-live="polite"
      aria-label={state === "copied" ? `${label}, copied` : label}
      className={baseClass}
    >
      {state === "copied" ? (
        <Check className="h-3.5 w-3.5 text-[#16C784]" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>
        {state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}
      </span>
    </button>
  );
}
