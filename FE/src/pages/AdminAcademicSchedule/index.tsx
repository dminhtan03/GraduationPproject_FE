import React, { useEffect, useState } from "react";
import {
  Bars3Icon,
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  MapPinIcon,
  ClockIcon,
  CalendarDaysIcon,
} from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../../components/Layout/AdminSidebar";
import { adminService } from "../../services/adminService";
import { logout } from "../../services/authService";
import { ROUTES } from "../../constants";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

const DAYS_OF_WEEK = [
  "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"
];

const AdminAcademicSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Search states
  const [searchParams, setSearchParams] = useState({
    roomName: "",
    buildingId: "",
    floorId: "",
    fromDate: "",
    toDate: ""
  });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  
  const [newSchedule, setNewSchedule] = useState({
    roomId: "",
    startTime: "07:00",
    endTime: "17:00",
    daysOfWeek: [] as string[],
    fromDate: "",
    toDate: "",
    description: ""
  });

  const [importFile, setImportFile] = useState<File | null>(null);
  const [toastPopup, setToastPopup] = useState<{ type: MessageType; message: string } | null>(null);

  const adminName = "Admin";
  const adminEmail = "admin@unibooking.com";

  const loadBuildings = async () => {
    try {
      const data = await adminService.getAllBuildings();
      setBuildings(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadFloors = async (buildingId: string) => {
    if (!buildingId) {
      setFloors([]);
      return;
    }
    try {
      const data = await adminService.getFloorsByBuilding(buildingId);
      setFloors(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadRooms = async (floorId: string) => {
    if (!floorId) {
      setRooms([]);
      return;
    }
    try {
      const data = await adminService.getRoomsByFloor(floorId);
      setRooms(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSchedules = async () => {
    setLoading(true);
    try {
      // Filter out empty strings
      const params: any = {
        page,
        size: 10
      };
      if (searchParams.roomName) params.roomName = searchParams.roomName;
      if (searchParams.buildingId) params.buildingId = searchParams.buildingId;
      if (searchParams.floorId) params.floorId = searchParams.floorId;
      if (searchParams.fromDate) params.fromDate = searchParams.fromDate;
      if (searchParams.toDate) params.toDate = searchParams.toDate;

      const response = await adminService.searchAcademicSchedules(params);
      
      // Handle the data structure from the API response
      // Based on your provided response: { data: [...], meta: { pages: 1, ... } }
      if (response && response.data) {
        setSchedules(response.data || []);
        setTotalPages(response.meta?.pages || 0);
      } else if (response && response.content) {
        // Fallback for Page object structure
        setSchedules(response.content || []);
        setTotalPages(response.totalPages || 0);
      } else {
        // Final fallback if data is the array itself
        setSchedules(Array.isArray(response) ? response : []);
        setTotalPages(0);
      }
    } catch (err) {
      console.error(err);
      setToastPopup({ type: "error", message: "Failed to load schedules" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBuildings();
    loadSchedules();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    loadSchedules();
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminService.createAcademicSchedule(newSchedule);
      setToastPopup({ type: "success", message: "Schedule created successfully" });
      setShowAddModal(false);
      setNewSchedule({
        roomId: "",
        startTime: "07:00",
        endTime: "17:00",
        daysOfWeek: [],
        fromDate: "",
        toDate: "",
        description: ""
      });
      loadSchedules();
    } catch (err: any) {
      setToastPopup({ type: "error", message: err.message || "Failed to create schedule" });
    }
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    try {
      const payload = {
        startTime: editingSchedule.startTime,
        endTime: editingSchedule.endTime,
        daysOfWeek: typeof editingSchedule.daysOfWeek === 'string' ? editingSchedule.daysOfWeek.split(',') : editingSchedule.daysOfWeek,
        fromDate: editingSchedule.fromDate,
        toDate: editingSchedule.toDate,
        description: editingSchedule.description
      };
      await adminService.updateAcademicSchedule(editingSchedule.id, payload);
      setToastPopup({ type: "success", message: "Schedule updated successfully" });
      setShowEditModal(false);
      setEditingSchedule(null);
      loadSchedules();
    } catch (err: any) {
      setToastPopup({ type: "error", message: err.message || "Failed to update schedule" });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) return;
    try {
      await adminService.deleteAcademicSchedule(id);
      setToastPopup({ type: "success", message: "Schedule deleted successfully" });
      loadSchedules();
    } catch (err: any) {
      setToastPopup({ type: "error", message: err.message || "Failed to delete schedule" });
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    try {
      await adminService.importAcademicSchedules(importFile);
      setToastPopup({ type: "success", message: "Schedules imported successfully" });
      setShowImportModal(false);
      setImportFile(null);
      loadSchedules();
    } catch (err: any) {
      setToastPopup({ type: "error", message: err.message || "Failed to import schedules" });
    }
  };

  const toggleDay = (day: string, isNew: boolean) => {
    if (isNew) {
      const current = [...newSchedule.daysOfWeek];
      if (current.includes(day)) {
        setNewSchedule({ ...newSchedule, daysOfWeek: current.filter(d => d !== day) });
      } else {
        setNewSchedule({ ...newSchedule, daysOfWeek: [...current, day] });
      }
    } else {
      const current = editingSchedule.daysOfWeek ? (typeof editingSchedule.daysOfWeek === 'string' ? editingSchedule.daysOfWeek.split(',') : editingSchedule.daysOfWeek) : [];
      let next;
      if (current.includes(day)) {
        next = current.filter((d: string) => d !== day);
      } else {
        next = [...current, day];
      }
      setEditingSchedule({ ...editingSchedule, daysOfWeek: next });
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
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Academic Schedule</h1>
            <p className="text-sm text-slate-500">Manage fixed class schedules for rooms</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              Import Excel
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              Add Schedule
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form onSubmit={handleSearch} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search room name..."
                className="w-full rounded-xl border-slate-200 pl-10 text-sm focus:border-orange-500 focus:ring-orange-500"
                value={searchParams.roomName}
                onChange={(e) => setSearchParams({ ...searchParams, roomName: e.target.value })}
              />
            </div>
            <select
              className="rounded-xl border-slate-200 text-sm focus:border-orange-500 focus:ring-orange-500"
              value={searchParams.buildingId}
              onChange={(e) => {
                setSearchParams({ ...searchParams, buildingId: e.target.value, floorId: "" });
                loadFloors(e.target.value);
              }}
            >
              <option value="">All Buildings</option>
              {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select
              className="rounded-xl border-slate-200 text-sm focus:border-orange-500 focus:ring-orange-500"
              value={searchParams.floorId}
              onChange={(e) => setSearchParams({ ...searchParams, floorId: e.target.value })}
              disabled={!searchParams.buildingId}
            >
              <option value="">All Floors</option>
              {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input
              type="date"
              className="rounded-xl border-slate-200 text-sm focus:border-orange-500 focus:ring-orange-500"
              value={searchParams.fromDate}
              onChange={(e) => setSearchParams({ ...searchParams, fromDate: e.target.value })}
            />
            <button
              type="submit"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Search
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Room & Location</th>
                  <th className="px-6 py-4 font-semibold">Time</th>
                  <th className="px-6 py-4 font-semibold">Days</th>
                  <th className="px-6 py-4 font-semibold">Duration</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-500">Loading...</td></tr>
                ) : schedules.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-500">No schedules found</td></tr>
                ) : schedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{s.roomName}</div>
                      <div className="text-xs text-slate-500">{s.buildingName} - {s.floorName}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <ClockIcon className="h-4 w-4 text-slate-400" />
                        {s.startTime.substring(0, 5)} - {s.endTime.substring(0, 5)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {s.daysOfWeek.split(',').map((day: string) => (
                          <span key={day} className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                            {day.substring(0, 3)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <CalendarDaysIcon className="h-4 w-4 text-slate-400" />
                        {s.fromDate} to {s.toDate}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingSchedule({
                              ...s,
                              daysOfWeek: s.daysOfWeek.split(',')
                            });
                            setShowEditModal(true);
                          }}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-orange-600"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSchedule(s.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
              <button
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">Page {page + 1} of {totalPages}</span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <h2 className="text-xl font-bold text-slate-900">Add Academic Schedule</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-full p-2 hover:bg-slate-100">
                <XMarkIcon className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Building</label>
                  <select
                    required
                    className="w-full rounded-xl border-slate-200"
                    onChange={(e) => loadFloors(e.target.value)}
                  >
                    <option value="">Select Building</option>
                    {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Floor</label>
                  <select
                    required
                    className="w-full rounded-xl border-slate-200"
                    onChange={(e) => loadRooms(e.target.value)}
                  >
                    <option value="">Select Floor</option>
                    {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Room</label>
                  <select
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={newSchedule.roomId}
                    onChange={(e) => setNewSchedule({ ...newSchedule, roomId: e.target.value })}
                  >
                    <option value="">Select Room</option>
                    {rooms.map(r => <option key={r.id} value={r.id}>{r.locationCode}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Start Time</label>
                  <input
                    type="time"
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={newSchedule.startTime}
                    onChange={(e) => setNewSchedule({ ...newSchedule, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">End Time</label>
                  <input
                    type="time"
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={newSchedule.endTime}
                    onChange={(e) => setNewSchedule({ ...newSchedule, endTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">From Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={newSchedule.fromDate}
                    onChange={(e) => setNewSchedule({ ...newSchedule, fromDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">To Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={newSchedule.toDate}
                    onChange={(e) => setNewSchedule({ ...newSchedule, toDate: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Days of Week</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day, true)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          newSchedule.daysOfWeek.includes(day)
                            ? "bg-orange-600 text-white shadow-md shadow-orange-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    className="w-full rounded-xl border-slate-200"
                    rows={2}
                    value={newSchedule.description}
                    onChange={(e) => setNewSchedule({ ...newSchedule, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white hover:bg-orange-700 shadow-lg shadow-orange-100"
                >
                  Create Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <h2 className="text-xl font-bold text-slate-900">Edit Academic Schedule</h2>
              <button onClick={() => setShowEditModal(false)} className="rounded-full p-2 hover:bg-slate-100">
                <XMarkIcon className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                    <BuildingOfficeIcon className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Room</p>
                      <p className="text-sm font-bold text-slate-900">{editingSchedule.roomName} ({editingSchedule.buildingName} - {editingSchedule.floorName})</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Start Time</label>
                  <input
                    type="time"
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={editingSchedule.startTime.substring(0, 5)}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, startTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">End Time</label>
                  <input
                    type="time"
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={editingSchedule.endTime.substring(0, 5)}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, endTime: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">From Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={editingSchedule.fromDate}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, fromDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">To Date</label>
                  <input
                    type="date"
                    required
                    className="w-full rounded-xl border-slate-200"
                    value={editingSchedule.toDate}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, toDate: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Days of Week</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day, false)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                          (editingSchedule.daysOfWeek || []).includes(day)
                            ? "bg-orange-600 text-white shadow-md shadow-orange-200"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {day.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Description</label>
                  <textarea
                    className="w-full rounded-xl border-slate-200"
                    rows={2}
                    value={editingSchedule.description}
                    onChange={(e) => setEditingSchedule({ ...editingSchedule, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white hover:bg-orange-700 shadow-lg shadow-orange-100"
                >
                  Update Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <h2 className="text-xl font-bold text-slate-900">Import Schedules</h2>
              <button onClick={() => setShowImportModal(false)} className="rounded-full p-2 hover:bg-slate-100">
                <XMarkIcon className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleImport} className="space-y-4">
              <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-slate-300" />
                <div className="mt-4 flex flex-col items-center">
                  <label className="cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50">
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls"
                      onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">
                    {importFile ? importFile.name : "Support .xlsx, .xls files"}
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-700 leading-relaxed">
                  Excel structure: RoomCode, StartTime (HH:mm), EndTime (HH:mm), DaysOfWeek (COMMA-SEPARATED), FromDate, ToDate, Description.
                </p>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importFile}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 shadow-lg shadow-slate-100"
                >
                  Import Now
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

export default AdminAcademicSchedulePage;
