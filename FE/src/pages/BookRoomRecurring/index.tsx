import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { message } from "antd";
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
  { key: "MONDAY", label: "Mon" },
  { key: "TUESDAY", label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY", label: "Thu" },
  { key: "FRIDAY", label: "Fri" },
  { key: "SATURDAY", label: "Sat" },
  { key: "SUNDAY", label: "Sun" },
];

const todayInput = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// start+ chức năng 3 màn hình đặt phòng (màn đặt phòng định kì)
const BookRoomRecurringPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const room = (state as LocationState | null)?.room;
  const normalizedRoomId = useMemo(() => roomId || room?.id || "", [roomId, room]);

  const [startTimeOfDay, setStartTimeOfDay] = useState("08:00");
  const [endTimeOfDay, setEndTimeOfDay] = useState("09:00");
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>(["MONDAY"]);
  const [fromDate, setFromDate] = useState(todayInput());
  const [untilDate, setUntilDate] = useState("");
  const [rollingWeeks, setRollingWeeks] = useState("4");
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ type: MessageType; message: string } | null>(null);

  const showPopup = (type: MessageType, nextMessage: string) => {
    setPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setPopup((current) => (current && current.message === nextMessage ? null : current));
    }, 3000);
  };

  const toggleDay = (day: string) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedRoomId) {
      message.error("Missing room id");
      return;
    }
    if (!acceptedRules) {
      message.warning("Please accept the room rules before confirming.");
      return;
    }
    if (!purpose.trim()) {
      message.warning("Purpose is required.");
      return;
    }
    if (!startTimeOfDay || !endTimeOfDay || startTimeOfDay === endTimeOfDay) {
      message.warning("Start time and end time must be different.");
      return;
    }
    if (!fromDate) {
      message.warning("From date is required.");
      return;
    }
    if (daysOfWeek.length === 0) {
      message.warning("Please select at least 1 day of week.");
      return;
    }

    setLoading(true);
    try {
      const rolling = rollingWeeks.trim() ? Number(rollingWeeks) : null;
      await api.post(API_ENDPOINTS.RESERVATION_SERIES.CREATE, {
        roomId: normalizedRoomId,
        startTimeOfDay: `${startTimeOfDay}:00`,
        endTimeOfDay: `${endTimeOfDay}:00`,
        daysOfWeek,
        fromDate,
        untilDate: untilDate || null,
        rollingWindowWeeks: Number.isFinite(rolling as number) ? (rolling as number) : null,
        purpose: purpose.trim(),
        note: note.trim() || null,
      });

      showPopup("success", "Recurring booking series created successfully");
      window.setTimeout(() => navigate(ROUTES.MY_RECURRING_SERIES), 800);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "Unable to create recurring series";
      showPopup("error", String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Book Room (Recurring)
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

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Start time</label>
                <input
                  type="time"
                  value={startTimeOfDay}
                  onChange={(e) => setStartTimeOfDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">End time</label>
                <input
                  type="time"
                  value={endTimeOfDay}
                  onChange={(e) => setEndTimeOfDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
                <p className="mt-1 text-xs text-slate-500">
                  If end time is earlier than start time, it will be treated as crossing midnight.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Days of week</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-sm font-semibold",
                      daysOfWeek.includes(d.key)
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">From date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Until date (optional)</label>
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Rolling window (weeks)</label>
                <input
                  value={rollingWeeks}
                  onChange={(e) => setRollingWeeks(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Purpose</label>
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="Recurring booking purpose..."
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Note (optional)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="Note..."
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(event) => setAcceptedRules(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span className="leading-5">I have read and agree to follow all room usage rules.</span>
            </label>

            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105 disabled:opacity-70"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowPathIcon className="h-5 w-5" />
                {loading ? "Creating..." : "Create recurring series"}
              </span>
            </button>
          </form>
        </div>

        {popup ? <CustomMessage type={popup.type} message={popup.message} onClose={() => setPopup(null)} /> : null}
      </div>
    </div>
  );
};

export default BookRoomRecurringPage;
// end+ chức năng 3 màn hình đặt phòng (màn đặt phòng định kì)
