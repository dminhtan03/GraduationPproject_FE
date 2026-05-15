import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftIcon, ArrowPathIcon, ClockIcon, CalendarDaysIcon } from "@heroicons/react/24/outline";
import { api } from "../../services/api";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import AnimatedDropdown from "../../components/common/AnimatedDropdown";
import DatePickerField from "../../components/common/DatePickerField";
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

const TIME_HOURS = Array.from({ length: 24 }, (_, i) => {
  const hh = String(i).padStart(2, "0");
  return { value: hh, label: `${hh}h` };
});
const TIME_MINUTES = Array.from({ length: 60 }, (_, i) => {
  const mm = String(i).padStart(2, "0");
  return { value: mm, label: `${mm}m` };
});
const getHH = (t: string) => (t || "00:00").split(":")[0] ?? "00";
const getMM = (t: string) => (t || "00:00").split(":")[1] ?? "00";

const todayInput = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addOneHour = (time: string): string => {
  const [hh, mm = "00"] = time.split(":");
  const next = (parseInt(hh, 10) + 1) % 24;
  return `${String(next).padStart(2, "0")}:${mm}`;
};

// Helper to get available days of week based on date range
const getAvailableDaysOfWeek = (startDateStr: string, untilDateStr: string) => {
  if (!startDateStr) return { available: new Set<number>(), totalDays: 0 };

  const startDate = new Date(startDateStr + "T00:00:00");
  if (isNaN(startDate.getTime())) return { available: new Set<number>(), totalDays: 0 };

  let endDate: Date;
  if (untilDateStr) {
    endDate = new Date(untilDateStr + "T23:59:59");
    if (isNaN(endDate.getTime())) endDate = new Date(startDateStr + "T23:59:59");
  } else {
    endDate = new Date(startDateStr + "T23:59:59");
  }

  const available = new Set<number>();
  const current = new Date(startDate);
  let totalDays = 0;

  while (current <= endDate) {
    // JavaScript: 0=Sunday, 1=Monday, ..., 6=Saturday
    // We need to map to: 0=Monday, 1=Tuesday, ..., 5=Saturday, 6=Sunday
    const jsDay = current.getDay(); // 0-6
    const normalizedDay = (jsDay === 0 ? 6 : jsDay - 1); // 0-6 (0=Mon, 6=Sun)
    available.add(normalizedDay);
    totalDays++;
    current.setDate(current.getDate() + 1);
  }

  return { available, totalDays };
};


// start+ booking recurring room feature
const BookRoomRecurringPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const room = (state as LocationState | null)?.room;
  const normalizedRoomId = useMemo(() => roomId || room?.id || "", [roomId, room]);

  // Real current hour for startTime default
  const currentHour = `${String(new Date().getHours()).padStart(2, "0")}:00`;

  const [startTime, setStartTime] = useState(currentHour);
  const [endTime, setEndTime]     = useState(addOneHour(currentHour));

  const durationExceeds8h = useMemo(() => {
    if (!startTime || !endTime) return false;
    const [sh, sm = "0"] = startTime.split(":");
    const [eh, em = "0"] = endTime.split(":");
    const startMins = parseInt(sh, 10) * 60 + parseInt(sm, 10);
    const endMins   = parseInt(eh, 10) * 60 + parseInt(em, 10);
    if (endMins <= startMins) return false;
    return endMins - startMins > 8 * 60;
  }, [startTime, endTime]);
  const [startDate, setStartDate] = useState(todayInput());
  const [untilDate, setUntilDate] = useState("");

  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(["MONDAY"]);
  const [purpose, setPurpose]       = useState("");
  const [note, setNote]             = useState("");
  const [acceptedRules, setAcceptedRules] = useState(false);

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Calculate available days based on date range
  const { available: availableDaysSet, totalDays } = useMemo(
    () => getAvailableDaysOfWeek(startDate, untilDate),
    [startDate, untilDate],
  );

  // Check if we can select all 7 days
  const canSelectAllDays = totalDays >= 7;

  // Auto-deselect days that are no longer available when date range changes
  React.useEffect(() => {
    if (canSelectAllDays) return; // Can select all days, no need to deselect

    const validDays = daysOfWeek.filter((dayKey) => {
      const dayIndex = DAYS.findIndex((d) => d.key === dayKey);
      return dayIndex !== -1 && availableDaysSet.has(dayIndex);
    });

    if (validDays.length !== daysOfWeek.length) {
      setDaysOfWeek(validDays.length > 0 ? validDays : ["MONDAY"]);
    }
  }, [availableDaysSet, canSelectAllDays]);

  const toggleDay = (day: string) => {
    // Find the index of this day in DAYS array
    const dayIndex = DAYS.findIndex((d) => d.key === day);
    if (dayIndex === -1) return;

    // Check if this day is available (canSelectAllDays OR dayIndex is in availableDaysSet)
    const isDayAvailable = canSelectAllDays || availableDaysSet.has(dayIndex);
    if (!isDayAvailable) return;

    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    if (errors.daysOfWeek) setErrors((prev) => ({ ...prev, daysOfWeek: "" }));
  };

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    setEndTime(addOneHour(val));
    if (errors.startTime) setErrors((prev) => ({ ...prev, startTime: "" }));
  };

  const handleEndTimeChange = (val: string) => {
    setEndTime(val);
    if (errors.endTime) setErrors((prev) => ({ ...prev, endTime: "" }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!normalizedRoomId) newErrors.roomId = "Room ID is missing";
    if (!startTime) newErrors.startTime = "Start time is required";
    if (!endTime)   newErrors.endTime   = "End time is required";
    if (startTime && endTime && endTime <= startTime)
      newErrors.endTime = "End time must be after start time";
    if (startTime && endTime && durationExceeds8h)
      newErrors.endTime = "Maximum booking duration is 8 hours. Please adjust your end time.";
    if (!startDate) newErrors.fromDate = "Start date is required";
    if (startDate && startDate < todayInput()) newErrors.fromDate = "Start date cannot be in the past";
    if (daysOfWeek.length === 0) newErrors.daysOfWeek = "Please select at least one day";
    if (!purpose.trim()) newErrors.purpose = "Purpose is required";
    if (!acceptedRules) newErrors.rules = "You must agree to the room usage rules";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.RESERVATION_SERIES.CREATE, {
        roomId: normalizedRoomId,
        startTimeOfDay: `${startTime}:00`,
        endTimeOfDay:   `${endTime}:00`,
        daysOfWeek,
        fromDate:  startDate,
        untilDate: untilDate || null,
        rollingWindowWeeks: null,
        purpose: purpose.trim(),
        note:    note.trim() || null,
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

          {/* ── Header ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Create Recurring Booking
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Room:{" "}
                <span className="font-semibold text-orange-600">
                  {room?.roomName || normalizedRoomId}
                </span>
              </p>
            </div>
            {/* Back — orange, matches all other screens */}
            <button
              type="button"
              onClick={() => navigate(ROUTES.ROOM_DETAIL.replace(":roomId", normalizedRoomId), { state: { room } })}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-6">

            {/* ── Time row (Start + End same line) ── */}
            <div className=" rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white">
              <div className="flex items-center gap-2 border-b border-orange-100 px-5 py-4">
                <ClockIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-bold text-slate-900">Daily Time Slot</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5">
                {/* Start Time */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Start Time <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <AnimatedDropdown<string>
                      value={getHH(startTime)}
                      options={TIME_HOURS}
                      onChange={(h) => handleStartTimeChange(`${h}:${getMM(startTime)}`)}
                      buttonClassName={`h-[38px] px-2.5 text-xs font-semibold tabular-nums ${errors.startTime ? "!border-red-400" : ""}`}
                      ariaLabel="Start hour"
                    />
                    <AnimatedDropdown<string>
                      value={getMM(startTime)}
                      options={TIME_MINUTES}
                      onChange={(m) => handleStartTimeChange(`${getHH(startTime)}:${m}`)}
                      buttonClassName={`h-[38px] px-2.5 text-xs font-semibold tabular-nums ${errors.startTime ? "!border-red-400" : ""}`}
                      ariaLabel="Start minute"
                    />
                  </div>
                  {errors.startTime && <p className="text-xs text-red-500">{errors.startTime}</p>}
                </div>

                {/* End Time */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-sm font-semibold ${errors.endTime ? "text-red-600" : "text-slate-700"}`}>
                    End Time <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <AnimatedDropdown<string>
                      value={getHH(endTime)}
                      options={TIME_HOURS}
                      onChange={(h) => handleEndTimeChange(`${h}:${getMM(endTime)}`)}
                      buttonClassName={`h-[38px] px-2.5 text-xs font-semibold tabular-nums ${errors.endTime ? "!border-red-400" : ""}`}
                      ariaLabel="End hour"
                    />
                    <AnimatedDropdown<string>
                      value={getMM(endTime)}
                      options={TIME_MINUTES}
                      onChange={(m) => handleEndTimeChange(`${getHH(endTime)}:${m}`)}
                      buttonClassName={`h-[38px] px-2.5 text-xs font-semibold tabular-nums ${errors.endTime ? "!border-red-400" : ""}`}
                      ariaLabel="End minute"
                    />
                  </div>
                  {errors.endTime && <p className="text-xs text-red-500">{errors.endTime}</p>}
                </div>

                {durationExceeds8h && !errors.endTime && (
                  <div className="col-span-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Maximum booking duration is 8 hours. Please adjust your end time.
                  </div>
                )}
              </div>
            </div>

            {/* ── Date row (Start + Until same line) ── */}
            <div className=" rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <CalendarDaysIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-bold text-slate-900">Date Range</p>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5">
                {/* Start Date */}
                <div className="flex flex-col gap-1.5">
                  <label className={`text-sm font-semibold ${errors.fromDate ? "text-red-600" : "text-slate-700"}`}>
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <DatePickerField
                    value={startDate}
                    onChange={(v) => {
                      setStartDate(v);
                      if (errors.fromDate) setErrors((prev) => ({ ...prev, fromDate: "" }));
                    }}
                    minDate={todayInput()}
                  />
                  {errors.fromDate && <p className="text-xs text-red-500">{errors.fromDate}</p>}
                </div>

                {/* Until Date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Until Date{" "}
                    <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
                  </label>
                  <DatePickerField
                    value={untilDate}
                    onChange={setUntilDate}
                    minDate={startDate || todayInput()}
                  />
                </div>
              </div>
            </div>

            {/* ── Days of Week ── */}
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Days of Week <span className="text-red-500">*</span>
                </label>
                {!canSelectAllDays && totalDays > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    Only {totalDays} day{totalDays !== 1 ? "s" : ""} selected: you can only choose days that occur in this range.
                    Select a date range with ≥7 days to choose all 7 days.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d, idx) => {
                  const isAvailable = canSelectAllDays || availableDaysSet.has(idx);
                  const isSelected = daysOfWeek.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => toggleDay(d.key)}
                      className={[
                        "rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors",
                        isAvailable
                          ? isSelected
                            ? "border-orange-300 bg-orange-500 text-white shadow-sm cursor-pointer"
                            : "border-slate-300 text-slate-600 hover:border-orange-200 hover:bg-orange-50 cursor-pointer"
                          : "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-50",
                      ].join(" ")}
                      title={!isAvailable ? `${d.label} is not available in this date range` : ""}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              {errors.daysOfWeek && <p className="text-xs text-red-500">{errors.daysOfWeek}</p>}
            </div>

            {/* ── Purpose & Note ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => {
                    setPurpose(e.target.value);
                    if (errors.purpose) setErrors((prev) => ({ ...prev, purpose: "" }));
                  }}
                  placeholder="Weekly team meeting..."
                  className={`rounded-xl border px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 ${errors.purpose ? "border-red-400 bg-red-50" : "border-slate-300 bg-white"}`}
                />
                {errors.purpose && <p className="text-xs text-red-500">{errors.purpose}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Note{" "}
                  <span className="text-[11px] font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional notes..."
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>

            {/* ── Room Usage Rules ── */}
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
              <h3 className="mb-4 text-base font-bold text-emerald-900">Room usage rules</h3>
              <ul className="space-y-3 text-sm text-emerald-900">
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">1.</span>
                  <div>
                    <p className="font-medium">Sau khi book phòng nếu thay đổi kế hoạch và không có nhu cầu sử dụng cần thao tác hủy phòng trước thời gian đăng ký sử dụng / If plans change and the room is not needed, please cancel the booking before the scheduled time.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">2.</span>
                  <div>
                    <p className="font-medium">Chỉ được book phòng cho mục đích học tập, nếu sử dụng sai mục đích hoặc book nhưng không sử dụng sẽ bị cấm book phòng trong 1 kỳ / Rooms are only for study purposes. Misuse or booking without usage will result in a ban for one term.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">3.</span>
                  <div>
                    <p className="font-medium">Đảm bảo CSVC trong phòng, nếu hư phòng sẽ phải bồi theo quy định / Ensure the facilities in the room are intact. Damages will require compensation as per regulations.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">4.</span>
                  <div>
                    <p className="font-medium">Trả lại nguyên hiện trạng ban đầu của phòng sau khi sử dụng / Return the room to its original condition after use.</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">5.</span>
                  <div>
                    <p className="font-medium">Trong quá trình sử dụng không tự ý mang CSVC ra khỏi phòng học / Do not remove any facilities from the room during usage.</p>
                  </div>
                </li>
              </ul>
            </div>

            {/* ── Rules Agreement ── */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-slate-700 transition hover:bg-emerald-100/60">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(e) => {
                  setAcceptedRules(e.target.checked);
                  if (errors.rules) setErrors((prev) => ({ ...prev, rules: "" }));
                }}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span className="leading-relaxed font-medium">
                I have read and agree to follow all room usage rules.
              </span>
            </label>
            {errors.rules && <p className="text-xs text-red-500">{errors.rules}</p>}

            {/* ── Submit ── */}
            <button
              disabled={loading}
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105 disabled:opacity-70"
            >
              <ArrowPathIcon className="h-5 w-5" />
              {loading ? "Creating…" : "Create Recurring Booking"}
            </button>
          </form>
        </div>

        {toast && (
          <CustomMessage
            type={toast.type}
            message={toast.message}
            onClose={() => setToast(null)}
            duration={toast.type === "success" ? 2500 : 4000}
          />
        )}
      </div>
    </div>
  );
};

export default BookRoomRecurringPage;
// end+ booking recurring room feature