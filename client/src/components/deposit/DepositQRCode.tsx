import { QRCodeSVG } from "qrcode.react";
import { getAssetMeta } from "../portfolio/assetMeta";
import type { DepositSymbol } from "../../utils/deposit";

export function DepositQRCode({
  value,
  symbol,
  size = 176
}: {
  value: string;
  symbol: DepositSymbol;
  size?: number;
}) {
  if (!value) {
    return null;
  }

  const meta = getAssetMeta(symbol);

  return (
    <div className="mx-auto flex w-full max-w-[200px] items-center justify-center rounded-2xl bg-[#F5F5F7] p-3">
      <div className="relative flex w-full items-center justify-center">
        <QRCodeSVG
          value={value}
          size={size}
          className="h-auto w-full"
          bgColor="#F5F5F7"
          fgColor="#0F0F10"
          level="M"
          includeMargin={false}
          title={`${symbol} deposit address QR code`}
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F5F5F7] shadow-sm">
            <img
              src={meta.logo}
              alt={meta.name}
              className="h-6 w-6"
              loading="lazy"
            />
          </span>
        </span>
      </div>
    </div>
  );
}
