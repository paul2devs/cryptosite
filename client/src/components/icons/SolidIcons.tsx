import type { SVGProps } from "react";

type SolidIconProps = SVGProps<SVGSVGElement>;

function SolidBase({ children, ...props }: SolidIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SolidDeposit(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path d="M12 2.5a1 1 0 0 0-1 1v8.09l-2.54-2.55a1 1 0 0 0-1.42 1.42l4.25 4.25a1 1 0 0 0 1.42 0l4.25-4.25a1 1 0 0 0-1.42-1.42L13 11.59V3.5a1 1 0 0 0-1-1Z" />
      <path d="M4.5 15a1 1 0 0 0-1 1v2.5A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5V16a1 1 0 1 0-2 0v2.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V16a1 1 0 0 0-1-1Z" />
    </SolidBase>
  );
}

export function SolidWithdraw(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path d="M12 2.5a1 1 0 0 1 .71.29l4.25 4.25a1 1 0 1 1-1.42 1.42L13 5.91V15a1 1 0 1 1-2 0V5.91L8.46 8.46A1 1 0 1 1 7.04 7.04l4.25-4.25A1 1 0 0 1 12 2.5Z" />
      <path d="M4.5 15a1 1 0 0 0-1 1v2.5A2.5 2.5 0 0 0 6 21h12a2.5 2.5 0 0 0 2.5-2.5V16a1 1 0 1 0-2 0v2.5a.5.5 0 0 1-.5.5H6a.5.5 0 0 1-.5-.5V16a1 1 0 0 0-1-1Z" />
    </SolidBase>
  );
}

export function SolidTransfer(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path d="M7 3.5a1 1 0 0 1 .71.29l3.25 3.25a1 1 0 1 1-1.42 1.42L8 6.91V15a1 1 0 1 1-2 0V6.91L4.46 8.46A1 1 0 1 1 3.04 7.04l3.25-3.25A1 1 0 0 1 7 3.5Z" />
      <path d="M17 21a1 1 0 0 1-.71-.29l-3.25-3.25a1 1 0 1 1 1.42-1.42L16 17.59V9a1 1 0 1 1 2 0v8.59l1.54-1.55a1 1 0 0 1 1.42 1.42l-3.25 3.25A1 1 0 0 1 17 21Z" />
    </SolidBase>
  );
}

export function SolidTrendingUp(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path d="M15.5 3.5H20a1 1 0 0 1 1 1v4.5a1 1 0 1 1-2 0V6.41l-6.29 6.3a1 1 0 0 1-1.42 0L9 10.41l-4.29 4.3a1 1 0 0 1-1.42-1.42l5-5a1 1 0 0 1 1.42 0l2.29 2.29L18.59 4.5H15.5a1 1 0 1 1 0-1Z" />
    </SolidBase>
  );
}

export function SolidCheck(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm4.03-11.53a1 1 0 0 0-1.42-1.42L11 11.66 9.4 10.06a1 1 0 0 0-1.42 1.42l2.31 2.31a1 1 0 0 0 1.42 0l4.32-4.32Z"
      />
    </SolidBase>
  );
}

export function SolidShield(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11.6 2.14a1 1 0 0 1 .8 0l7 2.9A1 1 0 0 1 20 6v6c0 4.4-3 7.9-7.6 9.9a1 1 0 0 1-.8 0C7 19.9 4 16.4 4 12V6a1 1 0 0 1 .6-.92l7-2.9Zm4.2 6.83a1 1 0 0 0-1.4-1.42l-4.3 4.31-1.8-1.81a1 1 0 1 0-1.4 1.42l2.5 2.5a1 1 0 0 0 1.4 0l5-5Z"
      />
    </SolidBase>
  );
}

export function SolidPlus(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13a1 1 0 0 1 1 1v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2H9a1 1 0 1 1 0-2h2V9a1 1 0 0 1 1-1Z"
      />
    </SolidBase>
  );
}

export function SolidArrowRight(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM10.3 8.29a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.42l-3 3a1 1 0 0 1-1.4-1.42L12.58 12l-2.29-2.29a1 1 0 0 1 0-1.42Z"
      />
    </SolidBase>
  );
}

export function SolidWallet(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h9A1 1 0 0 1 16.5 5H6.5a.5.5 0 0 0-.5.5V6h12.5A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-12A2.5 2.5 0 0 1 4 16.5v-11Zm13 5a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"
      />
    </SolidBase>
  );
}

export function SolidReceipt(props: SolidIconProps) {
  return (
    <SolidBase {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6 2.5h12A1.5 1.5 0 0 1 19.5 4v16.1a.9.9 0 0 1-1.36.77L16 19.4l-2.14 1.47a.9.9 0 0 1-1 0L10 19.4l-2.14 1.47A.9.9 0 0 1 6.5 20.1V4A1.5 1.5 0 0 1 8 2.5h-2Zm3 4.5a1 1 0 0 0 0 2h6a1 1 0 1 0 0-2H9Zm0 4a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H9Zm0 4a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2H9Z"
      />
    </SolidBase>
  );
}
