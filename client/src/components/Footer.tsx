import { Link } from "react-router-dom";
import { FaTelegramPlane } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { BRAND } from "../constants/copy";

export function Footer() {
  return (
    <footer className="hairline-t bg-[#0B0B0D]">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="hairline-b grid grid-cols-1 gap-8 pb-8 sm:grid-cols-2 sm:gap-10 sm:pb-10 lg:grid-cols-4">
          <div className="min-w-0 space-y-4 sm:space-y-5">
            <div className="flex min-w-0 items-center gap-2">
              <img
                src="/logo.svg"
                alt="NexaCrypto"
                className="h-8 w-8 shrink-0 rounded-full object-cover"
              />
              <span className="display-font min-w-0 truncate text-sm font-semibold tracking-tight text-[#F5F5F7]">
                NexaCrypto
              </span>
            </div>
            <p className="max-w-sm break-words text-xs leading-5 text-[#9CA3AF]">
              Digital asset investment platform for portfolio management, on-chain
              verified deposits and clear progression mechanics.
            </p>
          </div>

          <div className="min-w-0 space-y-3">
            <p className="display-font text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Company</p>
            <nav className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-[#9CA3AF]">
              <Link to="/landing#opportunity" className="hover:text-[#F5F5F7] transition-colors">About</Link>
              <Link to="/landing#platform" className="hover:text-[#F5F5F7] transition-colors">Platform</Link>
              <Link to="/landing#faq" className="hover:text-[#F5F5F7] transition-colors">FAQ</Link>
              <a href="mailto:support@nexacrypto.app" className="hover:text-[#F5F5F7] transition-colors">Contact</a>
            </nav>
          </div>

          <div className="min-w-0 space-y-3">
            <p className="display-font text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Legal</p>
            <nav className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-[#9CA3AF]">
              <Link to="/terms" className="hover:text-[#F5F5F7] transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-[#F5F5F7] transition-colors">Privacy</Link>
              <Link to="/cookies" className="hover:text-[#F5F5F7] transition-colors">Cookies</Link>
              {/* <Link to="/disclosures" className="hover:text-[#F5F5F7] transition-colors">Disclosures</Link> */}
            </nav>
          </div>

          <div className="min-w-0 space-y-3">
            <p className="display-font text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Community</p>
            <div className="flex items-center gap-3 pt-1">
              <a href={BRAND.telegram} target="_blank" rel="noreferrer" aria-label="Telegram" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors">
                <FaTelegramPlane className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a href={BRAND.x} target="_blank" rel="noreferrer" aria-label="X" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors">
                <FaXTwitter className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
            <p className="break-words text-[11px] leading-5 text-[#6B7280]">
              Security notices and platform updates are published through official channels.
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse items-start justify-between gap-3 pt-6 text-[10px] text-[#6B7280] sm:flex-row sm:items-center">
          <p className="break-words">© {new Date().getFullYear()} NexaCrypto. All rights reserved.</p>
          <p className="break-words sm:text-right">Digital asset portfolio management and investment performance tracking.</p>
        </div>
      </div>
    </footer>
  );
}

