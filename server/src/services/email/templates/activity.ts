import { getAppBaseUrl } from "../emailClient";
import {
  escapeHtml,
  renderBrandEmailShell,
  renderBrandFooter,
  renderBrandHeader,
  renderDetailCard,
  renderEmailButton,
  renderHero,
  renderNotice
} from "./brand";

export function renderReferralRewardEmail(args: {
  name: string;
  bonusPercent: number;
  durationHours: number;
}): { subject: string; html: string } {
  const baseUrl = getAppBaseUrl();
  const subject = `Referral reward unlocked: +${Math.round(args.bonusPercent)}% multiplier`;
  const preheader = `You unlocked a referral multiplier boost for ${args.durationHours} hours.`;
  const multiplier = `+${Math.round(args.bonusPercent)}%`;

  const contentHtml = `${renderBrandHeader({ label: "Rewards" })}
${renderHero({
  eyebrow: "Referral reward",
  heading: "Your referral paid off",
  support:
    "Someone you invited just triggered a reward. Your multiplier boost is active right now."
})}
<p style="margin:0 0 14px 0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#F5F5F7;">Hi <strong>${escapeHtml(
    args.name
  )}</strong>,</p>
<p style="margin:0;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#92969D;">A referral you invited just triggered a reward. Your multiplier boost is now active on your account.</p>
${renderDetailCard({
  title: "Your boost",
  rows: [
    { label: "Multiplier boost", value: multiplier, emphasize: true },
    { label: "Active for", value: `${args.durationHours} hours` }
  ],
  statusLabel: "Active now",
  statusTone: "positive"
})}
${renderEmailButton({ href: `${baseUrl}/referrals`, label: "OPEN REFERRALS" })}
${renderNotice({
  title: "Keep it going",
  tone: "info",
  body: "Invite more members to stack multipliers and compound your rewards faster."
})}
${renderBrandFooter({ websiteUrl: baseUrl })}`;

  const html = renderBrandEmailShell({ title: subject, preheader, contentHtml });
  return { subject, html };
}
