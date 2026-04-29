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
  const [participantEmails, setParticipantEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");

  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{ type: MessageType; message: string } | null>(null);
  const [timeValidationError, setTimeValidationError] = useState("");

  // Validate end time > start time in real-time
  const validateDateTime = (sDate: string, sTime: string, eDate: string, eTime: string) => {
    if (!sDate || !sTime || !eDate || !eTime) {
      setTimeValidationError("");
      return true;
    }
    const start = new Date(`${sDate}T${sTime}:00`);
    const end = new Date(`${eDate}T${eTime}:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setTimeValidationError("");
      return true;
    }
    if (end <= start) {
      setTimeValidationError("End time must be greater than start time");
      return false;
    }
    setTimeValidationError("");
    return true;
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    validateDateTime(value, startTime, endDate, endTime);
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    validateDateTime(startDate, value, endDate, endTime);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    validateDateTime(startDate, startTime, value, endTime);
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    validateDateTime(startDate, startTime, endDate, value);
  };

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

    // Validate date/time
    if (timeValidationError) {
      message.warning(timeValidationError);
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

      const eventRes = await api.post(API_ENDPOINTS.EVENTS.CREATE, {
        reservationId,
        title: eventTitle.trim(),
        description: eventDescription.trim() || null,
        visibility,
      });

      const eventData = (eventRes as any)?.data?.data ?? (eventRes as any)?.data;
      const eventId = eventData?.id;

      if (eventId && participantEmails.length > 0) {
        await Promise.all(
          participantEmails.map((email) =>
            api.post(API_ENDPOINTS.EVENTS.INVITE_PARTICIPANT, { eventId, email }),
          ),
        );
      }

      showPopup("success", "Event booking created successfully!");
      window.setTimeout(() => navigate(ROUTES.MY_BOOKINGS), 1500);
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

          <form onSubmit={submit} className="mt-8 space-y-6">
            {/* Booking Time Section */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-orange-500"></div>
                <p className="text-base font-bold text-slate-900">Booking Time</p>
              </div>
              
              {/* Date & Time Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Start Date */}
                <div className="flex flex-col">
                  <label className="mb-2 text-sm font-semibold text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                {/* Start Time */}
                <div className="flex flex-col">
                  <label className="mb-2 text-sm font-semibold text-slate-700">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => handleStartTimeChange(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                {/* End Date */}
                <div className="flex flex-col">
                  <label className="mb-2 text-sm font-semibold text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition ${
                      timeValidationError
                        ? "border-red-400 bg-red-50 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        : "border-slate-300 bg-white text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    }`}
                  />
                </div>

                {/* End Time */}
                <div className="flex flex-col">
                  <label className="mb-2 text-sm font-semibold text-slate-700">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => handleEndTimeChange(e.target.value)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-medium outline-none transition ${
                      timeValidationError
                        ? "border-red-400 bg-red-50 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                        : "border-slate-300 bg-white text-slate-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                    }`}
                  />
                </div>
              </div>

              {/* Error Message */}
              {timeValidationError && (
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 border border-red-200">
                  <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-red-700">{timeValidationError}</span>
                </div>
              )}
            </div>

            {/* Purpose & Note */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col">
                <label className="mb-2 text-sm font-semibold text-slate-700">Purpose <span className="text-red-500">*</span></label>
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Team meeting, Workshop"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div className="flex flex-col">
                <label className="mb-2 text-sm font-semibold text-slate-700">Note <span className="text-slate-400">(Optional)</span></label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional details..."
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>

            {/* Event Info Section */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-blue-50 to-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-blue-500"></div>
                <p className="text-base font-bold text-slate-900">Event Information</p>
              </div>
              
              <div className="space-y-4">
                <div className="flex flex-col">
                  <label className="mb-2 text-sm font-semibold text-slate-700">Event Title <span className="text-red-500">*</span></label>
                  <input
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="e.g., Q1 Planning Meeting"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-2 text-sm font-semibold text-slate-700">Description <span className="text-slate-400">(Optional)</span></label>
                  <input
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Event details..."
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-2 text-sm font-semibold text-slate-700">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as any)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="INVITE_ONLY">Invite Only</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Participants Section */}
            <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-purple-50 to-white p-6">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-purple-500"></div>
                <p className="text-base font-bold text-slate-900">Invite Participants</p>
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newEmail.trim()) {
                          setParticipantEmails((prev) => [...new Set([...prev, newEmail.trim()])]);
                          setNewEmail("");
                        }
                      }
                    }}
                    placeholder="Enter email and press Enter"
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newEmail.trim()) {
                        setParticipantEmails((prev) => [...new Set([...prev, newEmail.trim()])]);
                        setNewEmail("");
                      }
                    }}
                    className="rounded-lg bg-purple-100 px-4 py-2.5 text-sm font-semibold text-purple-700 transition hover:bg-purple-200 active:bg-purple-300"
                  >
                    Add
                  </button>
                </div>

                {participantEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {participantEmails.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1.5 text-xs font-semibold text-purple-700 ring-1 ring-inset ring-purple-300"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() => setParticipantEmails((prev) => prev.filter((e) => e !== email))}
                          className="font-bold text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rules Agreement */}
            <label className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-slate-700 transition hover:bg-emerald-100/50">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(event) => setAcceptedRules(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-600 cursor-pointer"
              />
              <span className="font-medium leading-relaxed">I have read and agree to follow all room usage rules.</span>
            </label>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => navigate(ROUTES.ROOM_DETAIL.replace(":roomId", normalizedRoomId), { state: { room } })}
                disabled={loading}
                className="rounded-lg border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={loading || !!timeValidationError || !acceptedRules}
                type="submit"
                className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CalendarDaysIcon className="h-5 w-5" />
                {loading ? "Creating..." : "Create Event Booking"}
              </button>
            </div>
          </form>
        </div>

        {popup ? <CustomMessage type={popup.type} message={popup.message} onClose={() => setPopup(null)} /> : null}
      </div>
    </div>
  );
};

export default BookRoomEventPage;
// end+ chức năng 3 màn hình đặt phòng (màn đặt phòng sự kiện)
