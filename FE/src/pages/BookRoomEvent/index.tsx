import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  SparklesIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { api } from "../../services/api";
import { reservationService } from "../../services/reservationService";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS } from "../../constants/endpoints";
import CustomMessage, {
  type MessageType,
} from "../../components/common/CustomMessage";
import DatePickerField from "../../components/common/DatePickerField";
import AnimatedDropdown from "../../components/common/AnimatedDropdown";
import type { Room } from "../../types";

interface LocationState {
  room?: Room;
}

// Generate hour options 00:00 – 23:00
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hh = String(i).padStart(2, "0");
  return { value: `${hh}:00`, label: `${hh}:00` };
});

const todayInput = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const addOneHour = (time: string): string => {
  const [hh] = time.split(":");
  const next = (parseInt(hh, 10) + 1) % 24;
  return `${String(next).padStart(2, "0")}:00`;
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
  const normalizedRoomId = useMemo(
    () => roomId || room?.id || "",
    [roomId, room],
  );

  // Initialize start/end time from real current hour
  const currentHour = (() => {
    const h = new Date().getHours();
    return `${String(h).padStart(2, "00")}:00`;
  })();
  const [startDate, setStartDate] = useState(todayInput());
  const [startTime, setStartTime] = useState(currentHour);
  const [endDate, setEndDate] = useState(todayInput());
  const [endTime, setEndTime] = useState(addOneHour(currentHour));
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");

  const [eventTitle, setEventTitle] = useState("Meeting Event");
  const [eventDescription, setEventDescription] = useState("");
  const [participantEmails, setParticipantEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");

  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [timeValidationError, setTimeValidationError] = useState("");

  const validateDateTime = (
    sDate: string,
    sTime: string,
    eDate: string,
    eTime: string,
  ) => {
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
      setTimeValidationError("End time must be after start time");
      return false;
    }
    setTimeValidationError("");
    return true;
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    const auto = addOneHour(value);
    setEndTime(auto);
    validateDateTime(startDate, value, endDate, auto);
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    validateDateTime(startDate, startTime, endDate, value);
  };

  const showPopup = (type: MessageType, nextMessage: string) => {
    setPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setPopup((cur) => (cur && cur.message === nextMessage ? null : cur));
    }, 3000);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedRoomId) {
      showPopup("error", "Missing room id");
      return;
    }
    if (!acceptedRules) {
      showPopup("warning", "Please accept the room rules before confirming.");
      return;
    }
    if (!purpose.trim()) {
      showPopup("warning", "Purpose is required.");
      return;
    }
    if (!eventTitle.trim()) {
      showPopup("warning", "Event title is required.");
      return;
    }
    if (timeValidationError) {
      showPopup("warning", timeValidationError);
      return;
    }

    const start = combine(startDate, startTime);
    const end = combine(endDate, endTime);
    if (!start || !end) {
      showPopup("warning", "Please select valid start/end.");
      return;
    }
    const startD = new Date(`${start}:00`);
    const endD = new Date(`${end}:00`);
    if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime())) {
      showPopup("warning", "Invalid time format.");
      return;
    }
    if (endD <= startD) {
      showPopup("warning", "End time must be after start time.");
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
        visibility: "INVITE_ONLY",
      });

      const eventData =
        (eventRes as any)?.data?.data ?? (eventRes as any)?.data;
      const eventId = eventData?.id;

      if (eventId && participantEmails.length > 0) {
        await Promise.all(
          participantEmails.map((email) =>
            api.post(API_ENDPOINTS.EVENTS.INVITE_PARTICIPANT, {
              eventId,
              email,
            }),
          ),
        );
      }

      showPopup("success", "Event booking created successfully!");
      window.setTimeout(() => navigate(ROUTES.MY_BOOKINGS), 1500);
    } catch (error: any) {
      const msg =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to create event booking";
      showPopup("error", String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {/* ── Header ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight sm:text-3xl">
                Book Room — Event
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <span className="font-semibold text-orange-600">
                  {room?.roomName || normalizedRoomId}
                </span>
              </p>
            </div>
            {/* Back — orange, matches other screens */}
            <button
              type="button"
              onClick={() =>
                navigate(
                  ROUTES.ROOM_DETAIL.replace(":roomId", normalizedRoomId),
                  { state: { room } },
                )
              }
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Back
            </button>
          </div>

          <form onSubmit={submit} className="mt-8 space-y-6">
            {/* ── Booking Time ── */}
            <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white">
              <div className="flex items-center gap-2 border-b border-orange-100 px-5 py-4">
                <ClockIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-bold text-slate-900">
                  Booking Time
                </p>
              </div>

              <div className="p-5 space-y-4">
                {/* Start row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Start Date
                    </label>
                    <DatePickerField
                      value={startDate}
                      onChange={(v) => {
                        setStartDate(v);
                        validateDateTime(v, startTime, endDate, endTime);
                      }}
                      minDate={todayInput()}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Start Time
                    </label>
                    <AnimatedDropdown<string>
                      value={startTime}
                      options={HOUR_OPTIONS}
                      onChange={handleStartTimeChange}
                      buttonClassName="h-[38px] px-3"
                      ariaLabel="Start time"
                    />
                  </div>
                </div>

                {/* End row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label
                      className={`text-sm font-semibold ${timeValidationError ? "text-red-600" : "text-slate-700"}`}
                    >
                      End Date
                    </label>
                    <DatePickerField
                      value={endDate}
                      onChange={(v) => {
                        setEndDate(v);
                        validateDateTime(startDate, startTime, v, endTime);
                      }}
                      minDate={startDate}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      className={`text-sm font-semibold ${timeValidationError ? "text-red-600" : "text-slate-700"}`}
                    >
                      End Time
                    </label>
                    <AnimatedDropdown<string>
                      value={endTime}
                      options={HOUR_OPTIONS}
                      onChange={handleEndTimeChange}
                      buttonClassName={`h-[38px] px-3 ${timeValidationError ? "!border-red-400" : ""}`}
                      ariaLabel="End time"
                    />
                  </div>
                </div>

                {/* Validation error */}
                {timeValidationError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <svg
                      className="h-4 w-4 shrink-0 text-red-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-sm font-medium text-red-700">
                      {timeValidationError}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Purpose & Note ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Purpose <span className="text-red-500">*</span>
                </label>
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Team meeting, Workshop"
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Note <span className="text-slate-400">(Optional)</span>
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Additional details..."
                  className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>

            {/* ── Event Information ── */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <SparklesIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-bold text-slate-900">
                  Event Information
                </p>
              </div>

              <div className="space-y-4 p-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Event Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    placeholder="e.g., Q1 Planning Meeting"
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-slate-700">
                    Description{" "}
                    <span className="text-slate-400">(Optional)</span>
                  </label>
                  <input
                    value={eventDescription}
                    onChange={(e) => setEventDescription(e.target.value)}
                    placeholder="Event details..."
                    className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>
            </div>

            {/* ── Invite Participants ── */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                <UserGroupIcon className="h-5 w-5 text-orange-500" />
                <p className="text-base font-bold text-slate-900">
                  Invite Participants
                </p>
                <span className="ml-auto text-xs text-slate-400">
                  (Optional)
                </span>
              </div>

              <div className="space-y-3 p-5">
                <div className="flex gap-2">
                  <input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newEmail.trim()) {
                          setParticipantEmails((prev) => [
                            ...new Set([...prev, newEmail.trim()]),
                          ]);
                          setNewEmail("");
                        }
                      }
                    }}
                    placeholder="Enter email and press Enter"
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-200"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newEmail.trim()) {
                        setParticipantEmails((prev) => [
                          ...new Set([...prev, newEmail.trim()]),
                        ]);
                        setNewEmail("");
                      }
                    }}
                    className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
                  >
                    Add
                  </button>
                </div>

                {participantEmails.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {participantEmails.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200"
                      >
                        {email}
                        <button
                          type="button"
                          onClick={() =>
                            setParticipantEmails((prev) =>
                              prev.filter((e) => e !== email),
                            )
                          }
                          className="font-bold text-orange-500 hover:text-orange-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Rules Agreement ── */}
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-slate-700 transition hover:bg-emerald-100/60">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(event) => setAcceptedRules(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span className="font-medium leading-relaxed">
                I have read and agree to follow all room usage rules.
              </span>
            </label>

            {/* ── Action Buttons ── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    ROUTES.ROOM_DETAIL.replace(":roomId", normalizedRoomId),
                    { state: { room } },
                  )
                }
                disabled={loading}
                className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={loading || !!timeValidationError || !acceptedRules}
                type="submit"
                className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CalendarDaysIcon className="h-5 w-5" />
                {loading ? "Creating…" : "Create Event Booking"}
              </button>
            </div>
          </form>
        </div>

        {popup ? (
          <CustomMessage
            type={popup.type}
            message={popup.message}
            onClose={() => setPopup(null)}
          />
        ) : null}
      </div>
    </div>
  );
};

export default BookRoomEventPage;
// end+ chức năng 3 màn hình đặt phòng (màn đặt phòng sự kiện)
