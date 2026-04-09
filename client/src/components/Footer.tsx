import { Link } from "react-router-dom";
import { FaTelegramPlane, FaTwitter, FaDiscord } from "react-icons/fa";

export function Footer() {
  return (
    <footer className="border-t border-[#1E2026] bg-[#0B0B0D]">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 border-b border-[#1E2026] pb-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-xs font-bold text-[#C6A15B] ring-2 ring-[#C6A15B]">
                CL
              </span>
              <span className="display-font text-sm font-semibold tracking-tight text-[#F5F5F7]">
                Crypto Levels
              </span>
            </div>
            <p className="max-w-sm text-xs leading-5 text-[#B3B9C5]">
              Centralized custodial crypto platform built for secure deposits, transparent progression, and controlled reward mechanics.
            </p>
            <p className="text-[11px] text-[#8A93A3]">
              Enterprise-grade monitoring, strict controls, and clear platform governance.
            </p>
          </div>

          <div className="space-y-3">
            <p className="display-font text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Company</p>
            <nav className="grid grid-cols-2 gap-2 text-[11px] text-[#B3B9C5]">
              <Link to="/landing#how-it-works" className="hover:text-[#F5F5F7] transition-colors">About</Link>
              <Link to="/landing#security" className="hover:text-[#F5F5F7] transition-colors">Security</Link>
              <Link to="/landing#faq" className="hover:text-[#F5F5F7] transition-colors">FAQ</Link>
              <a href="mailto:support@cryptolevels.app" className="hover:text-[#F5F5F7] transition-colors">Contact</a>
            </nav>
          </div>

          <div className="space-y-3">
            <p className="display-font text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Legal</p>
            <nav className="grid grid-cols-2 gap-2 text-[11px] text-[#B3B9C5]">
              <Link to="/terms" className="hover:text-[#F5F5F7] transition-colors">Terms</Link>
              <Link to="/privacy" className="hover:text-[#F5F5F7] transition-colors">Privacy</Link>
              <Link to="/cookies" className="hover:text-[#F5F5F7] transition-colors">Cookies</Link>
              <Link to="/landing#faq" className="hover:text-[#F5F5F7] transition-colors">Documentation</Link>
            </nav>
          </div>

          <div className="space-y-3">
            <p className="display-font text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">Community</p>
            <div className="flex items-center gap-3 pt-1">
              <a href="https://t.me" target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors">
                <FaTelegramPlane className="h-3.5 w-3.5" />
              </a>
              <a href="https://x.com" target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors">
                <FaTwitter className="h-3.5 w-3.5" />
              </a>
              <a href="https://discord.com" target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors">
                <FaDiscord className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-[11px] text-[#8A93A3]">
              Security notices and platform updates are published through official channels.
            </p>
          </div>
        </div>
        <div className="flex flex-col-reverse items-start justify-between gap-3 pt-6 text-[10px] text-[#9AA3B2] sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} Crypto Levels. All rights reserved.</p>
          <p>Centralized custodial platform. Not investment advice. Participate responsibly.</p>
        </div>
      </div>
    </footer>
  );
}

