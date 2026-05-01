import React, { useEffect, useMemo, useState } from "react";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { adminService } from "../../services/adminService";
import { api } from "../../services/api";
import { logout } from "../../services/authService";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

type ProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

type ServiceItem = {
  id: string;
  name: string;
  description?: string;
  unit?: string;
  price?: number | null;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object") {
    const maybeError = error as {
      message?: unknown;
      response?: { data?: { message?: unknown } };
    };

    const responseMessage = maybeError.response?.data?.message;
    if (typeof responseMessage === "string" && responseMessage.trim()) {
      return responseMessage;
    }

    if (typeof maybeError.message === "string" && maybeError.message.trim()) {
      return maybeError.message;
    }
  }

  return fallback;
};

// start+ chức năng CRUD dịch vụ đi kèm (UI admin)
const AdminServiceItemManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    unit: "",
    price: "",
    active: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");

  const normalizedFormPrice = useMemo(() => {
    const trimmed = form.price.trim();
    if (!trimmed) return null;
    const num = Number(trimmed);
    if (!Number.isFinite(num)) return null;
    return num;
  }, [form.price]);

  const loadAdminProfile = async () => {
    try {
      const res = await api.get<ProfilePayload | { data: ProfilePayload }>(
        API_ENDPOINTS.AUTH.PROFILE,
      );
      const raw = res.data;
      const nested = (raw as { data?: ProfilePayload }).data;
      const data = (nested || raw || {}) as ProfilePayload;
      const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ");
      setAdminName(fullName || "Admin User");
      setAdminEmail(data.email || "");
    } catch {
      setAdminName("Admin User");
      setAdminEmail("");
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await adminService.listServiceItems(false);
      const list = Array.isArray(data)
        ? data.map((row) => {
            const item = row as Record<string, unknown>;
            return {
              id: String(item.id ?? ""),
              name: String(item.name ?? ""),
              description:
                typeof item.description === "string" ? item.description : "",
              unit: typeof item.unit === "string" ? item.unit : "",
              price:
                typeof item.price === "number"
                  ? item.price
                  : item.price == null
                    ? null
                    : Number(item.price),
              active:
                typeof item.active === "boolean"
                  ? item.active
                  : item.active == null
                    ? true
                    : Boolean(item.active),
              createdAt:
                typeof item.createdAt === "string" ? item.createdAt : undefined,
              updatedAt:
                typeof item.updatedAt === "string" ? item.updatedAt : undefined,
            } as ServiceItem;
          })
        : [];
      setItems(list);
    } catch (err) {
      setToastPopup({ type: "error", message: "Failed to load service items" });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminProfile();
    loadItems();
  }, []);

  const openModal = (item?: ServiceItem) => {
    if (item) {
      setEditingItem(item);
      setForm({
        name: item.name || "",
        description: item.description || "",
        unit: item.unit || "",
        price: item.price == null ? "" : String(item.price),
        active: item.active !== false,
      });
    } else {
      setEditingItem(null);
      setForm({
        name: "",
        description: "",
        unit: "",
        price: "",
        active: true,
      });
    }
    setIsModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        unit: form.unit.trim() || undefined,
        price: normalizedFormPrice,
        active: form.active,
      };
      if (editingItem) {
        await adminService.updateServiceItem(editingItem.id, payload);
        setToastPopup({ type: "success", message: "Service item updated" });
      } else {
        await adminService.createServiceItem(payload);
        setToastPopup({ type: "success", message: "Service item created" });
      }
      setIsModalOpen(false);
      loadItems();
    } catch (err: unknown) {
      setToastPopup({
        type: "error",
        message: getErrorMessage(err, "Operation failed"),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const deactivate = async (id: string) => {
    if (!window.confirm("Deactivate this service item?")) return;
    try {
      await adminService.deleteServiceItem(id);
      setToastPopup({ type: "success", message: "Service item deactivated" });
      loadItems();
    } catch (err: unknown) {
      setToastPopup({
        type: "error",
        message: getErrorMessage(err, "Failed to deactivate service item"),
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={() => logout().then(() => navigate(ROUTES.LOGIN))}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="min-h-screen px-4 pb-8 pt-5 lg:ml-72 lg:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Service Management
            </h1>
            <p className="text-sm text-slate-500">
              Manage add-on services (catering, projector, etc.)
            </p>
          </div>

          <button
            onClick={() => openModal()}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-md"
          >
            <PlusIcon className="h-5 w-5" />
            Add Service Item
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 w-16">
                  #
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Name
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Unit
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Price
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-slate-500">
                      Loading service items...
                    </p>
                  </td>
                </tr>
              ) : items.length > 0 ? (
                items.map((item, index) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
                          <ClipboardDocumentListIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {item.name}
                          </div>
                          {item.description ? (
                            <div className="text-xs text-slate-500">
                              {item.description}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.unit || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {item.price == null || Number.isNaN(item.price)
                        ? "-"
                        : item.price}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={[
                          "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                          item.active !== false
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500",
                        ].join(" ")}
                      >
                        {item.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => openModal(item)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => deactivate(item.id)}
                          className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-slate-500">
                    No service items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {editingItem ? "Edit Service Item" : "Add Service Item"}
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={submit} className="px-6 py-5 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, name: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="Projector rental"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <input
                    value={form.description}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, description: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                    placeholder="Optional"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Unit
                    </label>
                    <input
                      value={form.unit}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, unit: e.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                      placeholder="set / hour"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">
                      Price
                    </label>
                    <input
                      value={form.price}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, price: e.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                      placeholder="0"
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="active"
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, active: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
                  />
                  <label
                    htmlFor="active"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Active
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting}
                    type="submit"
                    className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
                  >
                    {submitting ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {toastPopup ? (
          <CustomMessage
            type={toastPopup.type}
            message={toastPopup.message}
            onClose={() => setToastPopup(null)}
          />
        ) : null}
      </main>
    </div>
  );
};

export default AdminServiceItemManagementPage;
// end+ chức năng CRUD dịch vụ đi kèm (UI admin)

