import React, { useEffect, useState } from "react";
import {
  Bars3Icon,
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  MapIcon,
} from "@heroicons/react/24/outline";
import { useNavigate, useParams } from "react-router-dom";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { adminService } from "../../services/adminService";
import { logout } from "../../services/authService";
import { ROUTES } from "../../constants";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";

const AdminBuildingFloorsPage: React.FC = () => {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [floors, setFloors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importingFloorId, setImportingFloorId] = useState<string | null>(null);
  const [toastPopup, setToastPopup] = useState<{ type: MessageType; message: string } | null>(null);

  const adminName = "Admin";
  const adminEmail = "admin@unibooking.com";

  const loadFloors = async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      const data = await adminService.getFloorsByBuilding(buildingId);
      setFloors(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFloors();
  }, [buildingId]);

  const handleImportExcel = async (floorId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportingFloorId(floorId);
    try {
      await adminService.importRoomsExcel(file, floorId);
      setToastPopup({ type: "success", message: "Rooms imported successfully" });
      loadFloors();
    } catch (err) {
      setToastPopup({ type: "error", message: "Failed to import rooms" });
    } finally {
      setImportingFloorId(null);
      event.target.value = "";
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
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => navigate(ROUTES.ADMIN_BUILDING_MANAGEMENT)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Floors Management</h1>
            <p className="text-sm text-slate-500">Import rooms and manage layouts for each floor</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Floor Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-slate-100">
              {floors.map((floor) => (
                <tr key={floor.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-slate-900">{floor.name || floor.floorName}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
                        <ArrowUpTrayIcon className="h-4 w-4" />
                        {importingFloorId === floor.id ? "Importing..." : "Import Rooms"}
                        <input
                          type="file"
                          accept=".xlsx,.xls"
                          className="hidden"
                          onChange={(e) => handleImportExcel(floor.id, e)}
                          disabled={!!importingFloorId}
                        />
                      </label>
                      <button
                        onClick={() => navigate(`/admin/buildings/${buildingId}/floors/${floor.id}/layout`)}
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-orange-600 transition-colors shadow-sm"
                      >
                        <MapIcon className="h-4 w-4" />
                        Edit Layout
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && (
            <div className="py-10 text-center">
              <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-slate-500">Loading floors...</p>
            </div>
          )}
        </div>
      </main>

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

export default AdminBuildingFloorsPage;
