import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { BarChart3, LayoutDashboard, LogOut, Settings, Shield, User } from "lucide-react";
import type { RootState, AppDispatch } from "../../store";
import { logout } from "../../store/authSlice";
import { getFirstName, getInitials } from "../../utils/format";
import { ListRow } from "./primitives";

export function UserProfileMenu() {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const buttonId = "dashboard-profile-button";

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const button = document.getElementById(buttonId);
      if ((button?.contains(target) ?? false) || (containerRef.current?.contains(target) ?? false)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  if (!user) {
    return null;
  }

  const handleLogout = () => {
    dispatch(logout());
    navigate("/landing", { replace: true });
  };

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className="relative">
      <button
        id={buttonId}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Account menu"
        aria-expanded={open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1F2023] text-xs font-semibold text-[#C6A15B] ring-1 ring-inset ring-[#C6A15B]/40 transition-colors hover:ring-[#C6A15B]/70"
      >
        {getInitials(user.name, user.email)}
      </button>
      {open ? (
        <div
          ref={containerRef}
          className="card absolute right-0 z-50 mt-3 max-h-[70vh] w-60 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain"
          role="menu"
        >
          <div className="hairline-b px-4 py-3">
            <p className="truncate text-xs font-medium text-[#F5F5F7]">
              {getFirstName(user.name, user.email)}
            </p>
            <p className="truncate text-[11px] text-[#6B7280]">{user.email}</p>
          </div>
          <div className="py-1.5">
            <ListRow className="px-4 text-[11px]" onClick={() => go("/")}>
              <LayoutDashboard className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
              <span>Overview</span>
            </ListRow>
            <ListRow className="px-4 text-[11px]" onClick={() => go("/settings")}>
              <User className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
              <span>Profile</span>
            </ListRow>
            <ListRow className="px-4 text-[11px]" onClick={() => go("/settings")}>
              <Settings className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
              <span>Settings</span>
            </ListRow>
          </div>
          {user.is_admin ? (
            <div className="hairline-t py-1.5">
              <p className="px-4 py-1 text-[10px] uppercase tracking-[0.16em] text-[#6B7280]">
                Platform
              </p>
              <ListRow className="px-4 text-[11px]" onClick={() => go("/admin")}>
                <Shield className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                <span>Platform panel</span>
              </ListRow>
              <ListRow className="px-4 text-[11px]" onClick={() => go("/admin/operations")}>
                <Settings className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                <span>Operations</span>
              </ListRow>
              <ListRow className="px-4 text-[11px]" onClick={() => go("/admin/analytics")}>
                <BarChart3 className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                <span>Analytics</span>
              </ListRow>
            </div>
          ) : null}
          <div className="hairline-t py-1.5">
            <ListRow className="px-4 text-[11px]" onClick={handleLogout}>
              <LogOut className="h-3.5 w-3.5 shrink-0 text-[#EA3943]" />
              <span>Log out</span>
            </ListRow>
          </div>
        </div>
      ) : null}
    </div>
  );
}
