import React, { useEffect, useMemo, useState } from "react";
import { Typography, TimePicker, DatePicker, Tag } from "antd";
import { ClockIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import dayjs, { type Dayjs } from "dayjs";
import { api } from "../../services/api";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { roomService } from "../../services/roomService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import { extractApiMessage } from "../../utils/errorHandlers";

const { Title, Paragraph } = Typography;

type Series = {
  id: string;
  roomId: string;
  roomCode: string;
  startTimeOfDay: string;
  endTimeOfDay: string;
  daysOfWeek: string;
  purpose: string;
  note?: string | null;
  fromDate: string;
  untilDate?: string | null;
  rollingWindowWeeks?: number | null;
  status: string;
  lastSyncUntil?: string | null;
  createdAt?: string | null;
};

type RoomOption = {
  id: string;
  locationCode: string;
  roomName: string;
};

const DAYS: Array<{ key: string; label: string }> = [
  { key: "MONDAY", label: "Mon" },
  { key: "TUESDAY", label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY", label: "Thu" },
  { key: "FRIDAY", label: "Fri" },
  { key: "SATURDAY", label: "Sat" },
  { key: "SUNDAY", label: "Sun" },
];

// Helper: Convert DAYS string to short labels
const formatDaysOfWeek = (daysString: string): string => {
  if (!daysString) return "";
  const days = daysString.split(",").map((d) => d.trim());
  return days
    .map((day) => {
      const found = DAYS.find((d) => d.key === day);
      return found ? found.label : day;
    })
    .join(", ");
};

// Helper: Format date range
const formatDateRange = (fromDate: string, untilDate?: string | null): string => {
  if (!fromDate) return "-";
  const from = fromDate.split("-").slice(1).reverse().join("/"); // YYYY-MM-DD → DD/MM
  if (!untilDate) return from;
  const until = untilDate.split("-").slice(1).reverse().join("/");
  return `${from} → ${until}`;
};

// Helper: Format time
const formatTimeRange = (startTime: string, endTime: string): string => {
  return `${String(startTime).slice(0, 5)} - ${String(endTime).slice(0, 5)}`;
};

// Helper: Get status color
const getStatusColor = (status: string): string => {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") return "success";
  if (upper === "CANCELLED") return "error";
  if (upper === "PAUSED") return "warning";
  return "default";
};

// start+ chức năng đặt phòng lặp lại (demo UI)
const MyRecurringSeriesPage: React.FC = () => {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(
    null,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const [form, setForm] = useState({
    roomId: "",
    roomName: "",
    startTimeOfDay: "08:00",
    endTimeOfDay: "09:00",
    startTime: dayjs("08:00", "HH:mm") as Dayjs | null,
    endTime: dayjs("09:00", "HH:mm") as Dayjs | null,
    daysOfWeek: ["MONDAY", "WEDNESDAY", "FRIDAY"] as string[],
    fromDate: "",
    untilDate: "",
    fromDateObj: null as Dayjs | null,
    untilDateObj: null as Dayjs | null,
    purpose: "Recurring booking",
    note: "",
  });

  // Load all rooms for search
  useEffect(() => {
    if (!isModalOpen) return;
    
    const loadRooms = async () => {
      setRoomsLoading(true);
      try {
        const roomsMap = await roomService.getRoomsMap();
        const allRooms: RoomOption[] = [];
        
        if (roomsMap.buildingResponse) {
          roomsMap.buildingResponse.forEach((building) => {
            building.floors?.forEach((floor) => {
              floor.rooms?.forEach((room: any) => {
                if (room.roomId || room.id) {
                  allRooms.push({
                    id: room.roomId || room.id,
                    locationCode: room.locationCode || "",
                    roomName: room.roomName || room.locationCode || room.roomId || room.id,
                  });
                }
              });
            });
          });
        }
        
        setRooms(allRooms);
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || "Failed to load rooms";
        setToast({ type: "error", message: String(msg) });
      } finally {
        setRoomsLoading(false);
      }
    };
    
    loadRooms();
  }, [isModalOpen]);

  const payload = useMemo(() => {
    // Convert dayjs objects to string format
    const start = form.startTime ? form.startTime.format("HH:mm:00") : null;
    const end = form.endTime ? form.endTime.format("HH:mm:00") : null;
    const fromDateStr = form.fromDateObj ? form.fromDateObj.format("YYYY-MM-DD") : null;
    const untilDateStr = form.untilDateObj ? form.untilDateObj.format("YYYY-MM-DD") : null;
    
    return {
      roomId: form.roomId.trim(),
      startTimeOfDay: start,
      endTimeOfDay: end,
      daysOfWeek: form.daysOfWeek,
      fromDate: fromDateStr,
      untilDate: untilDateStr,
      rollingWindowWeeks: null,
      purpose: form.purpose.trim(),
      note: form.note.trim() || null,
    };
  }, [form]);

  // Validation logic
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!form.roomId.trim()) {
      errors.roomId = "Please select a room";
    }

    if (!form.startTime) {
      errors.startTimeOfDay = "Start time is required";
    }

    if (!form.endTime) {
      errors.endTimeOfDay = "End time is required";
    }

    if (form.startTime && form.endTime) {
      if (!form.endTime.isAfter(form.startTime)) {
        errors.endTimeOfDay = "End time must be later than start time";
      }
    }

    if (!form.fromDateObj) {
      errors.fromDate = "From date is required";
    } else {
      const today = dayjs().startOf("day");
      if (form.fromDateObj.isBefore(today)) {
        errors.fromDate = "From date cannot be in the past";
      }
    }

    if (!form.purpose.trim()) {
      errors.purpose = "Purpose is required";
    }

    if (form.daysOfWeek.length === 0) {
      errors.daysOfWeek = "Please select at least one day";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Filtered rooms based on search
  const filteredRooms = useMemo(() => {
    const search = roomSearch.toLowerCase().trim();
    if (!search) return rooms;

    return rooms.filter((room) =>
      room.locationCode.toLowerCase().includes(search) ||
      room.roomName.toLowerCase().includes(search) ||
      room.id.toLowerCase().includes(search)
    );
  }, [rooms, roomSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.RESERVATION_SERIES.MY);
      const raw = (res.data as any)?.data ?? res.data;
      setSeries(Array.isArray(raw) ? (raw as Series[]) : []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to load series";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (day: string) => {
    setForm((prev) => {
      const exists = prev.daysOfWeek.includes(day);
      return {
        ...prev,
        daysOfWeek: exists ? prev.daysOfWeek.filter((d) => d !== day) : [...prev.daysOfWeek, day],
      };
    });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      setToast({ type: "error", message: "Please fix the errors in the form" });
      return;
    }

    if (!payload.roomId || !payload.startTimeOfDay || !payload.endTimeOfDay || !payload.fromDate) return;
    if (!payload.purpose) return;
    if (!payload.daysOfWeek.length) return;

    try {
      await api.post(API_ENDPOINTS.RESERVATION_SERIES.CREATE, {
        roomId: payload.roomId,
        startTimeOfDay: payload.startTimeOfDay,
        endTimeOfDay: payload.endTimeOfDay,
        daysOfWeek: payload.daysOfWeek,
        fromDate: payload.fromDate,
        untilDate: payload.untilDate,
        rollingWindowWeeks: payload.rollingWindowWeeks,
        purpose: payload.purpose,
        note: payload.note,
      });
      setToast({ type: "success", message: "Series created and synced" });
      setIsModalOpen(false);
      setFormErrors({});
      setForm({
        roomId: "",
        roomName: "",
        startTimeOfDay: "08:00",
        endTimeOfDay: "09:00",
        startTime: dayjs("08:00", "HH:mm"),
        endTime: dayjs("09:00", "HH:mm"),
        daysOfWeek: ["MONDAY", "WEDNESDAY", "FRIDAY"],
        fromDate: "",
        untilDate: "",
        fromDateObj: null,
        untilDateObj: null,
        purpose: "Recurring booking",
        note: "",
      });
      load();
    } catch (err: any) {
      const msg = extractApiMessage(err, "Create series failed");
      setToast({ type: "error", message: String(msg) });
    }
  };

  const syncNow = async (seriesId: string) => {
    try {
      await api.put(buildUrl(API_ENDPOINTS.RESERVATION_SERIES.SYNC, { seriesId }));
      setToast({ type: "success", message: "Synced successfully" });
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Sync failed";
      setToast({ type: "error", message: String(msg) });
    }
  };

  const cancel = async (seriesId: string) => {
    if (!window.confirm("Cancel this recurring series? Future reservations will be cancelled.")) return;
    try {
      await api.delete(buildUrl(API_ENDPOINTS.RESERVATION_SERIES.CANCEL, { seriesId }));
      setToast({ type: "success", message: "Series cancelled" });
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Cancel failed";
      setToast({ type: "error", message: String(msg) });
    }
  };

  return (
    <div className="fade-in">
      <Title level={2}>My Recurring Series</Title>
      <Paragraph className="text-gray-600 mb-6">
        Manage your recurring room reservations. Create series to automatically book rooms on a regular schedule.
      </Paragraph>

      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-700">Recurring Series</p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
          >
            Create series
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Room</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Time</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Days</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Range</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : series.length ? (
              series.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{s.roomCode}</div>
                  </td>
                  
                  {/* Time Cell */}
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5">
                      <ClockIcon className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        {formatTimeRange(s.startTimeOfDay, s.endTimeOfDay)}
                      </span>
                    </div>
                  </td>
                  
                  {/* Days Cell */}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {formatDaysOfWeek(s.daysOfWeek)
                        .split(", ")
                        .map((day, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center justify-center rounded-md bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700 min-w-[2.5rem]"
                          >
                            {day}
                          </span>
                        ))}
                    </div>
                  </td>
                  
                  {/* Range Cell */}
                  <td className="px-4 py-3">
                    <div className="inline-flex items-center gap-2 text-sm text-slate-700">
                      <CalendarDaysIcon className="h-4 w-4 text-amber-600" />
                      <span className="font-medium">{formatDateRange(s.fromDate, s.untilDate)}</span>
                    </div>
                  </td>
                  
                  {/* Status Cell */}
                  <td className="px-4 py-3">
                    <Tag color={getStatusColor(s.status)} className="px-2 py-1 text-xs font-semibold">
                      {s.status}
                    </Tag>
                  </td>
                  
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => syncNow(s.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Sync now
                      </button>
                      <button
                        onClick={() => cancel(s.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No recurring series yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 z-10">
              <h2 className="text-lg font-bold text-slate-900">Create recurring series</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFormErrors({});
                  setRoomSearch("");
                }}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={create} className="space-y-4 px-6 py-5">
              {/* Room Select with Search */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Room Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by room name, code, or ID..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                  
                  {/* Dropdown List */}
                  {roomSearch && filteredRooms.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg z-10">
                      {filteredRooms.map((room) => (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => {
                            setForm((p) => ({
                              ...p,
                              roomId: room.id,
                              roomName: room.roomName,
                            }));
                            setRoomSearch("");
                            setFormErrors((p) => ({ ...p, roomId: "" }));
                          }}
                          className="w-full block px-4 py-2.5 text-left text-sm hover:bg-orange-50 border-b border-slate-100 last:border-b-0 transition"
                        >
                          <div className="font-medium text-slate-900">{room.roomName}</div>
                          <div className="text-xs text-slate-500">{room.locationCode || room.id}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {roomSearch && filteredRooms.length === 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg z-10">
                      <div className="px-4 py-3 text-sm text-slate-500">No rooms found</div>
                    </div>
                  )}
                </div>
                
                {form.roomId && (
                  <div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-orange-50 px-3 py-1.5 text-sm">
                    <span className="text-orange-700 font-medium">{form.roomName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((p) => ({ ...p, roomId: "", roomName: "" }));
                        setRoomSearch("");
                      }}
                      className="text-orange-600 hover:text-orange-700 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}
                
                {formErrors.roomId && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.roomId}</p>
                )}
              </div>

              {/* Time Inputs - Using Ant Design TimePicker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <TimePicker
                    value={form.startTime}
                    onChange={(time) => {
                      setForm((p) => ({ ...p, startTime: time }));
                      setFormErrors((p) => ({ ...p, startTimeOfDay: "", endTimeOfDay: "" }));
                    }}
                    format="HH:mm"
                    placeholder="Select start time"
                    className={`w-full ${formErrors.startTimeOfDay ? "ant-input-status-error" : ""}`}
                    status={formErrors.startTimeOfDay ? "error" : undefined}
                  />
                  {formErrors.startTimeOfDay && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.startTimeOfDay}</p>
                  )}
                </div>
                
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <TimePicker
                    value={form.endTime}
                    onChange={(time) => {
                      setForm((p) => ({ ...p, endTime: time }));
                      setFormErrors((p) => ({ ...p, endTimeOfDay: "" }));
                    }}
                    format="HH:mm"
                    placeholder="Select end time"
                    className={`w-full ${formErrors.endTimeOfDay ? "ant-input-status-error" : ""}`}
                    status={formErrors.endTimeOfDay ? "error" : undefined}
                  />
                  {formErrors.endTimeOfDay && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.endTimeOfDay}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Days of week <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      type="button"
                      key={d.key}
                      onClick={() => {
                        toggleDay(d.key);
                        setFormErrors((p) => ({ ...p, daysOfWeek: "" }));
                      }}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                        form.daysOfWeek.includes(d.key)
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                {formErrors.daysOfWeek && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.daysOfWeek}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    From date <span className="text-red-500">*</span>
                  </label>
                  <DatePicker
                    value={form.fromDateObj}
                    onChange={(date) => {
                      setForm((p) => ({ ...p, fromDateObj: date }));
                      setFormErrors((p) => ({ ...p, fromDate: "" }));
                    }}
                    disabledDate={(current) => {
                      return current && current.isBefore(dayjs().startOf("day"));
                    }}
                    placeholder="Select from date"
                    format="DD/MM/YYYY"
                    className={`w-full ${formErrors.fromDate ? "ant-input-status-error" : ""}`}
                    status={formErrors.fromDate ? "error" : undefined}
                  />
                  {formErrors.fromDate && (
                    <p className="mt-1 text-xs text-red-500">{formErrors.fromDate}</p>
                  )}
                </div>
                
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Until date (optional)</label>
                  <DatePicker
                    value={form.untilDateObj}
                    onChange={(date) => setForm((p) => ({ ...p, untilDateObj: date }))}
                    placeholder="Select until date"
                    format="DD/MM/YYYY"
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.purpose}
                  onChange={(e) => {
                    setForm((p) => ({ ...p, purpose: e.target.value }));
                    setFormErrors((p) => ({ ...p, purpose: "" }));
                  }}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200 transition ${
                    formErrors.purpose ? "border-red-300" : "border-slate-300"
                  }`}
                />
                {formErrors.purpose && (
                  <p className="mt-1 text-xs text-red-500">{formErrors.purpose}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Note (optional)</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormErrors({});
                    setRoomSearch("");
                  }}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roomsLoading}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <CustomMessage
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
          duration={toast.type === "success" ? 2500 : 4000}
        />
      ) : null}
    </div>
  );
};

export default MyRecurringSeriesPage;
// end+ chức năng đặt phòng lặp lại (demo UI)

