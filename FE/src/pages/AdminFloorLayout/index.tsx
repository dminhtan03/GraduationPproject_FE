import React, { useEffect, useState, useCallback } from "react";
import {
  Bars3Icon,
  ArrowLeftIcon,
  DevicePhoneMobileIcon,
  DeviceTabletIcon,
  ComputerDesktopIcon,
  CloudArrowUpIcon,
  Squares2X2Icon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { useNavigate, useParams } from "react-router-dom";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { roomService } from "../../services/roomService";
import { adminService } from "../../services/adminService";
import { logout } from "../../services/authService";
import { ROUTES } from "../../constants";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { Rnd } from "react-rnd";

interface LayoutItem {
  roomId: string;
  locationCode: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const AdminFloorLayoutPage: React.FC = () => {
  const { buildingId, floorId } = useParams<{ buildingId: string; floorId: string }>();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastPopup, setToastPopup] = useState<{ type: MessageType; message: string } | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 1000, height: 600 });

  const adminName = "Admin";
  const adminEmail = "admin@unibooking.com";

  const loadRooms = async () => {
    if (!floorId) return;
    setLoading(true);
    try {
      const data = await adminService.getRoomsByFloor(floorId);
      const floorRooms = Array.isArray(data) ? data : [];
      
      setItems(floorRooms.map((r: any) => ({
        roomId: r.id || r.roomId,
        locationCode: r.locationCode,
        x: r.x ?? r.xPosition ?? r.xposition ?? 0,
        y: r.y ?? r.yPosition ?? r.yposition ?? 0,
        width: r.width || 80,
        height: r.height || 50,
      })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, [floorId]);

  const handleSaveLayout = async () => {
    if (!floorId) return;
    setSaving(true);
    try {
      const payload = items.map((item) => ({
        roomId: item.roomId,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      }));
      await roomService.updateFloorLayout(floorId, payload);
      setToastPopup({ type: "success", message: "Layout saved successfully" });
    } catch (err: any) {
      const errorMsg = err.message || "Failed to save layout";
      setToastPopup({ type: "error", message: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoLayout = () => {
    setItems(prev => prev.map((item, index) => ({
      ...item,
      x: (index % 5) * 100 + 20, // Xếp thành hàng, mỗi hàng 5 phòng
      y: Math.floor(index / 5) * 70 + 20,
      width: 80,
      height: 50,
    })));
    setToastPopup({ type: "success", message: "Auto-layout applied. Click 'Save Layout' to persist changes." });
  };

  const handleResetLayout = () => {
    loadRooms(); // Reset to last saved state
    setToastPopup({ type: "success", message: "Layout reset to last saved state." });
  };

  const updateItem = (roomId: string, data: Partial<LayoutItem>) => {
    setItems(prev => prev.map(item => item.roomId === roomId ? { ...item, ...data } : item));
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminSidebar
        adminName={adminName}
        adminEmail={adminEmail}
        onLogout={() => logout().then(() => navigate(ROUTES.LOGIN))}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="min-h-screen px-4 pb-8 pt-5 lg:ml-72 lg:px-8 flex flex-col">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/admin/buildings/${buildingId}/floors`)}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Floor Map Layout</h1>
              <p className="text-sm text-slate-500">Drag and resize rooms to define the floor plan</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetLayout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Reset
            </button>
            <button
              onClick={handleAutoLayout}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <Squares2X2Icon className="h-5 w-5" />
              Auto Layout
            </button>
            <button
              onClick={handleSaveLayout}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 hover:bg-orange-600 active:scale-95 transition-all disabled:opacity-50"
            >
              <CloudArrowUpIcon className="h-5 w-5" />
              {saving ? "Saving..." : "Save Layout"}
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-white rounded-3xl border-2 border-dashed border-slate-200 overflow-hidden shadow-inner min-h-[600px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="absolute inset-0 overflow-auto p-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:20px_20px]">
              {items.map((item) => (
                <Rnd
                  key={item.roomId}
                  size={{ width: item.width, height: item.height }}
                  position={{ x: item.x, y: item.y }}
                  onDragStop={(e, d) => updateItem(item.roomId, { x: d.x, y: d.y })}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    updateItem(item.roomId, {
                      width: parseInt(ref.style.width),
                      height: parseInt(ref.style.height),
                      ...position,
                    });
                  }}
                  bounds="parent"
                  className="z-10"
                >
                  <div className="w-full h-full bg-white border-2 border-orange-400 rounded-xl shadow-md flex items-center justify-center p-2 cursor-move hover:border-orange-600 hover:shadow-lg transition-all group relative">
                    <span className="text-xs font-bold text-slate-700 truncate">{item.locationCode}</span>
                    <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                      DRAG
                    </div>
                  </div>
                </Rnd>
              ))}
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

export default AdminFloorLayoutPage;
