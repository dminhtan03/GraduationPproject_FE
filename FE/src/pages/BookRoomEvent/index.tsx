import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { message } from "antd";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import type { Room } from "../../types";

interface LocationState {
  room?: Room;
}

const todayInput = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const combine = (date: string, time: string) => {
  if (!date || !time) return "";
  return `${date}T${time}`;
};

// start+ chức năng 3 màn hình đặt phòng (màn đặt phòng sự kiện)
const BookRoomEventPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const room = (state as LocationState | null)?.room;
  const normalizedRoomId = useMemo(() => roomId || room?.id || "", [roomId, room]);

  const [startDate, setStartDate] = useState(todayInput());
  const [startTime, setStartTime] = useState("08:00");
  const [endDate, setEndDate] = useState(todayInput());
  const [endTime, setEndTime] = useState("09:00");
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");

  const [eventTitle, setEventTitle] = useState("Meeting Event");
  const [eventDescription, setEventDescription] = useState("");
  const [visibility, setVisibility] = useState<"INVITE_ONLY" | "PUBLIC">("INVITE_ONLY");

  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ type: MessageType; message: string } | null>(null);

  const showPopup = (type: MessageType, nextMessage: string) => {
    setPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setPopup((current) => (current && current.message === nextMessage ? null : current));
    }, 3000);
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
    if (!eventTitle.trim()) {
      message.warning("Event title is required.");
      return;
    }

    const start = combine(startDate, startTime);
    const end = combine(endDate, endTime);
    if (!start || !end) {
      message.warning("Please select valid start/end.");
      return;
    }
    const startD = new Date(`${start}:00`);
    const endD = new Date(`${end}:00`);
    if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) {
      message.warning("Invalid time format.");
      return;
    }
    if (endD <= startD) {
      message.warning("End time must be after start time.");
      return;
    }

    setLoading(true);
    try {
      const response = await reservationService.createReservation({
        roomId: normalizedRoomId,
        purpose: purpose.trim(),
        startTime: start,
        endTime: end,
        note: note.trim() || undefined,
      });

      const payload = (response as any)?.data?.data ?? (response as any)?.data;
      const reservationId = String(
        payload?.id ?? payload?.reservationId ?? payload?.reservationID ?? "",
      );
      if (!reservationId) {
        showPopup("error", "Missing reservationId from server response");
        return;
      }

      await api.post(API_ENDPOINTS.EVENTS.CREATE, {
        reservationId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || null,
        visibility,
      });

      showPopup("success", "Event booking created. Redirecting to setup...");
      window.setTimeout(() => navigate(`/events/setup/${reservationId}`, { state: { room } }), 500);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "Unable to create event booking";
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
                Book Room (Event)
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
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">Booking time</p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Start date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Start time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">End date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">End time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Purpose</label>
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Note (optional)</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-800">Event info</p>
              <div className="mt-3 space-y-3">
                <input
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="Event title"
                />
                <input
                  value={eventDescription}
                  onChange={(e) => setEventDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="Description (optional)"
                />
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                >
                  <option value="INVITE_ONLY">INVITE_ONLY</option>
                  <option value="PUBLIC">PUBLIC</option>
                </select>
              </div>
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
              className="w-full rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-70"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <CalendarDaysIcon className="h-5 w-5" />
                {loading ? "Creating..." : "Create event booking"}
              </span>
            </button>
          </form>
        </div>

        {popup ? <CustomMessage type={popup.type} message={popup.message} onClose={() => setPopup(null)} /> : null}
      </div>
    </div>
  );
};

export default BookRoomEventPage;
// end+ chức năng 3 màn hình đặt phòng (màn đặt phòng sự kiện)
