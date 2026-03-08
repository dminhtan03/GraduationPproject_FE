import React, { useEffect, useMemo, useState } from "react";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  LockOpenIcon,
} from "@heroicons/react/24/outline";
import { adminService, type AdminUser } from "../../services/adminService";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import { logout } from "../../services/authService";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { extractApiMessage } from "../../utils/errorHandlers";

type ProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "LOCKED";

const PAGE_SIZE = 10;

const AdminUserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);

  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");

  const loadAdminProfile = async () => {
    try {
      const res = await api.get<any>(API_ENDPOINTS.AUTH.PROFILE);
      const data = (res.data?.data || res.data || {}) as ProfilePayload;
      const fullName = [data.firstName, data.lastName]
        .filter(Boolean)
        .join(" ");
      setAdminName(fullName || "Admin User");
      setAdminEmail(data.email || "");
    } catch {
      setAdminName("Admin User");
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminService.getAllUsers(0, 500);
      setAllUsers(res.items);
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to load users"));
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminProfile();
    loadUsers();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return allUsers.filter((user) => {
      const byStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ACTIVE"
            ? !user.locked
            : user.locked;

      if (!byStatus) return false;
      if (!normalizedSearch) return true;

      return [user.fullName, user.email, user.phoneNumber, user.department]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
  }, [allUsers, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filteredUsers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const totalLocked = allUsers.filter((user) => user.locked).length;
  const totalActive = allUsers.length - totalLocked;

  const handleToggleLock = async (user: AdminUser) => {
    setActionLoadingId(user.id);
    setError(null);
    try {
      if (user.locked) {
        await adminService.unlockUser(user.id);
      } else {
        await adminService.lockUser(user.id);
      }
      await loadUsers();
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to update user status"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#e2e8f0_0%,#f8fafc_40%,#f8fafc_100%)]">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="min-h-screen px-4 pb-8 pt-5 lg:ml-72 lg:px-8">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin sidebar"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              User Management
            </h1>
            <p className="text-sm text-slate-500">
              Manage account status and search users quickly.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Users</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">
              {allUsers.length}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <p className="text-sm text-emerald-700">Active</p>
            <p className="mt-1 text-3xl font-semibold text-emerald-800">
              {totalActive}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-sm text-amber-700">Locked</p>
            <p className="mt-1 text-3xl font-semibold text-amber-800">
              {totalLocked}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row">
            <label className="relative flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, email, phone, department"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="LOCKED">Locked</option>
            </select>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="rounded-l-xl px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="rounded-r-xl px-4 py-3 font-semibold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">
                        {user.fullName || "-"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {user.email || "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {user.department || "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {user.phoneNumber || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full px-2.5 py-1 text-xs font-semibold",
                          user.locked
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700",
                        ].join(" ")}
                      >
                        {user.locked ? "LOCKED" : "ACTIVE"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggleLock(user)}
                        disabled={actionLoadingId === user.id}
                        className={[
                          "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                          user.locked
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-200",
                        ].join(" ")}
                      >
                        {user.locked ? (
                          <LockOpenIcon className="h-4 w-4" />
                        ) : (
                          <LockClosedIcon className="h-4 w-4" />
                        )}
                        {actionLoadingId === user.id
                          ? "Updating..."
                          : user.locked
                            ? "Unlock"
                            : "Lock"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {pageItems.map((user) => (
              <article
                key={user.id}
                className="rounded-xl border border-slate-200 p-3"
              >
                <p className="font-semibold text-slate-900">
                  {user.fullName || "-"}
                </p>
                <p className="text-xs text-slate-500">{user.email || "-"}</p>
                <p className="mt-2 text-xs text-slate-600">
                  Dept:{" "}
                  <span className="font-medium">{user.department || "-"}</span>
                </p>
                <p className="text-xs text-slate-600">
                  Phone:{" "}
                  <span className="font-medium">{user.phoneNumber || "-"}</span>
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={[
                      "rounded-full px-2.5 py-1 text-xs font-semibold",
                      user.locked
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700",
                    ].join(" ")}
                  >
                    {user.locked ? "LOCKED" : "ACTIVE"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleToggleLock(user)}
                    disabled={actionLoadingId === user.id}
                    className={[
                      "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                      user.locked
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200",
                    ].join(" ")}
                  >
                    {user.locked ? (
                      <LockOpenIcon className="h-4 w-4" />
                    ) : (
                      <LockClosedIcon className="h-4 w-4" />
                    )}
                    {actionLoadingId === user.id
                      ? "Updating..."
                      : user.locked
                        ? "Unlock"
                        : "Lock"}
                  </button>
                </div>
              </article>
            ))}
          </div>

          {!loading && pageItems.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              No users found with current filters.
            </div>
          )}

          {loading && (
            <div className="py-10 text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
              <p className="mt-3 text-sm text-slate-500">Loading users...</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
            <p>
              Showing{" "}
              {filteredUsers.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}-
              {Math.min(safePage * PAGE_SIZE, filteredUsers.length)} of{" "}
              {filteredUsers.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
                disabled={safePage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </button>
              <span className="font-semibold text-slate-800">
                {safePage}/{totalPages}
              </span>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
                disabled={safePage >= totalPages}
                onClick={() =>
                  setPage((prev) => Math.min(totalPages, prev + 1))
                }
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminUserManagementPage;
