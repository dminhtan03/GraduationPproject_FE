import React, { useEffect, useMemo, useState } from "react";
import {
  Bars3Icon,
  PlusIcon,
  PencilSquareIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { adminService } from "../../services/adminService";
import { api } from "../../services/api";
import { logout } from "../../services/authService";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS } from "../../constants/endpoints";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { CustomPagination } from "../../components/common";

type ProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

type Amenity = {
  id: string;
  name: string;
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

const AdminAmenityManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<Amenity | null>(null);
  const [amenityName, setAmenityName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");

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
      setAdminEmail("");
    }
  };

  const loadAmenities = async () => {
    setLoading(true);
    try {
      const data = await adminService.listAmenities();
      const normalizedAmenities = Array.isArray(data)
        ? data.map((item) => {
            const row = item as Record<string, unknown>;
            return {
              id: String(row.id ?? ""),
              name: String(row.name ?? ""),
              createdAt:
                typeof row.createdAt === "string" ? row.createdAt : undefined,
              updatedAt:
                typeof row.updatedAt === "string" ? row.updatedAt : undefined,
            } as Amenity;
          })
        : [];
      setAmenities(normalizedAmenities);
    } catch (err) {
      console.error(err);
      setToastPopup({ type: "error", message: "Failed to load amenities" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminProfile();
    loadAmenities();
  }, []);

  const totalPages = Math.max(1, Math.ceil(amenities.length / pageSize));
  const pagedAmenities = useMemo(
    () => amenities.slice((page - 1) * pageSize, page * pageSize),
    [amenities, page, pageSize],
  );

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleOpenModal = (amenity?: Amenity) => {
    if (amenity) {
      setEditingAmenity(amenity);
      setAmenityName(amenity.name);
    } else {
      setEditingAmenity(null);
      setAmenityName("");
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amenityName.trim()) return;

    setSubmitting(true);
    try {
      if (editingAmenity) {
        await adminService.updateAmenity(editingAmenity.id, amenityName.trim());
        setToastPopup({
          type: "success",
          message: "Amenity updated successfully",
        });
      } else {
        await adminService.createAmenity(amenityName.trim());
        setToastPopup({
          type: "success",
          message: "Amenity created successfully",
        });
      }
      setIsModalOpen(false);
      loadAmenities();
    } catch (err: unknown) {
      setToastPopup({
        type: "error",
        message: getErrorMessage(
          err,
          "Operation failed. Name might be duplicated.",
        ),
      });
    } finally {
      setSubmitting(false);
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open admin sidebar"
              >
                <Bars3Icon className="h-5 w-5" />
              </button>
              <h1 className="text-2xl font-bold text-slate-900">
                Amenity Management
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              Manage room facilities and equipment
            </p>
          </div>

          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-md"
          >
            <PlusIcon className="h-5 w-5" />
            Add Amenity
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
                  Amenity Name
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Last Updated
                </th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y border-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-slate-500">
                      Loading amenities...
                    </p>
                  </td>
                </tr>
              ) : amenities.length > 0 ? (
                pagedAmenities.map((amenity, index) => (
                  <tr
                    key={amenity.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
                          <WrenchScrewdriverIcon className="h-5 w-5" />
                        </div>
                        <span className="font-semibold text-slate-900">
                          {amenity.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {amenity.updatedAt || amenity.createdAt
                        ? new Date(
                            amenity.updatedAt || amenity.createdAt || "",
                          ).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(amenity)}
                          className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                          title="Edit"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-20 text-center bg-slate-50/50">
                    <p className="text-slate-500 font-medium">
                      No amenities found
                    </p>
                    <button
                      onClick={() => handleOpenModal()}
                      className="mt-4 text-orange-500 font-bold hover:text-orange-600 text-sm"
                    >
                      + Create your first amenity
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {amenities.length > 0 && totalPages > 1 && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <CustomPagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(nextPage) => setPage(nextPage)}
            />
          </div>
        )}
      </main>

      {/* Amenity Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  {editingAmenity ? "Edit Amenity" : "Add New Amenity"}
                </h3>
                <p className="text-sm text-slate-500">
                  {editingAmenity
                    ? "Update facility information"
                    : "Create a new facility for rooms"}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Amenity Name
                  </label>
                  <input
                    required
                    type="text"
                    value={amenityName}
                    onChange={(e) => setAmenityName(e.target.value)}
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                    placeholder="e.g. High-speed Wifi, Projector..."
                  />
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-md disabled:opacity-60 flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : editingAmenity ? (
                    "Update"
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </form>
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

export default AdminAmenityManagementPage;
