import React from "react";
import {
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

type AdminSidebarProps = {
  adminName: string;
  adminEmail?: string;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const AdminSidebar: React.FC<AdminSidebarProps> = ({
  adminName,
  adminEmail,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const initials = adminName
    ? adminName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((segment) => segment[0]?.toUpperCase() || "")
        .join("")
    : "AD";

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={onCloseMobile}
          aria-label="Close admin sidebar"
        />
      )}

      <aside
        className={[
          "fixed left-0 top-0 z-40 flex h-screen w-72 flex-col border-r border-slate-200",
          "bg-white/95 shadow-xl backdrop-blur-sm transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500 text-white shadow-sm">
              <ShieldCheckIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-slate-900">
                UniBooking
              </p>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                Admin Portal
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-5">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-2xl bg-orange-50 px-4 py-3 text-left text-sm font-semibold text-orange-700 ring-1 ring-orange-200"
          >
            <UsersIcon className="h-5 w-5" />
            User Management
          </button>
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {adminName}
              </p>
              <p className="truncate text-xs text-slate-500">
                {adminEmail || "admin@company.com"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
