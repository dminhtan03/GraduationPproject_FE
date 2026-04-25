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
import AnimatedDropdown, {
  type AnimatedDropdownOption,
} from "../../components/common/AnimatedDropdown";
import { extractApiMessage } from "../../utils/errorHandlers";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { ImportModal } from "../../components/common";

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

const statusFilterOptions: Array<AnimatedDropdownOption<StatusFilter>> = [
  { value: "ALL", label: "All Status" },
  { value: "ACTIVE", label: "Active" },
  { value: "LOCKED", label: "Locked" },
];

const genderOptions: Array<AnimatedDropdownOption<string>> = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const roleOptions: Array<AnimatedDropdownOption<string>> = [
  { value: "USER", label: "Student / Staff" },
  { value: "ADMIN", label: "Administrator" },
];

const lockReasonPromptOptions = [
  "You violated the room booking policy through repeated no-shows.",
  "You used campus rooms for activities that are not permitted.",
  "You repeatedly disrupted shared spaces and ignored prior warnings.",
] as const;

const normalizeRole = (value?: string) => {
  const raw = String(value || "")
    .trim()
    .toUpperCase();
  if (!raw) return "USER";
  return raw.startsWith("ROLE_") ? raw.replace("ROLE_", "") : raw;
};

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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
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
  const [lockReasonInput, setLockReasonInput] = useState("");
  const [lockReasonError, setLockReasonError] = useState<string | null>(null);
  const [lockReasonOverrides, setLockReasonOverrides] = useState<
    Record<string, string>
  >(() => {
    try {
      const raw = window.localStorage.getItem("admin-user-lock-reasons");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return Object.entries(parsed).reduce<Record<string, string>>(
        (acc, [key, value]) => {
          if (typeof value === "string" && value.trim()) {
            acc[key] = value;
          }
          return acc;
        },
        {},
      );
    } catch {
      return {};
    }
  });
  const [reasonViewerUser, setReasonViewerUser] = useState<AdminUser | null>(
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

  useEffect(() => {
    window.localStorage.setItem(
      "admin-user-lock-reasons",
      JSON.stringify(lockReasonOverrides),
    );
  }, [lockReasonOverrides]);

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

  const handleToggleLock = async (user: AdminUser, reason?: string) => {
    setActionLoadingId(user.id);
    setError(null);
    try {
      let successMessage = "User status updated successfully";
      if (user.locked) {
        successMessage = await adminService.unlockUser(user.id);
        setLockReasonOverrides((prev) => {
          const next = { ...prev };
          delete next[user.id];
          return next;
        });
      } else {
        const normalizedReason = String(reason || "").trim();
        successMessage = await adminService.lockUser(user.id, normalizedReason);
        setLockReasonOverrides((prev) => ({
          ...prev,
          [user.id]: normalizedReason,
        }));
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
    setLockReasonInput("");
    setLockReasonError(null);
  };

  const closeConfirmModal = () => {
    if (!actionLoadingId) {
      setConfirmActionUser(null);
      setLockReasonInput("");
      setLockReasonError(null);
    }
  };

  const handleConfirmToggleLock = async () => {
    if (!confirmActionUser) return;

    if (!confirmActionUser.locked) {
      const normalizedReason = lockReasonInput.trim();
      if (!normalizedReason) {
        setLockReasonError("Please enter a reason before locking this user.");
        return;
      }
      await handleToggleLock(confirmActionUser, normalizedReason);
    } else {
      await handleToggleLock(confirmActionUser);
    }

    setConfirmActionUser(null);
    setLockReasonInput("");
    setLockReasonError(null);
  };

  const openReasonPopup = (user: AdminUser) => {
    setReasonViewerUser(user);
  };

  const closeReasonPopup = () => {
    setReasonViewerUser(null);
  };

  const getReasonText = (user: AdminUser | null): string => {
    if (!user) return "No lock reason provided.";
    const rawReason = String(
      user.reason || lockReasonOverrides[user.id] || "",
    ).trim();
    if (rawReason) return rawReason;
    return "No lock reason provided.";
  };

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
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

  const getAddUserInputClassName = (field: keyof RegisterUserPayload) =>
    [
      "h-10 w-full rounded-xl border bg-white px-3 text-sm text-slate-800 outline-none transition",
      "placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-100",
      addUserFieldErrors[field]
        ? "border-red-500 focus:border-red-500 focus:ring-red-100"
        : "border-slate-300",
    ].join(" ");

  const getAddUserDropdownButtonClassName = (
    field: keyof RegisterUserPayload,
  ) =>
    [
      "h-10 border bg-white px-3 text-slate-800",
      addUserFieldErrors[field] ? "border-red-500" : "border-slate-300",
    ].join(" ");

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
      const successMessage = await adminService.adminAddUser({
        ...addUserForm,
        email: addUserForm.email.trim(),
        role: normalizeRole(addUserForm.role),
      });
      // end update handleAddSingleUser to use adminAddUser
      showToast("success", successMessage);
      setShowAddUserModal(false);
      resetAddUserForm();
      await loadUsers();
    } catch (e: unknown) {
      const fieldErrors = extractRegisterFieldErrors(e);
      if (Object.keys(fieldErrors).length > 0) {
        setAddUserFieldErrors(fieldErrors);
      } else {
        showToast("error", extractApiMessage(e, "Unable to add user"));
      }
    } finally {
      setAddingUser(false);
    }
  };

  // start add handleImportExcel
  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImportResult(null);
    setError(null);
    setImportError(null);

    setImporting(true);
    try {
      await adminService.importUsersExcel(importFile);
      setImportResult("Imported users from Excel successfully.");
      showToast("success", "Import users successfully");
      setShowImportModal(false);
      setImportFile(null);
      await loadUsers();
    } catch (e: unknown) {
      const errorMessage = extractApiMessage(
        e,
        "Unable to import users from Excel",
      );
      setImportError(errorMessage);
      showToast("error", errorMessage);
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
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add User
            </button>

            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              Import Excel
            </button>
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
                  className="rounded-full p-2 hover:bg-slate-100"
                >
                  <XMarkIcon className="h-6 w-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddSingleUser}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      First Name
                    </label>
                    <input
                      type="text"
                      className={getAddUserInputClassName("firstName")}
                      placeholder="e.g. John"
                      value={addUserForm.firstName}
                      onChange={(e) =>
                        handleAddUserField("firstName", e.target.value)
                      }
                    />
                    {addUserFieldErrors.firstName && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.firstName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Last Name
                    </label>
                    <input
                      type="text"
                      className={getAddUserInputClassName("lastName")}
                      placeholder="e.g. Doe"
                      value={addUserForm.lastName}
                      onChange={(e) =>
                        handleAddUserField("lastName", e.target.value)
                      }
                    />
                    {addUserFieldErrors.lastName && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.lastName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      className={getAddUserInputClassName("phoneNumber")}
                      placeholder="0123456789"
                      value={addUserForm.phoneNumber}
                      onChange={(e) =>
                        handleAddUserField("phoneNumber", e.target.value)
                      }
                    />
                    {addUserFieldErrors.phoneNumber && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.phoneNumber}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Gender
                    </label>
                    <AnimatedDropdown<string>
                      value={addUserForm.gender}
                      options={genderOptions}
                      onChange={(nextValue) =>
                        handleAddUserField("gender", nextValue)
                      }
                      buttonClassName={getAddUserDropdownButtonClassName(
                        "gender",
                      )}
                      ariaLabel="Select gender"
                    />
                    {addUserFieldErrors.gender && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.gender}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Address
                    </label>
                    <input
                      type="text"
                      className={getAddUserInputClassName("address")}
                      placeholder="123 Campus St."
                      value={addUserForm.address}
                      onChange={(e) =>
                        handleAddUserField("address", e.target.value)
                      }
                    />
                    {addUserFieldErrors.address && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.address}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Department
                    </label>
                    <input
                      type="text"
                      className={getAddUserInputClassName("department")}
                      placeholder="IT / Marketing"
                      value={addUserForm.department}
                      onChange={(e) =>
                        handleAddUserField("department", e.target.value)
                      }
                    />
                    {addUserFieldErrors.department && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.department}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Email
                    </label>
                    <input
                      type="email"
                      className={getAddUserInputClassName("email")}
                      placeholder="john.doe@university.edu"
                      value={addUserForm.email}
                      onChange={(e) =>
                        handleAddUserField("email", e.target.value)
                      }
                    />
                    {addUserFieldErrors.email && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Password
                    </label>
                    <input
                      type="password"
                      className={getAddUserInputClassName("password")}
                      placeholder="••••••••"
                      value={addUserForm.password}
                      onChange={(e) =>
                        handleAddUserField("password", e.target.value)
                      }
                    />
                    {addUserFieldErrors.password && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.password}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Role
                    </label>
                    <AnimatedDropdown<string>
                      value={addUserForm.role}
                      options={roleOptions}
                      onChange={(nextValue) =>
                        handleAddUserField("role", nextValue)
                      }
                      buttonClassName={getAddUserDropdownButtonClassName(
                        "role",
                      )}
                      ariaLabel="Select role"
                    />
                    {addUserFieldErrors.role && (
                      <p className="mt-1 text-xs text-red-500">
                        {addUserFieldErrors.role}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserModal(false);
                      resetAddUserForm();
                      setAddUserFieldErrors({});
                    }}
                    className="h-10 rounded-xl px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingUser}
                    className="h-10 rounded-xl bg-orange-500 px-6 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-50"
                  >
                    {addingUser ? "Adding..." : "Add User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Import Modal */}
        <ImportModal
          isOpen={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setImportFile(null);
            setImportError(null);
          }}
          onImport={handleImportExcel}
          importFile={importFile}
          setImportFile={setImportFile}
          title="Import Users"
          description="Chỉ hỗ trợ file .xlsx"
          structureInfo="Cấu trúc Excel: firstName, lastName, email, phoneNumber, gender, address, department, password, role."
          loading={importing}
          error={importError}
          templateDownloadLink="/template file add user.xlsx"
          templateFileName="template file add user.xlsx"
        />

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

            <AnimatedDropdown<StatusFilter>
              value={statusFilter}
              options={statusFilterOptions}
              onChange={(nextValue) => setStatusFilter(nextValue)}
              className="md:w-48"
              buttonClassName="h-11 border-slate-300 bg-white font-medium"
              ariaLabel="Filter users by status"
            />
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
                      <div className="flex items-center gap-2">
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

                        {user.locked && (
                          <button
                            type="button"
                            onClick={() => openReasonPopup(user)}
                            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Reason
                          </button>
                        )}
                      </div>
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
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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
                  <div className="flex items-center gap-2">
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

                    {user.locked && (
                      <button
                        type="button"
                        onClick={() => openReasonPopup(user)}
                        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Reason
                      </button>
                    )}
                  </div>
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

            {!confirmActionUser.locked && (
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Lock reason
                </label>
                <textarea
                  rows={3}
                  value={lockReasonInput}
                  onChange={(event) => {
                    setLockReasonInput(event.target.value);
                    if (lockReasonError) {
                      setLockReasonError(null);
                    }
                  }}
                  placeholder="Enter the reason for locking this user"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
                {lockReasonError && (
                  <p className="text-xs text-red-600">{lockReasonError}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  {lockReasonPromptOptions.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setLockReasonInput(prompt);
                        setLockReasonError(null);
                      }}
                      className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

      {reasonViewerUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              User reason
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {reasonViewerUser.fullName || "This user"}
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              {getReasonText(reasonViewerUser)}
            </div>

            <div className="mt-5 flex items-center justify-end">
              <button
                type="button"
                onClick={closeReasonPopup}
                className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                Close
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
