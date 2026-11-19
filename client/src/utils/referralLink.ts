import { BRAND } from "../constants/copy";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Origin used to build referral links.
 *
 * Invite links must always resolve to the canonical production domain so a
 * shared link keeps working from any deployment (Vercel preview, custom domain,
 * aliased host). Local development keeps the live window origin so the invite
 * code still round-trips through the local registration flow.
 */
export function resolveReferralOrigin(): string {
  if (typeof window !== "undefined" && window.location) {
    if (LOCAL_HOSTNAMES.has(window.location.hostname)) {
      return window.location.origin;
    }
  }
  return BRAND.url.replace(/\/+$/, "");
}

/**
 * Builds the canonical referral registration link for a code, following the
 * existing registration route and query parameter structure:
 *   https://nexocrypto.org/register?ref=REFERRAL_CODE
 */
export function buildReferralLink(referralCode: string): string {
  return `${resolveReferralOrigin()}/register?ref=${encodeURIComponent(referralCode)}`;
}
