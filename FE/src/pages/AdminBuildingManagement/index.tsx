import React, { useEffect, useState } from "react";
import {
  Bars3Icon,
  PlusIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  ChevronRightIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { adminService } from "../../services/adminService";
import { logout } from "../../services/authService";
import { ROUTES } from "../../constants";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

const AdminBuildingManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<any>(null);
  const [newBuilding, setNewBuilding] = useState({ name: "", address: "", totalFloors: 1 });
  const [toastPopup, setToastPopup] = useState<{ type: MessageType; message: string } | null>(null);

  const adminName = "Admin";
  const adminEmail = "admin@unibooking.com";

  const loadBuildings = async () => {
    setLoading(true);
    try {
      const data = await adminService.getAllBuildings();
      setBuildings(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuildings();
  }, []);

  const handleCreateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.createBuilding(newBuilding);
      setToastPopup({ type: "success", message: "Building created successfully" });
      setShowAddModal(false);
      setNewBuilding({ name: "", address: "", totalFloors: 1 });
      loadBuildings();
    } catch (err: any) {
      const errorMsg = err.message || "Failed to create building";
      setToastPopup({ type: "error", message: errorMsg });
    }
  };

  const handleUpdateBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBuilding) return;
    try {
      await adminService.updateBuilding(editingBuilding.id, editingBuilding.name);
      setToastPopup({ type: "success", message: "Building updated successfully" });
      setShowEditModal(false);
      setEditingBuilding(null);
      loadBuildings();
    } catch (err: any) {
      const errorMsg = err.message || "Failed to update building";
      setToastPopup({ type: "error", message: errorMsg });
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
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg border bg-white"
              onClick={() => setMobileOpen(true)}
            >
              <Bars3Icon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Building Management</h1>
              <p className="text-sm text-slate-500">Manage your organization's physical locations</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
          >
            <PlusIcon className="h-5 w-5" />
            Add Building
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {buildings.map((building) => (
            <div
              key={building.id}
              className="group bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all cursor-pointer relative"
              onClick={() => navigate(`/admin/buildings/${building.id}/floors`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 rounded-xl bg-orange-50 text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                  <BuildingOfficeIcon className="h-6 w-6" />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBuilding(building);
                      setShowEditModal(true);
                    }}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-orange-600 transition-colors"
                    title="Edit Building Name"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <ChevronRightIcon className="h-5 w-5 text-slate-400" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">{building.name}</h3>
              <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                <MapPinIcon className="h-4 w-4" />
                {building.address}
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                <div className="text-sm">
                  <span className="font-bold text-slate-900">{building.totalFloors}</span>
                  <span className="ml-1 text-slate-500">Floors</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {loading && buildings.length === 0 && (
          <div className="py-20 text-center">
            <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-slate-500">Loading buildings...</p>
          </div>
        )}
      </main>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Add New Building</h3>
            <form onSubmit={handleCreateBuilding} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Building Name</label>
                <input
                  required
                  type="text"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={newBuilding.name}
                  onChange={(e) => setNewBuilding({ ...newBuilding, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
                <input
                  required
                  type="text"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={newBuilding.address}
                  onChange={(e) => setNewBuilding({ ...newBuilding, address: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Total Floors</label>
                <input
                  required
                  type="number"
                  min="1"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={newBuilding.totalFloors}
                  onChange={(e) => setNewBuilding({ ...newBuilding, totalFloors: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 shadow-sm"
                >
                  Create Building
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Edit Building Name</h3>
            <form onSubmit={handleUpdateBuilding} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Building Name</label>
                <input
                  required
                  type="text"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2 focus:ring-2 focus:ring-orange-500 outline-none"
                  value={editingBuilding?.name || ""}
                  onChange={(e) => setEditingBuilding({ ...editingBuilding, name: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingBuilding(null);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 shadow-sm"
                >
                  Save Changes
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

export default AdminBuildingManagementPage;
