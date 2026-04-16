import React, { useEffect, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  XMarkIcon,
  TrashIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/outline";
import { useNavigate, useParams } from "react-router-dom";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { adminService } from "../../services/adminService";
import { logout } from "../../services/authService";
import { ROUTES } from "../../constants";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { ImportModal } from "../../components/common";

const AdminRoomManagementPage: React.FC = () => {
  const { buildingId, floorId } = useParams<{ buildingId: string; floorId: string }>();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showImportRoomModal, setShowImportRoomModal] = useState(false);
  const [showImportScheduleModal, setShowImportScheduleModal] = useState(false);
  const [importRoomFile, setImportRoomFile] = useState<File | null>(null);
  const [importScheduleFile, setImportScheduleFile] = useState<File | null>(null);
  const [importRoomError, setImportRoomError] = useState<string | null>(null);
  const [importScheduleError, setImportScheduleError] = useState<string | null>(null);
  const [buildingName, setBuildingName] = useState<string>("");
  const [floorName, setFloorName] = useState<string>("");
  const [toastPopup, setToastPopup] = useState<{ type: MessageType; message: string } | null>(null);
  const [amenities, setAmenities] = useState<any[]>([]);

  // Add Room Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addingRoom, setAddingRoom] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [addRoomForm, setAddRoomForm] = useState({
    locationCode: "",
    status: "AVAILABLE",
    capacity: 10,
    score: 0,
    amenityIds: [] as string[],
  });

  // Edit Room Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState(false);
  const [editRoomForm, setEditRoomForm] = useState({
    roomId: "",
    locationCode: "", // for display only
    status: "AVAILABLE",
    capacity: 10,
    amenityIds: [] as string[],
  });

  const adminName = "Admin";
  const adminEmail = "admin@unibooking.com";

  const loadBuildingAndFloorInfo = async () => {
    try {
      if (buildingId) {
        const buildings = await adminService.getAllBuildings();
        const currentBuilding = buildings.find((b: any) => b.id === buildingId);
        if (currentBuilding) {
          setBuildingName(currentBuilding.name);
        }

        const floors = await adminService.getFloorsByBuilding(buildingId);
        const currentFloor = floors.find((f: any) => f.id === floorId);
        if (currentFloor) {
          setFloorName(currentFloor.name || currentFloor.floorName);
        }
      }
    } catch (err) {
      console.error("Failed to load building/floor info:", err);
    }
  };

  const loadRooms = async () => {
    if (!floorId) return;
    setLoading(true);
    try {
      const data = await adminService.getRoomsByFloor(floorId);
      setRooms(data || []);
    } catch (err) {
      console.error(err);
      setToastPopup({ type: "error", message: "Failed to load rooms" });
    } finally {
      setLoading(false);
    }
  };

  const loadAmenities = async () => {
    try {
      const data = await adminService.getAllAmenities();
      setAmenities(data || []);
    } catch (err) {
      console.error("Failed to load amenities:", err);
    }
  };

  useEffect(() => {
    loadBuildingAndFloorInfo();
    loadRooms();
    loadAmenities();
  }, [buildingId, floorId]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importRoomFile || !floorId) return;

    setImporting(true);
    setImportRoomError(null);
    try {
      await adminService.importRoomsExcel(importRoomFile, floorId);
      setToastPopup({ type: "success", message: "Rooms imported successfully" });
      setShowImportRoomModal(false);
      setImportRoomFile(null);
      loadRooms();
    } catch (err: any) {
      const errorMsg = err.message || "Failed to import rooms";
      const isWarning = err.code === "ROOM_409";
      setImportRoomError(errorMsg);
      setToastPopup({
        type: isWarning ? "warning" : "error",
        message: errorMsg,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportAcademicSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importScheduleFile) return;

    setImporting(true);
    setImportScheduleError(null);
    try {
      await adminService.importAcademicSchedules(importScheduleFile);
      setToastPopup({ type: "success", message: "Academic schedules imported successfully" });
      setShowImportScheduleModal(false);
      setImportScheduleFile(null);
    } catch (err: any) {
      const errorMsg = err.message || "Failed to import academic schedules";
      setImportScheduleError(errorMsg);
      setToastPopup({ type: "error", message: errorMsg });
    } finally {
      setImporting(false);
    }
  };

  const handleOpenAddModal = () => {
    setAddRoomForm({
      locationCode: "",
      status: "AVAILABLE",
      capacity: 10,
      score: 0,
      amenityIds: [],
    });
    setSelectedImage(null);
    setImagePreview(null);
    setIsAddModalOpen(true);
  };

  const handleAddRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!floorId) return;
    setAddingRoom(true);
    try {
      await adminService.createRoom({
        ...addRoomForm,
        floorId: floorId,
        image: selectedImage || undefined,
      });
      setToastPopup({ type: "success", message: "Room added successfully" });
      setIsAddModalOpen(false);
      loadRooms();
    } catch (err: any) {
      console.error(err);
      setToastPopup({
        type: "error",
        message: err.message || "Failed to add room",
      });
    } finally {
      setAddingRoom(false);
    }
  };

  const handleOpenEditModal = (room: any) => {
    setEditRoomForm({
      roomId: room.id,
      locationCode: room.locationCode,
      status: room.status,
      capacity: room.capacity,
      amenityIds: room.amenities?.map((a: any) => a.id) || [],
    });
    setIsEditModalOpen(true);
  };

  const handleEditRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditingRoom(true);
    try {
      await adminService.updateRoom({
        roomId: editRoomForm.roomId,
        capacity: editRoomForm.capacity,
        status: editRoomForm.status,
        amenityIds: editRoomForm.amenityIds,
      });
      setToastPopup({ type: "success", message: "Room updated successfully" });
      setIsEditModalOpen(false);
      loadRooms();
    } catch (err: any) {
      console.error(err);
      setToastPopup({
        type: "error",
        message: err.message || "Failed to update room",
      });
    } finally {
      setEditingRoom(false);
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
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/admin/buildings/${buildingId}/floors`)}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Rooms Management {buildingName && floorName && `- ${buildingName} - ${floorName}`}
              </h1>
              <p className="text-sm text-slate-500">Manage rooms, add new ones or import from Excel</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowImportScheduleModal(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              Import Academic Schedule
            </button>
            <button
              onClick={() => setShowImportRoomModal(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              Import Rooms
            </button>
            <button
              onClick={handleOpenAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-md"
            >
              <PlusIcon className="h-5 w-5" />
              Add Room
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Room Name</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Capacity</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Amenities</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Loading rooms...</p>
                  </td>
                </tr>
              ) : rooms.length > 0 ? (
                rooms.map((room) => (
                  <tr key={room.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {room.amenities && room.amenities.length > 0 && room.images && room.images[0] ? (
                          <img 
                            src={room.images[0].imageUrl} 
                            alt={room.locationCode} 
                            className="h-10 w-10 rounded-lg object-cover border border-slate-100 shadow-sm"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <PlusIcon className="h-5 w-5" />
                          </div>
                        )}
                        <span className="font-semibold text-slate-900">{room.locationCode}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-600 font-medium">{room.capacity} slots</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        room.status === "AVAILABLE" 
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                          : room.status === "BROKEN"
                          ? "bg-red-50 text-red-700 ring-red-600/20"
                          : room.status === "LEARNING"
                          ? "bg-purple-50 text-purple-700 ring-purple-600/20"
                          : "bg-slate-50 text-slate-700 ring-slate-600/20"
                      }`}>
                        {room.status === "LEARNING" ? "LEARNING" : room.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {room.amenities && room.amenities.length > 0 ? (
                          room.amenities.map((a: any) => (
                            <span key={a.id} className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              {a.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenEditModal(room)}
                          className="p-2 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-all" 
                          title="Edit"
                        >
                          <PencilSquareIcon className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center bg-slate-50/50">
                    <p className="text-slate-500 font-medium">No rooms found on this floor</p>
                    <button
                      onClick={handleOpenAddModal}
                      className="mt-4 text-orange-500 font-bold hover:text-orange-600 text-sm"
                    >
                      + Add your first room
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* Add Room Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Add New Room</h3>
                <p className="text-sm text-slate-500">Create a single room manually</p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleAddRoomSubmit}>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-orange-500 transition-colors cursor-pointer group"
                     onClick={() => document.getElementById("room-image-input")?.click()}>
                  {imagePreview ? (
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden shadow-md">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlusIcon className="h-8 w-8 text-white" />
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center gap-2">
                      <div className="p-3 bg-orange-50 rounded-full text-orange-500">
                        <ArrowUpTrayIcon className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">Click to upload room image</p>
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">JPG, PNG, WEBP up to 5MB</p>
                    </div>
                  )}
                  <input 
                    id="room-image-input"
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleImageChange}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Room Name / Location Code</label>
                  <input
                    required
                    type="text"
                    value={addRoomForm.locationCode}
                    onChange={(e) => setAddRoomForm({ ...addRoomForm, locationCode: e.target.value })}
                    className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                    placeholder="e.g. Room 101"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Capacity</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={addRoomForm.capacity}
                      onChange={(e) => setAddRoomForm({ ...addRoomForm, capacity: parseInt(e.target.value) })}
                      className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Initial Score</label>
                    <input
                      required
                      type="number"
                      step="0.1"
                      min="0"
                      max="5"
                      value={addRoomForm.score}
                      onChange={(e) => setAddRoomForm({ ...addRoomForm, score: parseFloat(e.target.value) })}
                      className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Initial Status</label>
                    <select
                      value={addRoomForm.status}
                      onChange={(e) => setAddRoomForm({ ...addRoomForm, status: e.target.value })}
                      className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all bg-white"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="UNAVAILABLE">Unavailable</option>
                      <option value="BROKEN">Maintenance</option>
                    </select>
                  </div>
                </div>

                {/* Amenities Selection */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Amenities</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    {amenities.map((amenity) => (
                      <label key={amenity.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={addRoomForm.amenityIds.includes(amenity.id)}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...addRoomForm.amenityIds, amenity.id]
                              : addRoomForm.amenityIds.filter(id => id !== amenity.id);
                            setAddRoomForm({ ...addRoomForm, amenityIds: newIds });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                        />
                        <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                          {amenity.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingRoom}
                  className="px-6 py-2.5 rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-md disabled:opacity-60 flex items-center gap-2"
                >
                  {addingRoom ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Add Room"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Room Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Edit Room</h3>
                <p className="text-sm text-slate-500">Update information for {editRoomForm.locationCode}</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
              >
                <XMarkIcon className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleEditRoomSubmit}>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Capacity</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={editRoomForm.capacity}
                      onChange={(e) => setEditRoomForm({ ...editRoomForm, capacity: parseInt(e.target.value) })}
                      className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Status</label>
                    <select
                      value={editRoomForm.status}
                      onChange={(e) => setEditRoomForm({ ...editRoomForm, status: e.target.value })}
                      className="w-full h-11 rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all bg-white"
                    >
                      <option value="AVAILABLE">Available</option>
                      <option value="UNAVAILABLE">Unavailable</option>
                      <option value="BROKEN">Maintenance</option>
                    </select>
                  </div>
                </div>

                {/* Amenities Selection */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Amenities</label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                    {amenities.map((amenity) => (
                      <label key={amenity.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={editRoomForm.amenityIds.includes(amenity.id)}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...editRoomForm.amenityIds, amenity.id]
                              : editRoomForm.amenityIds.filter(id => id !== amenity.id);
                            setEditRoomForm({ ...editRoomForm, amenityIds: newIds });
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer"
                        />
                        <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">
                          {amenity.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-100 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editingRoom}
                  className="px-6 py-2.5 rounded-xl bg-orange-500 text-sm font-bold text-white hover:bg-orange-600 transition-all shadow-md disabled:opacity-60 flex items-center gap-2"
                >
                  {editingRoom ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Room"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modals */}
      <ImportModal
        isOpen={showImportRoomModal}
        onClose={() => {
          setShowImportRoomModal(false);
          setImportRoomFile(null);
          setImportRoomError(null);
        }}
        onImport={handleImportExcel}
        importFile={importRoomFile}
        setImportFile={setImportRoomFile}
        title="Import Rooms"
        description="Chỉ hỗ trợ file .xlsx"
        structureInfo="Cấu trúc Excel: locationCode, capacity, status (AVAILABLE, BROKEN, etc.), score, amenityNames (ngăn cách bằng dấu phẩy)."
        loading={importing}
        error={importRoomError}
        templateDownloadLink="/template file add room.xlsx"
        templateFileName="template file add room.xlsx"
      />

      <ImportModal
        isOpen={showImportScheduleModal}
        onClose={() => {
          setShowImportScheduleModal(false);
          setImportScheduleFile(null);
          setImportScheduleError(null);
        }}
        onImport={handleImportAcademicSchedule}
        importFile={importScheduleFile}
        setImportFile={setImportScheduleFile}
        title="Import Academic Schedule"
        description="Chỉ hỗ trợ file .xlsx"
        structureInfo="Cấu trúc Excel: RoomCode, StartTime (HH:mm), EndTime (HH:mm), DaysOfWeek (NGĂN CÁCH BẰNG DẤU PHẨY), FromDate, ToDate, Description."
        loading={importing}
        error={importScheduleError}
        templateDownloadLink="/Import Academic Schedule.xlsx"
        templateFileName="Import Academic Schedule.xlsx"
      />

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

export default AdminRoomManagementPage;
