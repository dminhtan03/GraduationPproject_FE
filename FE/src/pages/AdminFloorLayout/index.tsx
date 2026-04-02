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
  XMarkIcon,
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

interface DecorItem {
  id: string;
  type: string;
  label: string;
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
  const [decorations, setDecorations] = useState<DecorItem[]>([]);
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
      const [roomData, decorData] = await Promise.all([
        adminService.getRoomsByFloor(floorId),
        roomService.getFloorDecorations(floorId)
      ]);

      const floorRooms = Array.isArray(roomData) ? roomData : [];
      
      setItems(floorRooms.map((r: any) => ({
        roomId: r.id || r.roomId,
        locationCode: r.locationCode,
        x: r.x ?? r.xPosition ?? r.xposition ?? 0,
        y: r.y ?? r.yPosition ?? r.yposition ?? 0,
        width: r.width || 80,
        height: r.height || 50,
      })));

      setDecorations((decorData || []).map((d: any) => ({
        id: d.id,
        type: d.type,
        label: d.label,
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height,
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
      const roomPayload = items.map((item) => ({
        roomId: item.roomId,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
      }));
      const decorPayload = decorations.map((d) => ({
        type: d.type,
        label: d.label,
        x: d.x,
        y: d.y,
        width: d.width,
        height: d.height,
      }));
      await roomService.updateFloorLayout(floorId, roomPayload, decorPayload);
      setToastPopup({ type: "success", message: "Layout saved successfully" });
    } catch (err: any) {
      const errorMsg = err.message || "Failed to save layout";
      setToastPopup({ type: "error", message: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  const handleAddDecoration = (type: string) => {
    const newDecor: DecorItem = {
      id: `temp-${Date.now()}`,
      type,
      label: type === 'LOBBY' ? 'Main Lobby' : 'Hallway',
      x: 50,
      y: 50,
      width: type === 'LOBBY' ? 200 : 300,
      height: type === 'LOBBY' ? 150 : 40,
    };
    setDecorations(prev => [...prev, newDecor]);
  };

  const handleRemoveDecoration = (id: string) => {
    setDecorations(prev => prev.filter(d => d.id !== id));
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

  const updateDecoration = (id: string, data: Partial<DecorItem>) => {
    setDecorations(prev => prev.map(item => item.id === id ? { ...item, ...data } : item));
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
            <div className="flex items-center gap-1 mr-4 bg-slate-200/50 p-1 rounded-xl">
              <button
                onClick={() => handleAddDecoration('LOBBY')}
                className="px-3 py-1.5 text-xs font-bold bg-white text-blue-600 rounded-lg shadow-sm hover:bg-blue-50 transition-all border border-blue-100"
              >
                + Lobby
              </button>
              <button
                onClick={() => handleAddDecoration('HALLWAY')}
                className="px-3 py-1.5 text-xs font-bold bg-white text-slate-600 rounded-lg shadow-sm hover:bg-slate-50 transition-all border border-slate-100"
              >
                + Hallway
              </button>
            </div>
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

        <div className="flex-1 relative bg-slate-100 rounded-3xl border-2 border-dashed border-slate-300 overflow-hidden shadow-inner min-h-[700px]">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-20">
              <div className="animate-spin h-10 w-10 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="absolute inset-0 overflow-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]">
              {/* Vùng giới hạn 60% không gian có thể chỉnh sửa */}
              <div className="w-[50%] min-h-full bg-white relative border-r-4 border-dashed border-orange-300 shadow-xl p-10 transition-all">
                <div className="absolute top-4 left-4 flex items-center gap-2 text-orange-500 font-bold text-xs uppercase tracking-widest pointer-events-none">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  Editable Area (50%)
                </div>
                
                {/* Render các thành phần trang trí (Lobby, Hallway) */}
                {decorations.map((decor) => (
                  <Rnd
                    key={decor.id}
                    size={{ width: decor.width, height: decor.height }}
                    position={{ x: decor.x, y: decor.y }}
                    onDragStop={(e, d) => updateDecoration(decor.id, { x: d.x, y: d.y })}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      updateDecoration(decor.id, {
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                        ...position,
                      });
                    }}
                    bounds="parent"
                    className="z-0"
                  >
                    <div className={`w-full h-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 group relative transition-all ${
                      decor.type === 'LOBBY' 
                        ? 'bg-blue-50/50 border-blue-200 text-blue-400' 
                        : 'bg-slate-50/50 border-slate-200 text-slate-400'
                    }`}>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 select-none">
                        {decor.label}
                      </span>
                      <button
                        onClick={() => handleRemoveDecoration(decor.id)}
                        className="absolute -top-2 -left-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                        title="Remove"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  </Rnd>
                ))}

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
                      <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                        DRAG
                      </div>
                    </div>
                  </Rnd>
                ))}
              </div>
              
              {/* Vùng 40% còn lại bị vô hiệu hóa */}
              <div className="absolute top-0 right-0 w-[40%] h-full bg-slate-200/30 flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3 opacity-40">
                  <XMarkIcon className="w-12 h-12 text-slate-400" />
                  <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Locked Area</span>
                </div>
              </div>
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
