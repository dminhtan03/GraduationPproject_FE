import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import { TimePicker, DatePicker } from "antd";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { api } from "../../services/api";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import type { Room } from "../../types";

interface LocationState {
  room?: Room;
}

const DAYS: Array<{ key: string; label: string }> = [
  { key: "MONDAY",    label: "Mon" },
  { key: "TUESDAY",   label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY",  label: "Thu" },
  { key: "FRIDAY",    label: "Fri" },
  { key: "SATURDAY",  label: "Sat" },
  { key: "SUNDAY",    label: "Sun" },
];

// start+ booking recurring room feature
const BookRoomRecurringPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const room = (state as LocationState | null)?.room;
  const normalizedRoomId = useMemo(() => roomId || room?.id || "", [roomId, room]);

  const [form, setForm] = useState({
    startTime: dayjs("08:00", "HH:mm") as Dayjs | null,
    endTime: dayjs("09:00", "HH:mm") as Dayjs | null,
    daysOfWeek: ["MONDAY"] as string[],
    fromDateObj: dayjs() as Dayjs | null,
    untilDateObj: null as Dayjs | null,
    purpose: "",
    note: "",
  });

  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter((d) => d !== day)
        : [...prev.daysOfWeek, day],
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!normalizedRoomId) {
      newErrors.roomId = "Room ID is missing";
    }
    if (!form.startTime) {
      newErrors.startTime = "Start time is required";
    }
    if (!form.endTime) {
      newErrors.endTime = "End time is required";
    }
    if (form.startTime && form.endTime && !form.endTime.isAfter(form.startTime)) {
      newErrors.endTime = "End time must be after start time";
    }
    if (!form.fromDateObj) {
      newErrors.fromDate = "Start date is required";
    }
    if (form.fromDateObj && form.fromDateObj.isBefore(dayjs().startOf("day"))) {
      newErrors.fromDate = "Start date cannot be in the past";
    }
    if (form.daysOfWeek.length === 0) {
      newErrors.daysOfWeek = "Please select at least one day";
    }
    if (!form.purpose.trim()) {
      newErrors.purpose = "Purpose is required";
    }
    if (!acceptedRules) {
      newErrors.rules = "You must agree to the room usage rules";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const startStr = form.startTime?.format("HH:mm:00");
      const endStr = form.endTime?.format("HH:mm:00");
      const fromDateStr = form.fromDateObj?.format("YYYY-MM-DD");
      const untilDateStr = form.untilDateObj?.format("YYYY-MM-DD") || null;

      await api.post(API_ENDPOINTS.RESERVATION_SERIES.CREATE, {
        roomId: normalizedRoomId,
        startTimeOfDay: startStr,
        endTimeOfDay: endStr,
        daysOfWeek: form.daysOfWeek,
        fromDate: fromDateStr,
        untilDate: untilDateStr,
        rollingWindowWeeks: null,
        purpose: form.purpose.trim(),
        note: form.note.trim() || null,
      });
      setToast({ type: "success", message: "Recurring booking created successfully!" });
      window.setTimeout(() => navigate(ROUTES.MY_RECURRING_SERIES), 1500);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "Failed to create recurring booking";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Create Recurring Booking
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Room: <span className="font-semibold">{room?.roomName || normalizedRoomId}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.ROOM_DETAIL.replace(":roomId", normalizedRoomId), { state: { room } })}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Back
            </button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-5">
            {/* Start Time */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Start Time <span className="text-red-500">*</span>
              </label>
              <TimePicker
                value={form.startTime}
                onChange={(time) => {
                  setForm((prev) => ({ ...prev, startTime: time }));
                  if (errors.startTime) setErrors((prev) => ({ ...prev, startTime: "" }));
                }}
                format="HH:mm"
                use12Hours={false}
                className="w-full"
              />
              {errors.startTime && <p className="mt-1 text-xs text-red-500">{errors.startTime}</p>}
            </div>

            {/* End Time */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                End Time <span className="text-red-500">*</span>
              </label>
              <TimePicker
                value={form.endTime}
                onChange={(time) => {
                  setForm((prev) => ({ ...prev, endTime: time }));
                  if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: "" }));
                }}
                format="HH:mm"
                use12Hours={false}
                className="w-full"
              />
              {errors.endTime && <p className="mt-1 text-xs text-red-500">{errors.endTime}</p>}
            </div>

            {/* Days of Week */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Days of Week <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => {
                      toggleDay(d.key);
                      if (errors.daysOfWeek) setErrors((prev) => ({ ...prev, daysOfWeek: "" }));
                    }}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                      form.daysOfWeek.includes(d.key)
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {errors.daysOfWeek && <p className="mt-1 text-xs text-red-500">{errors.daysOfWeek}</p>}
            </div>

            {/* Start Date */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Start Date <span className="text-red-500">*</span>
              </label>
              <DatePicker
                value={form.fromDateObj}
                onChange={(date) => {
                  setForm((prev) => ({ ...prev, fromDateObj: date }));
                  if (errors.fromDate) setErrors((prev) => ({ ...prev, fromDate: "" }));
                }}
                disabledDate={(current) => current && current.isBefore(dayjs().startOf("day"))}
                className="w-full"
              />
              {errors.fromDate && <p className="mt-1 text-xs text-red-500">{errors.fromDate}</p>}
            </div>

            {/* Until Date (Optional) */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Until Date (Optional)
              </label>
              <DatePicker
                value={form.untilDateObj}
                onChange={(date) => setForm((prev) => ({ ...prev, untilDateObj: date }))}
                disabledDate={(current) => current && current.isBefore(dayjs().startOf("day"))}
                className="w-full"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Purpose <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.purpose}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, purpose: e.target.value }));
                  if (errors.purpose) setErrors((prev) => ({ ...prev, purpose: "" }));
                }}
                placeholder="Weekly team meeting..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              />
              {errors.purpose && <p className="mt-1 text-xs text-red-500">{errors.purpose}</p>}
            </div>

            {/* Note */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Note (Optional)
              </label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                placeholder="Additional notes..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
              />
            </div>

            {/* Rules Agreement */}
            <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(e) => {
                  setAcceptedRules(e.target.checked);
                  if (errors.rules) setErrors((prev) => ({ ...prev, rules: "" }));
                }}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span className="leading-5">I have read and agree to comply with the room usage rules.</span>
            </label>
            {errors.rules && <p className="text-xs text-red-500">{errors.rules}</p>}

            {/* Submit Button */}
            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105 disabled:opacity-70"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowPathIcon className="h-5 w-5" />
                {loading ? "Creating..." : "Create Recurring Booking"}
              </span>
            </button>
          </form>
        </div>

        {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} duration={toast.type === "success" ? 2500 : 4000} />}
      </div>
    </div>
  );
};

export default BookRoomRecurringPage;
// end+ booking recurring room feature
