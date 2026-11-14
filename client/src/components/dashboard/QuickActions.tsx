import { Link } from "react-router-dom";
import {
  SolidDeposit,
  SolidWithdraw,
  SolidReceipt,
  SolidWallet
} from "../icons/SolidIcons";

const ACTIONS = [
  {
    to: "/deposit",
    label: "Deposit",
    description: "Add funds",
    icon: SolidDeposit,
    primary: true
  },
  {
    to: "/withdraw",
    label: "Withdraw",
    description: "Request payout",
    icon: SolidWithdraw,
    primary: false
  },
  {
    to: "/transactions",
    label: "Transactions",
    description: "Full history",
    icon: SolidReceipt,
    primary: false
  },
  {
    to: "/portfolio",
    label: "Portfolio",
    description: "Asset breakdown",
    icon: SolidWallet,
    primary: false
  }
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.to}
            to={action.to}
            className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-colors ${
              action.primary
                ? "bg-[#C6A15B] text-[#0F0F10] hover:bg-[#D4B071]"
                : "card text-[#F5F5F7] hover:bg-[#1F2023]"
            }`}
          >
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                action.primary ? "bg-[#0F0F10]/12" : "bg-[#0F0F10]"
              }`}
            >
              <Icon
                className={`h-4 w-4 ${action.primary ? "text-[#0F0F10]" : "text-[#C6A15B]"}`}
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium">{action.label}</span>
              <span
                className={`block truncate text-[10px] ${
                  action.primary ? "text-[#0F0F10]/70" : "text-[#9CA3AF]"
                }`}
              >
                {action.description}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
