import React, { useEffect, useMemo, useState } from "react";
import { Typography, Tag } from "antd";
import { ClockIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { api } from "../../services/api";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import { roomService } from "../../services/roomService";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import { extractApiMessage } from "../../utils/errorHandlers";
import DatePickerField from "../../components/common/DatePickerField";
import TimeSelectField from "../../components/common/TimeSelectField";
import {
  DEFAULT_RECURRING_SERIES_DAYS,
  RECURRING_SERIES_DAYS,
  type RecurringSeriesDay,
} from "../../constants/recurringSeries";
import type { RecurringSeries, RoomOption } from "../../types/recurringSeries";
import {
  buildRoomOptionsFromMap,
  formatDateRange,
  formatDaysOfWeek,
  formatTimeRange,
  getRecurringSeriesStatusColor,
  toMinutesFromTime,
  toTimeWithSeconds,
} from "../../utils/recurringSeries";
import { getCurrentTimeRange, toDateInputValue } from "../../utils";

const { Title, Paragraph } = Typography;

// start+ chức năng đặt phòng lặp lại (demo UI)
const MyRecurringSeriesPage: React.FC = () => {
  const [series, setSeries] = useState<RecurringSeries[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomSearch, setRoomSearch] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const createDefaultForm = () => {
    const timeRange = getCurrentTimeRange();
    return {
      roomId: "",
      roomName: "",
      startTime: `${timeRange.startHour}:${timeRange.startMinute}`,
      endTime: `${timeRange.endHour}:${timeRange.endMinute}`,
      daysOfWeek: [...DEFAULT_RECURRING_SERIES_DAYS],
      fromDate: timeRange.startDate,
      untilDate: "",
      purpose: "Recurring booking",
      note: "",
    };
  };

  const [form, setForm] = useState(createDefaultForm);

  // Load all rooms for search
  useEffect(() => {
    if (!isModalOpen) return;

    const cached = roomService.getRoomsMapCached();
    const hasCached = Boolean(cached);

    if (cached) {
      setRooms(buildRoomOptionsFromMap(cached));
      setRoomsLoading(false);
    }

    const loadRooms = async () => {
      if (!hasCached) {
        setRoomsLoading(true);
      }
      try {
        const roomsMap = await roomService.getRoomsMap();
        setRooms(buildRoomOptionsFromMap(roomsMap));
      } catch (err: unknown) {
        setToast({
          type: "error",
          message: extractApiMessage(err, "Failed to load rooms"),
        });
      } finally {
        setRoomsLoading(false);
      }
    };

    loadRooms();
  }, [isModalOpen]);

  const payload = useMemo(() => {
    return {
      roomId: form.roomId.trim(),
      startTimeOfDay: form.startTime ? toTimeWithSeconds(form.startTime) : null,
      endTimeOfDay: form.endTime ? toTimeWithSeconds(form.endTime) : null,
      daysOfWeek: form.daysOfWeek,
      fromDate: form.fromDate ? form.fromDate : null,
      untilDate: form.untilDate ? form.untilDate : null,
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
      const startMinutes = toMinutesFromTime(form.startTime);
      const endMinutes = toMinutesFromTime(form.endTime);
      if (!Number.isNaN(startMinutes) && !Number.isNaN(endMinutes)) {
        if (endMinutes <= startMinutes) {
          errors.endTimeOfDay = "End time must be later than start time";
        }
      }
    }

    if (!form.fromDate) {
      errors.fromDate = "From date is required";
    } else {
      const todayValue = toDateInputValue(new Date());
      if (form.fromDate < todayValue) {
        errors.fromDate = "From date cannot be in the past";
      }
    }

    if (form.untilDate && form.fromDate && form.untilDate < form.fromDate) {
      errors.untilDate = "Until date must be after from date";
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

    return rooms.filter(
      (room) =>
        room.locationCode.toLowerCase().includes(search) ||
        room.roomName.toLowerCase().includes(search) ||
        room.id.toLowerCase().includes(search),
    );
  }, [rooms, roomSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.RESERVATION_SERIES.MY);
      const payload = res.data as { data?: unknown } | unknown;
      const raw =
        payload && typeof payload === "object" && "data" in payload
          ? (payload as { data?: unknown }).data
          : payload;
      setSeries(Array.isArray(raw) ? (raw as RecurringSeries[]) : []);
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: extractApiMessage(err, "Failed to load series"),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openModal = () => {
    setForm(createDefaultForm());
    setFormErrors({});
    setRoomSearch("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormErrors({});
    setRoomSearch("");
  };

  const toggleDay = (day: RecurringSeriesDay) => {
    setForm((prev) => {
      const exists = prev.daysOfWeek.includes(day);
      return {
        ...prev,
        daysOfWeek: exists
          ? prev.daysOfWeek.filter((d) => d !== day)
          : [...prev.daysOfWeek, day],
      };
    });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setToast({ type: "error", message: "Please fix the errors in the form" });
      return;
    }

    if (
      !payload.roomId ||
      !payload.startTimeOfDay ||
      !payload.endTimeOfDay ||
      !payload.fromDate
    )
      return;
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
      closeModal();
      setForm(createDefaultForm());
      load();
    } catch (err: unknown) {
      const msg = extractApiMessage(err, "Create series failed");
      setToast({ type: "error", message: String(msg) });
    }
  };

  const syncNow = async (seriesId: string) => {
    try {
      await api.put(
        buildUrl(API_ENDPOINTS.RESERVATION_SERIES.SYNC, { seriesId }),
      );
      setToast({ type: "success", message: "Synced successfully" });
      load();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: extractApiMessage(err, "Sync failed"),
      });
    }
  };

  const cancel = async (seriesId: string) => {
    if (
      !window.confirm(
        "Cancel this recurring series? Future reservations will be cancelled.",
      )
    )
      return;
    try {
      await api.delete(
        buildUrl(API_ENDPOINTS.RESERVATION_SERIES.CANCEL, { seriesId }),
      );
      setToast({ type: "success", message: "Series cancelled" });
      load();
    } catch (err: unknown) {
      setToast({
        type: "error",
        message: extractApiMessage(err, "Cancel failed"),
      });
    }
  };

  return (
    <div className="fade-in">
      <Title level={2}>My Recurring Series</Title>
      <Paragraph className="text-gray-600 mb-6">
        Manage your recurring room reservations. Create series to automatically
        book rooms on a regular schedule.
      </Paragraph>

      {/* <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Recurring Series
            </p>
          </div>
          <button
            onClick={openModal}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
          >
            Create series
          </button>
        </div>

      </div> */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                Room
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                Time
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                Days
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                Range
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">
                Status
              </th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  Loading...
                </td>
              </tr>
            ) : series.length ? (
              series.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">
                      {s.roomCode}
                    </div>
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
                      <span className="font-medium">
                        {formatDateRange(s.fromDate, s.untilDate)}
                      </span>
                    </div>
                  </td>

                  {/* Status Cell */}
                  <td className="px-4 py-3">
                    <Tag
                      color={getRecurringSeriesStatusColor(s.status)}
                      className="px-2 py-1 text-xs font-semibold"
                    >
                      {s.status}
                    </Tag>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      {/* <button
                        onClick={() => syncNow(s.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Sync now
                      </button> */}
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
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-sm text-slate-500"
                >
                  No recurring series yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 px-4 py-6 backdrop-blur-sm sm:items-center sm:px-6 sm:py-10">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-4 text-white sm:px-6">
              <div>
                <h2 className="text-lg font-bold">Create recurring series</h2>
                <p className="text-xs text-orange-100">
                  Auto-book rooms on a weekly schedule.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-full border border-white/40 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <form
              onSubmit={create}
              className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6"
            >
              <section className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Room selection
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by room name, code, or ID..."
                    value={roomSearch}
                    onChange={(e) => setRoomSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-orange-200"
                  />

                  {roomSearch && (
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg z-10">
                      {roomsLoading && (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          Loading rooms...
                        </div>
                      )}
                      {!roomsLoading && filteredRooms.length === 0 && (
                        <div className="px-4 py-3 text-sm text-slate-500">
                          No rooms found
                        </div>
                      )}
                      {!roomsLoading &&
                        filteredRooms.map((room) => (
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
                            className="w-full px-4 py-2.5 text-left text-sm transition hover:bg-orange-50 border-b border-slate-100 last:border-b-0"
                          >
                            <div className="font-medium text-slate-900">
                              {room.roomName}
                            </div>
                            <div className="text-xs text-slate-500">
                              {room.locationCode || room.id}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {form.roomId && (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-700">
                    <span>{form.roomName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((p) => ({ ...p, roomId: "", roomName: "" }));
                        setRoomSearch("");
                      }}
                      className="text-orange-600 hover:text-orange-800"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {formErrors.roomId && (
                  <p className="mt-2 text-xs text-rose-500">
                    {formErrors.roomId}
                  </p>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Schedule
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Start time <span className="text-red-500">*</span>
                    </label>
                    <TimeSelectField
                      value={form.startTime}
                      onChange={(nextValue) => {
                        setForm((p) => ({ ...p, startTime: nextValue }));
                        setFormErrors((p) => ({
                          ...p,
                          startTimeOfDay: "",
                          endTimeOfDay: "",
                        }));
                      }}
                      error={formErrors.startTimeOfDay}
                      minuteStep={5}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      End time <span className="text-red-500">*</span>
                    </label>
                    <TimeSelectField
                      value={form.endTime}
                      onChange={(nextValue) => {
                        setForm((p) => ({ ...p, endTime: nextValue }));
                        setFormErrors((p) => ({ ...p, endTimeOfDay: "" }));
                      }}
                      error={formErrors.endTimeOfDay}
                      minuteStep={5}
                    />
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <DatePickerField
                      label="From date"
                      value={form.fromDate}
                      minDate={toDateInputValue(new Date())}
                      onChange={(nextDate) => {
                        setForm((p) => ({ ...p, fromDate: nextDate }));
                        setFormErrors((p) => ({ ...p, fromDate: "" }));
                      }}
                    />
                    {formErrors.fromDate && (
                      <p className="mt-1 text-xs text-rose-500">
                        {formErrors.fromDate}
                      </p>
                    )}
                  </div>
                  <div>
                    <DatePickerField
                      label="Until date (optional)"
                      value={form.untilDate}
                      minDate={form.fromDate || toDateInputValue(new Date())}
                      onChange={(nextDate) => {
                        setForm((p) => ({ ...p, untilDate: nextDate }));
                        setFormErrors((p) => ({ ...p, untilDate: "" }));
                      }}
                    />
                    {formErrors.untilDate && (
                      <p className="mt-1 text-xs text-rose-500">
                        {formErrors.untilDate}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Days of week
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {RECURRING_SERIES_DAYS.map((day) => (
                      <button
                        type="button"
                        key={day.key}
                        onClick={() => {
                          toggleDay(day.key);
                          setFormErrors((p) => ({ ...p, daysOfWeek: "" }));
                        }}
                        className={[
                          "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                          form.daysOfWeek.includes(day.key)
                            ? "border-orange-200 bg-orange-50 text-orange-700"
                            : "border-slate-300 text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  {formErrors.daysOfWeek && (
                    <p className="mt-1 text-xs text-rose-500">
                      {formErrors.daysOfWeek}
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Details
                </div>
                <div className="space-y-4">
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
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-200 transition ${
                        formErrors.purpose
                          ? "border-rose-300"
                          : "border-slate-300"
                      }`}
                    />
                    {formErrors.purpose && (
                      <p className="mt-1 text-xs text-rose-500">
                        {formErrors.purpose}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Note (optional)
                    </label>
                    <input
                      value={form.note}
                      onChange={(e) =>
                        setForm((p) => ({ ...p, note: e.target.value }))
                      }
                      className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </div>
                </div>
              </section>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
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
