import React, { useEffect, useMemo, useState } from "react";
import {
  Bars3Icon,
  MagnifyingGlassIcon,
  LockClosedIcon,
  LockOpenIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  adminService,
  type AdminUser,
  type RegisterUserPayload,
} from "../../services/adminService";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import { logout } from "../../services/authService";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { extractApiMessage } from "../../utils/errorHandlers";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";

type ProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "LOCKED";

type ApiFieldError = {
  field?: string;
  description?: string;
};

const PAGE_SIZE = 10;

const SHEET_COLUMNS = [
  "firstName",
  "lastName",
  "phoneNumber",
  "address",
  "department",
  "email",
  "gender",
  "password",
  "role",
] as const;

const normalizeRole = (value?: string) => {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return "USER";
  return raw.startsWith("ROLE_") ? raw.replace("ROLE_", "") : raw;
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
};

const toRegisterPayload = (
  row: Record<string, string>,
): RegisterUserPayload => ({
  firstName: row.firstName || "",
  lastName: row.lastName || "",
  phoneNumber: row.phoneNumber || "",
  address: row.address || "",
  department: row.department || "",
  email: row.email || "",
  gender: row.gender || "",
  password: row.password || "",
  role: normalizeRole(row.role),
});

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
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [addUserFieldErrors, setAddUserFieldErrors] = useState<
    Record<string, string>
  >({});
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [confirmActionUser, setConfirmActionUser] = useState<AdminUser | null>(
    null,
  );
  const [addUserForm, setAddUserForm] = useState<RegisterUserPayload>({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    address: "",
    department: "",
    email: "",
    gender: "MALE",
    password: "",
    role: "USER",
  });

  const loadAdminProfile = async () => {
    try {
      const res = await api.get<ProfilePayload | { data: ProfilePayload }>(
        API_ENDPOINTS.AUTH.PROFILE,
      );
      const raw = res.data;
      const nested = (raw as { data?: ProfilePayload }).data;
      const data = (nested || raw || {}) as ProfilePayload;
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
      let successMessage = "User status updated successfully";
      if (user.locked) {
        successMessage = await adminService.unlockUser(user.id);
      } else {
        successMessage = await adminService.lockUser(user.id);
      }
      showToast("success", successMessage);
      await loadUsers();
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to update user status"));
    } finally {
      setActionLoadingId(null);
    }
  };

  const requestToggleLockConfirm = (user: AdminUser) => {
    setConfirmActionUser(user);
  };

  const closeConfirmModal = () => {
    if (!actionLoadingId) {
      setConfirmActionUser(null);
    }
  };

  const handleConfirmToggleLock = async () => {
    if (!confirmActionUser) return;
    await handleToggleLock(confirmActionUser);
    setConfirmActionUser(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const handleImportSheet = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setImportResult(null);
    setError(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file exported from Excel sheet.");
      return;
    }

    setImporting(true);
    try {
      const content = await file.text();
      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setError("CSV file is empty or missing data rows.");
        return;
      }

      const headers = parseCsvLine(lines[0]).map((header) => header.trim());
      const missingColumns = SHEET_COLUMNS.filter(
        (column) => !headers.includes(column),
      );

      if (missingColumns.length) {
        setError(
          `Missing columns: ${missingColumns.join(", ")}. Required columns: ${SHEET_COLUMNS.join(", ")}`,
        );
        return;
      }

      const rows = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const item: Record<string, string> = {};
        headers.forEach((header, index) => {
          item[header] = (values[index] || "").trim();
        });
        return item;
      });

      let successCount = 0;
      const failedRows: Array<{ row: number; reason: string }> = [];

      for (let index = 0; index < rows.length; index += 1) {
        const payload = toRegisterPayload(rows[index]);
        try {
          await adminService.registerUser(payload);
          successCount += 1;
        } catch (e: unknown) {
          failedRows.push({
            row: index + 2,
            reason: extractApiMessage(e, "Register failed"),
          });
        }
      }

      const failCount = failedRows.length;
      const summary = `Imported ${successCount}/${rows.length} users successfully.${
        failCount
          ? ` Failed: ${failCount} row(s) (${failedRows
              .slice(0, 3)
              .map((item) => `row ${item.row}: ${item.reason}`)
              .join(" | ")})`
          : ""
      }`;

      setImportResult(summary);
      await loadUsers();
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to import users from sheet"));
    } finally {
      setImporting(false);
    }
  };

  const resetAddUserForm = () => {
    setAddUserForm({
      firstName: "",
      lastName: "",
      phoneNumber: "",
      address: "",
      department: "",
      email: "",
      gender: "MALE",
      password: "",
      role: "USER",
    });
  };

  const handleAddUserField = (
    field: keyof RegisterUserPayload,
    value: string,
  ) => {
    setAddUserForm((prev) => ({ ...prev, [field]: value }));
    setAddUserFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const showToast = (type: MessageType, nextMessage: string) => {
    setToastPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setToastPopup((current) =>
        current && current.message === nextMessage ? null : current,
      );
    }, 3000);
  };

  const extractRegisterFieldErrors = (error: unknown) => {
    const payload = error as {
      response?: { data?: { meta?: { errors?: ApiFieldError[] } } };
      data?: { meta?: { errors?: ApiFieldError[] } };
    };

    const errors =
      payload?.response?.data?.meta?.errors || payload?.data?.meta?.errors;
    if (!Array.isArray(errors)) return {} as Record<string, string>;

    return errors.reduce<Record<string, string>>((acc, item) => {
      const field = String(item?.field || "").trim();
      const description = String(item?.description || "").trim();
      if (field && description && !acc[field]) {
        acc[field] = description;
      }
      return acc;
    }, {});
  };

  const handleAddSingleUser = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setError(null);
    setImportResult(null);
    setAddUserFieldErrors({});

    const requiredFields: Array<keyof RegisterUserPayload> = [
      "firstName",
      "lastName",
      "phoneNumber",
      "address",
      "department",
      "email",
      "gender",
      "password",
      "role",
    ];

    const missingField = requiredFields.find(
      (field) => !String(addUserForm[field] || "").trim(),
    );
    if (missingField) {
      setAddUserFieldErrors({ [missingField]: "This field is required" });
      return;
    }

    setAddingUser(true);
    try {
      // start update handleAddSingleUser to use adminAddUser
      await adminService.adminAddUser({
        ...addUserForm,
        email: addUserForm.email.trim(),
        role: normalizeRole(addUserForm.role),
      });
      // end update handleAddSingleUser to use adminAddUser
      setImportResult("Added 1 user successfully.");
      showToast("success", "Create user successfully");
      setShowAddUserModal(false);
      resetAddUserForm();
      await loadUsers();
    } catch (e: unknown) {
      const fieldErrors = extractRegisterFieldErrors(e);
      if (Object.keys(fieldErrors).length > 0) {
        setAddUserFieldErrors(fieldErrors);
      } else {
        setError(extractApiMessage(e, "Unable to add user"));
      }
    } finally {
      setAddingUser(false);
    }
  };

  // start add handleImportExcel
  const handleImportExcel = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setImportResult(null);
    setError(null);

    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".xlsx") && !ext.endsWith(".xls")) {
      setError("Please upload a .xlsx or .xls file.");
      return;
    }

    setImporting(true);
    try {
      await adminService.importUsersExcel(file);
      setImportResult("Imported users from Excel successfully.");
      showToast("success", "Import users successfully");
      await loadUsers();
    } catch (e: unknown) {
      setError(extractApiMessage(e, "Unable to import users from Excel"));
    } finally {
      setImporting(false);
    }
  };
  // end add handleImportExcel

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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddUserModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
            >
              <PlusIcon className="h-4 w-4" />
              Add User
            </button>

            {/* start update import excel UI */}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              <ArrowUpTrayIcon className="h-4 w-4" />
              {importing ? "Importing..." : "Import Excel"}
              <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                onChange={handleImportExcel}
                disabled={importing}
              />
            </label>
            {/* end update import excel UI */}
          </div>
        </div>

        {showAddUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">
                  Add 1 User
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserModal(false);
                    resetAddUserForm();
                    setAddUserFieldErrors({});
                  }}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"
                  aria-label="Close add user modal"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form
                onSubmit={handleAddSingleUser}
                className="grid grid-cols-1 gap-3 md:grid-cols-2"
              >
                <input
                  placeholder="First name"
                  value={addUserForm.firstName}
                  onChange={(e) =>
                    handleAddUserField("firstName", e.target.value)
                  }
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400"
                />
                {addUserFieldErrors.firstName && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.firstName}
                  </p>
                )}
                <input
                  placeholder="Last name"
                  value={addUserForm.lastName}
                  onChange={(e) =>
                    handleAddUserField("lastName", e.target.value)
                  }
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400"
                />
                {addUserFieldErrors.lastName && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.lastName}
                  </p>
                )}
                <input
                  placeholder="Phone number"
                  value={addUserForm.phoneNumber}
                  onChange={(e) =>
                    handleAddUserField("phoneNumber", e.target.value)
                  }
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400"
                />
                {addUserFieldErrors.phoneNumber && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.phoneNumber}
                  </p>
                )}
                <input
                  placeholder="Department"
                  value={addUserForm.department}
                  onChange={(e) =>
                    handleAddUserField("department", e.target.value)
                  }
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400"
                />
                {addUserFieldErrors.department && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.department}
                  </p>
                )}
                <input
                  placeholder="Email"
                  type="email"
                  value={addUserForm.email}
                  onChange={(e) => handleAddUserField("email", e.target.value)}
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400 md:col-span-2"
                />
                {addUserFieldErrors.email && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.email}
                  </p>
                )}
                <input
                  placeholder="Address"
                  value={addUserForm.address}
                  onChange={(e) =>
                    handleAddUserField("address", e.target.value)
                  }
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400 md:col-span-2"
                />
                {addUserFieldErrors.address && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.address}
                  </p>
                )}
                <input
                  placeholder="Password"
                  type="password"
                  value={addUserForm.password}
                  onChange={(e) =>
                    handleAddUserField("password", e.target.value)
                  }
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400"
                />
                {addUserFieldErrors.password && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.password}
                  </p>
                )}
                <select
                  value={addUserForm.gender}
                  onChange={(e) => handleAddUserField("gender", e.target.value)}
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400"
                >
                  <option value="MALE">MALE</option>
                  <option value="FEMALE">FEMALE</option>
                  <option value="OTHER">OTHER</option>
                </select>
                {addUserFieldErrors.gender && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.gender}
                  </p>
                )}
                <select
                  value={addUserForm.role}
                  onChange={(e) => handleAddUserField("role", e.target.value)}
                  className="h-11 rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-orange-400 md:col-span-2"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                {addUserFieldErrors.role && (
                  <p className="-mt-2 text-xs text-red-600 md:col-span-2">
                    {addUserFieldErrors.role}
                  </p>
                )}

                <div className="mt-2 flex items-center justify-end gap-2 md:col-span-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserModal(false);
                      resetAddUserForm();
                      setAddUserFieldErrors({});
                    }}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingUser}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {addingUser ? "Adding..." : "Add User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {importResult && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {importResult}
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
                        onClick={() => requestToggleLockConfirm(user)}
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
                    onClick={() => requestToggleLockConfirm(user)}
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

      {confirmActionUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {confirmActionUser.locked
                ? "Confirm unlock user"
                : "Confirm lock user"}
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {confirmActionUser.locked
                ? `Are you sure you want to unlock ${confirmActionUser.fullName || "this user"}?`
                : `Are you sure you want to lock ${confirmActionUser.fullName || "this user"}?`}
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={actionLoadingId === confirmActionUser.id}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleLock}
                disabled={actionLoadingId === confirmActionUser.id}
                className={[
                  "rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60",
                  confirmActionUser.locked
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700",
                ].join(" ")}
              >
                {actionLoadingId === confirmActionUser.id
                  ? "Processing..."
                  : confirmActionUser.locked
                    ? "Confirm Unlock"
                    : "Confirm Lock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastPopup && (
        <CustomMessage
          type={toastPopup.type}
          message={toastPopup.message}
          onClose={() => setToastPopup(null)}
        />
      )}
    </div>
  );
};

export default AdminUserManagementPage;
