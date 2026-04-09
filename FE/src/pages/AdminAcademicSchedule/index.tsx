import React, { useEffect, useMemo, useState } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  BuildingOfficeIcon,
  ClockIcon,
  CalendarDaysIcon,
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
import AnimatedDropdown, {
  type AnimatedDropdownOption,
} from "../../components/common/AnimatedDropdown";
import DatePickerField from "../../components/common/DatePickerField";

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

const defaultNewSchedule = {
  roomId: "",
  startTime: "07:00",
  endTime: "17:00",
  daysOfWeek: [] as string[],
  fromDate: "",
  toDate: "",
  description: "",
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);

const getHourFromTime = (time: string) =>
  (time?.split(":")[0] || "00").padStart(2, "0");
const getMinuteFromTime = (time: string) =>
  (time?.split(":")[1] || "00").padStart(2, "0");

type ProfilePayload = {
  firstName?: string;
  lastName?: string;
  email?: string;
};

const AdminAcademicSchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [buildings, setBuildings] = useState<any[]>([]);
  const [searchFloors, setSearchFloors] = useState<any[]>([]);
  const [formFloors, setFormFloors] = useState<any[]>([]);
  const [formRooms, setFormRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Search states
  const [searchParams, setSearchParams] = useState({
    roomName: "",
    buildingId: "",
    floorId: "",
    fromDate: "",
    toDate: "",
  });
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [newScheduleBuildingId, setNewScheduleBuildingId] = useState("");
  const [newScheduleFloorId, setNewScheduleFloorId] = useState("");

  const [newSchedule, setNewSchedule] = useState(defaultNewSchedule);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [toastPopup, setToastPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
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

  const resetAddScheduleForm = () => {
    setNewSchedule(defaultNewSchedule);
    setNewScheduleBuildingId("");
    setNewScheduleFloorId("");
    setFormFloors([]);
    setFormRooms([]);
  };

  const closeAddScheduleModal = () => {
    setShowAddModal(false);
    resetAddScheduleForm();
  };

  const searchBuildingOptions = useMemo<AnimatedDropdownOption<string>[]>(
    () => [
      { value: "", label: "All Buildings" },
      ...buildings.map((building) => ({
        value: building.id,
        label: building.name,
      })),
    ],
    [buildings],
  );

  const searchFloorOptions = useMemo<AnimatedDropdownOption<string>[]>(
    () => [
      { value: "", label: "All Floors" },
      ...searchFloors.map((floor) => ({
        value: floor.id,
        label: floor.name,
      })),
    ],
    [searchFloors],
  );

  const addBuildingOptions = useMemo<AnimatedDropdownOption<string>[]>(
    () => [
      { value: "", label: "Select Building" },
      ...buildings.map((building) => ({
        value: building.id,
        label: building.name,
      })),
    ],
    [buildings],
  );

  const addFloorOptions = useMemo<AnimatedDropdownOption<string>[]>(
    () => [
      { value: "", label: "Select Floor" },
      ...formFloors.map((floor) => ({
        value: floor.id,
        label: floor.name,
      })),
    ],
    [formFloors],
  );

  const addRoomOptions = useMemo<AnimatedDropdownOption<string>[]>(
    () => [
      { value: "", label: "Select Room" },
      ...formRooms.map((room) => ({
        value: room.id,
        label: room.locationCode,
      })),
    ],
    [formRooms],
  );

  const loadBuildings = async () => {
    try {
      const data = await adminService.getAllBuildings();
      setBuildings(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSearchFloors = async (buildingId: string) => {
    if (!buildingId) {
      setSearchFloors([]);
      return;
    }
    try {
      const data = await adminService.getFloorsByBuilding(buildingId);
      setSearchFloors(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadFormFloors = async (buildingId: string) => {
    if (!buildingId) {
      setFormFloors([]);
      return;
    }
    try {
      const data = await adminService.getFloorsByBuilding(buildingId);
      setFormFloors(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadFormRooms = async (floorId: string) => {
    if (!floorId) {
      setFormRooms([]);
      return;
    }
    try {
      const data = await adminService.getRoomsByFloor(floorId);
      setFormRooms(data || []);
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
        size: 10,
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
    loadAdminProfile();
  }, []);

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

    if (!newSchedule.roomId) {
      setToastPopup({ type: "warning", message: "Please select a room." });
      return;
    }

    if (!newSchedule.fromDate || !newSchedule.toDate) {
      setToastPopup({
        type: "warning",
        message: "Please select both from date and to date.",
      });
      return;
    }

    if (!newSchedule.daysOfWeek.length) {
      setToastPopup({
        type: "warning",
        message: "Please choose at least one day of week.",
      });
      return;
    }

    try {
      await adminService.createAcademicSchedule(newSchedule);
      setToastPopup({
        type: "success",
        message: "Schedule created successfully",
      });
      setShowAddModal(false);
      resetAddScheduleForm();
      loadSchedules();
    } catch (err: any) {
      setToastPopup({
        type: "error",
        message: err.message || "Failed to create schedule",
      });
    }
  };

  const handleUpdateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    try {
      const payload = {
        startTime: editingSchedule.startTime,
        endTime: editingSchedule.endTime,
        daysOfWeek:
          typeof editingSchedule.daysOfWeek === "string"
            ? editingSchedule.daysOfWeek.split(",")
            : editingSchedule.daysOfWeek,
        fromDate: editingSchedule.fromDate,
        toDate: editingSchedule.toDate,
        description: editingSchedule.description,
      };
      await adminService.updateAcademicSchedule(editingSchedule.id, payload);
      setToastPopup({
        type: "success",
        message: "Schedule updated successfully",
      });
      setShowEditModal(false);
      setEditingSchedule(null);
      loadSchedules();
    } catch (err: any) {
      setToastPopup({
        type: "error",
        message: err.message || "Failed to update schedule",
      });
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this schedule?"))
      return;
    try {
      await adminService.deleteAcademicSchedule(id);
      setToastPopup({
        type: "success",
        message: "Schedule deleted successfully",
      });
      loadSchedules();
    } catch (err: any) {
      setToastPopup({
        type: "error",
        message: err.message || "Failed to delete schedule",
      });
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    try {
      await adminService.importAcademicSchedules(importFile);
      setToastPopup({
        type: "success",
        message: "Schedules imported successfully",
      });
      setShowImportModal(false);
      setImportFile(null);
      loadSchedules();
    } catch (err: any) {
      setToastPopup({
        type: "error",
        message: err.message || "Failed to import schedules",
      });
    }
  };

  const toggleDay = (day: string, isNew: boolean) => {
    if (isNew) {
      const current = [...newSchedule.daysOfWeek];
      if (current.includes(day)) {
        setNewSchedule({
          ...newSchedule,
          daysOfWeek: current.filter((d) => d !== day),
        });
      } else {
        setNewSchedule({ ...newSchedule, daysOfWeek: [...current, day] });
      }
    } else {
      const current = editingSchedule.daysOfWeek
        ? typeof editingSchedule.daysOfWeek === "string"
          ? editingSchedule.daysOfWeek.split(",")
          : editingSchedule.daysOfWeek
        : [];
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
            <h1 className="text-2xl font-bold text-slate-900">
              Academic Schedule
            </h1>
            <p className="text-sm text-slate-500">
              Manage fixed class schedules for rooms
            </p>
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
              onClick={() => {
                resetAddScheduleForm();
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              Add Schedule
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <form
            onSubmit={handleSearch}
            className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2 lg:grid-cols-6"
          >
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-transparent select-none">
                Filter
              </div>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search room name..."
                  className="h-11 w-full rounded-xl border-slate-200 pl-10 text-sm focus:border-orange-500 focus:ring-orange-500"
                  value={searchParams.roomName}
                  onChange={(e) =>
                    setSearchParams({
                      ...searchParams,
                      roomName: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-transparent select-none">
                Filter
              </div>
              <AnimatedDropdown<string>
                value={searchParams.buildingId}
                options={searchBuildingOptions}
                onChange={(nextValue) => {
                  setSearchParams({
                    ...searchParams,
                    buildingId: nextValue,
                    floorId: "",
                  });
                  loadSearchFloors(nextValue);
                }}
                buttonClassName="h-11 border-slate-200 bg-white text-sm font-medium transition-all duration-300 hover:border-orange-300"
                menuClassName="animate-[fadeIn_0.18s_ease-out]"
                ariaLabel="Filter schedules by building"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-transparent select-none">
                Filter
              </div>
              <AnimatedDropdown<string>
                value={searchParams.floorId}
                options={searchFloorOptions}
                onChange={(nextValue) =>
                  setSearchParams({ ...searchParams, floorId: nextValue })
                }
                disabled={!searchParams.buildingId}
                buttonClassName="h-11 border-slate-200 bg-white text-sm font-medium transition-all duration-300 hover:border-orange-300"
                ariaLabel="Filter schedules by floor"
              />
            </div>
            <DatePickerField
              value={searchParams.fromDate}
              onChange={(nextDate) =>
                setSearchParams({ ...searchParams, fromDate: nextDate })
              }
              label="From date"
            />
            <DatePickerField
              value={searchParams.toDate}
              minDate={searchParams.fromDate || undefined}
              onChange={(nextDate) =>
                setSearchParams({ ...searchParams, toDate: nextDate })
              }
              label="To date"
            />
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-transparent select-none">
                Filter
              </div>
              <button
                type="submit"
                className="h-11 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Search
              </button>
            </div>
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
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-slate-500"
                    >
                      Loading...
                    </td>
                  </tr>
                ) : schedules.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-10 text-center text-slate-500"
                    >
                      No schedules found
                    </td>
                  </tr>
                ) : (
                  schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {s.roomName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {s.buildingName} - {s.floorName}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm">
                          <ClockIcon className="h-4 w-4 text-orange-500" />
                          <span className="tabular-nums">
                            {s.startTime.substring(0, 5)}
                          </span>
                          <span className="text-orange-400">→</span>
                          <span className="tabular-nums">
                            {s.endTime.substring(0, 5)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {s.daysOfWeek.split(",").map((day: string) => (
                            <span
                              key={day}
                              className="rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700"
                            >
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
                                daysOfWeek: s.daysOfWeek.split(","),
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
                  ))
                )}
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
              <span className="text-sm text-slate-500">
                Page {page + 1} of {totalPages}
              </span>
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
              <h2 className="text-xl font-bold text-slate-900">
                Add Academic Schedule
              </h2>
              <button
                onClick={closeAddScheduleModal}
                className="rounded-full p-2 hover:bg-slate-100"
              >
                <XMarkIcon className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleCreateSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Building
                  </label>
                  <AnimatedDropdown<string>
                    value={newScheduleBuildingId}
                    options={addBuildingOptions}
                    onChange={(nextValue) => {
                      setNewScheduleBuildingId(nextValue);
                      setNewScheduleFloorId("");
                      setNewSchedule({ ...newSchedule, roomId: "" });
                      setFormRooms([]);
                      loadFormFloors(nextValue);
                    }}
                    buttonClassName="h-11 border-slate-200 bg-white text-sm font-medium transition-all duration-300 hover:border-orange-300"
                    ariaLabel="Select building for new schedule"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Floor
                  </label>
                  <AnimatedDropdown<string>
                    value={newScheduleFloorId}
                    options={addFloorOptions}
                    onChange={(nextValue) => {
                      setNewScheduleFloorId(nextValue);
                      setNewSchedule({ ...newSchedule, roomId: "" });
                      loadFormRooms(nextValue);
                    }}
                    disabled={!newScheduleBuildingId}
                    buttonClassName="h-11 border-slate-200 bg-white text-sm font-medium transition-all duration-300 hover:border-orange-300"
                    ariaLabel="Select floor for new schedule"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Room
                  </label>
                  <AnimatedDropdown<string>
                    value={newSchedule.roomId}
                    options={addRoomOptions}
                    onChange={(nextValue) =>
                      setNewSchedule({ ...newSchedule, roomId: nextValue })
                    }
                    disabled={!newScheduleFloorId}
                    buttonClassName="h-11 border-slate-200 bg-white text-sm font-medium transition-all duration-300 hover:border-orange-300"
                    ariaLabel="Select room for new schedule"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Start Time
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-orange-50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                      <ClockIcon className="h-3.5 w-3.5" />
                      Hour and minute
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <select
                        required
                        className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-all duration-200 hover:border-orange-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={getHourFromTime(newSchedule.startTime)}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            startTime: `${e.target.value}:${getMinuteFromTime(newSchedule.startTime)}`,
                          })
                        }
                      >
                        {HOUR_OPTIONS.map((hour) => (
                          <option key={`start-hour-${hour}`} value={hour}>
                            {hour}h
                          </option>
                        ))}
                      </select>
                      <span className="text-base font-bold text-orange-500">
                        :
                      </span>
                      <select
                        required
                        className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-all duration-200 hover:border-orange-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={getMinuteFromTime(newSchedule.startTime)}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            startTime: `${getHourFromTime(newSchedule.startTime)}:${e.target.value}`,
                          })
                        }
                      >
                        {MINUTE_OPTIONS.map((minute) => (
                          <option key={`start-minute-${minute}`} value={minute}>
                            {minute}m
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    End Time
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white to-orange-50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-600">
                      <ClockIcon className="h-3.5 w-3.5" />
                      Hour and minute
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <select
                        required
                        className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-all duration-200 hover:border-orange-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={getHourFromTime(newSchedule.endTime)}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            endTime: `${e.target.value}:${getMinuteFromTime(newSchedule.endTime)}`,
                          })
                        }
                      >
                        {HOUR_OPTIONS.map((hour) => (
                          <option key={`end-hour-${hour}`} value={hour}>
                            {hour}h
                          </option>
                        ))}
                      </select>
                      <span className="text-base font-bold text-orange-500">
                        :
                      </span>
                      <select
                        required
                        className="h-10 w-full rounded-lg border border-orange-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition-all duration-200 hover:border-orange-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        value={getMinuteFromTime(newSchedule.endTime)}
                        onChange={(e) =>
                          setNewSchedule({
                            ...newSchedule,
                            endTime: `${getHourFromTime(newSchedule.endTime)}:${e.target.value}`,
                          })
                        }
                      >
                        {MINUTE_OPTIONS.map((minute) => (
                          <option key={`end-minute-${minute}`} value={minute}>
                            {minute}m
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <DatePickerField
                    label="From date"
                    value={newSchedule.fromDate}
                    onChange={(nextDate) =>
                      setNewSchedule({ ...newSchedule, fromDate: nextDate })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <DatePickerField
                    label="To date"
                    value={newSchedule.toDate}
                    minDate={newSchedule.fromDate || undefined}
                    onChange={(nextDate) =>
                      setNewSchedule({ ...newSchedule, toDate: nextDate })
                    }
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Days of Week
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
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
                  <label className="text-sm font-semibold text-slate-700">
                    Description
                  </label>
                  <textarea
                    className="w-full rounded-xl border-slate-200"
                    rows={2}
                    value={newSchedule.description}
                    onChange={(e) =>
                      setNewSchedule({
                        ...newSchedule,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={closeAddScheduleModal}
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
              <h2 className="text-xl font-bold text-slate-900">
                Edit Academic Schedule
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-full p-2 hover:bg-slate-100"
              >
                <XMarkIcon className="h-6 w-6 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleUpdateSchedule} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                    <BuildingOfficeIcon className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Room
                      </p>
                      <p className="text-sm font-bold text-slate-900">
                        {editingSchedule.roomName} (
                        {editingSchedule.buildingName} -{" "}
                        {editingSchedule.floorName})
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Start Time
                  </label>
                  <div className="relative">
                    <ClockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" />
                    <input
                      type="time"
                      required
                      className="h-11 w-full rounded-xl border border-slate-200 bg-gradient-to-br from-white to-orange-50 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition-all duration-300 hover:border-orange-300 focus:-translate-y-0.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      value={editingSchedule.startTime.substring(0, 5)}
                      onChange={(e) =>
                        setEditingSchedule({
                          ...editingSchedule,
                          startTime: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    End Time
                  </label>
                  <div className="relative">
                    <ClockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-orange-500" />
                    <input
                      type="time"
                      required
                      className="h-11 w-full rounded-xl border border-slate-200 bg-gradient-to-br from-white to-orange-50 pl-10 pr-3 text-sm font-medium text-slate-800 outline-none transition-all duration-300 hover:border-orange-300 focus:-translate-y-0.5 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                      value={editingSchedule.endTime.substring(0, 5)}
                      onChange={(e) =>
                        setEditingSchedule({
                          ...editingSchedule,
                          endTime: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <DatePickerField
                    label="From date"
                    value={editingSchedule.fromDate}
                    onChange={(nextDate) =>
                      setEditingSchedule({
                        ...editingSchedule,
                        fromDate: nextDate,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <DatePickerField
                    label="To date"
                    value={editingSchedule.toDate}
                    minDate={editingSchedule.fromDate || undefined}
                    onChange={(nextDate) =>
                      setEditingSchedule({
                        ...editingSchedule,
                        toDate: nextDate,
                      })
                    }
                  />
                </div>
                <div className="col-span-2 space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Days of Week
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
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
                  <label className="text-sm font-semibold text-slate-700">
                    Description
                  </label>
                  <textarea
                    className="w-full rounded-xl border-slate-200"
                    rows={2}
                    value={editingSchedule.description}
                    onChange={(e) =>
                      setEditingSchedule({
                        ...editingSchedule,
                        description: e.target.value,
                      })
                    }
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
              <h2 className="text-xl font-bold text-slate-900">
                Import Schedules
              </h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="rounded-full p-2 hover:bg-slate-100"
              >
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
                      onChange={(e) =>
                        setImportFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                  <p className="mt-2 text-xs text-slate-500">
                    {importFile ? importFile.name : "Support .xlsx, .xls files"}
                  </p>
                </div>
              </div>
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs font-medium text-blue-700 leading-relaxed">
                  Excel structure: RoomCode, StartTime (HH:mm), EndTime (HH:mm),
                  DaysOfWeek (COMMA-SEPARATED), FromDate, ToDate, Description.
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
