import { Link } from "react-router-dom";
import { FaTelegramPlane, FaTwitter, FaDiscord } from "react-icons/fa";

export function Footer() {
  return (
    <footer className="border-t border-[#26272B] bg-[#050509]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#17181A] text-xs font-bold text-[#C6A15B] ring-2 ring-[#C6A15B]">
              CL
            </span>
            <span className="text-sm font-semibold tracking-tight text-[#F5F5F7]">
              Crypto Levels
            </span>
          </div>
          <p className="max-w-md text-[11px] text-[#9CA3AF]">
            Centralized crypto deposit and rewards platform with level-based multipliers,
            custodial security, and transparent progression.
          </p>
          <p className="text-[10px] text-[#6B7280]">
            Crypto assets are volatile. This is not investment advice. Only deposit what you
            can afford to keep at risk.
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#9CA3AF]">
            <Link
              to="/landing"
              className="hover:text-[#F5F5F7] transition-colors"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={() => {
                const element = document.getElementById("how-it-works");
                if (element) {
                  const rect = element.getBoundingClientRect();
                  const offset = 72;
                  window.scrollTo({
                    top: window.scrollY + rect.top - offset,
                    behavior: "smooth"
                  });
                }
              }}
              className="text-left hover:text-[#F5F5F7] transition-colors"
            >
              How It Works
            </button>
            <Link
              to="/leaderboards"
              className="hover:text-[#F5F5F7] transition-colors"
            >
              Leaderboard
            </Link>
            <Link
              to="/security"
              className="hover:text-[#F5F5F7] transition-colors"
            >
              Security
            </Link>
            <Link
              to="/terms"
              className="hover:text-[#F5F5F7] transition-colors"
            >
              Terms
            </Link>
            <Link
              to="/privacy"
              className="hover:text-[#F5F5F7] transition-colors"
            >
              Privacy
            </Link>
          </nav>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex items-center gap-3">
              <a
                href="https://t.me"
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
              >
                <FaTelegramPlane className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://x.com"
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
              >
                <FaTwitter className="h-3.5 w-3.5" />
              </a>
              <a
                href="https://discord.com"
                target="_blank"
                rel="noreferrer"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#17181A] text-[#F5F5F7] hover:bg-[#1F2023] transition-colors"
              >
                <FaDiscord className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="text-[10px] text-[#6B7280]">
              © {new Date().getFullYear()} Crypto Levels. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

