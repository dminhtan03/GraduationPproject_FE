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
  const now = new Date();
  const currentHour = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const [startDate, setStartDate] = useState(todayInput());
  const [startTime, setStartTime] = useState(currentHour);
  const [endDate, setEndDate] = useState(todayInput());
  const [endTime, setEndTime] = useState(addOneHour(currentHour));

  const durationExceeds8h = useMemo(() => {
    if (!startDate || !startTime || !endDate || !endTime) return false;
    const start = new Date(`${startDate}T${startTime}:00`);
    const end = new Date(`${endDate}T${endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    if (end <= start) return false;
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60) > 8;
  }, [startDate, startTime, endDate, endTime]);
  const [purpose, setPurpose] = useState("");
  const [note, setNote] = useState("");

  const [eventTitle, setEventTitle] = useState("Meeting Event");
  const [eventDescription, setEventDescription] = useState("");

  // start+ verified participants with name
  type VerifiedParticipant = { email: string; fullName: string };
  const [participants, setParticipants] = useState<VerifiedParticipant[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string>("");
  const [checkingEmail, setCheckingEmail] = useState(false);
  // end+ verified participants

  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);
  const [timeValidationError, setTimeValidationError] = useState("");

  // Min hour/minute for today's start time
  const minStartHour = useMemo(() => {
    if (startDate !== todayInput()) return 0;
    return new Date().getHours();
  }, [startDate]);

  const minStartMinute = useMemo(() => {
    if (startDate !== todayInput()) return 0;
    const n = new Date();
    return n.getHours() === parseInt(getHH(startTime), 10) ? n.getMinutes() : 0;
  }, [startDate, startTime]);

  const startHourOptions = useMemo(() =>
    TIME_HOURS.map((opt) => ({
      ...opt,
      disabled: startDate === todayInput() && parseInt(opt.value, 10) < new Date().getHours(),
    })),
  [startDate]);

  const startMinuteOptions = useMemo(() => {
    const nowH = new Date().getHours();
    const nowM = new Date().getMinutes();
    const selectedH = parseInt(getHH(startTime), 10);
    return TIME_MINUTES.map((opt) => ({
      ...opt,
      disabled: startDate === todayInput() && selectedH === nowH && parseInt(opt.value, 10) < nowM,
    }));
  }, [startDate, startTime]);

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
    if (start <= new Date()) {
      setTimeValidationError("Start time must be in the future.");
      return false;
    }
    if (end <= start) {
      setTimeValidationError("End time must be after start time");
      return false;
    }
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours > 8) {
      setTimeValidationError("Maximum booking duration is 8 hours. Please adjust your end time.");
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

  // start+ handle add email with BE check
  const handleAddEmail = async () => {
    const email = newEmail.trim();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setEmailError("Invalid email format.");
      return;
    }
    if (participants.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
      setEmailError("This email has already been added.");
      return;
    }

    setCheckingEmail(true);
    setEmailError("");
    try {
      const res = await api.get<any>(API_ENDPOINTS.USERS.CHECK_EMAIL, { params: { email } });
      const data = res.data?.data ?? res.data;
      const fullName = String(data?.fullName || "");
      setParticipants((prev) => [...prev, { email: String(data?.email || email), fullName }]);
      setNewEmail("");
      setEmailError("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "";
      const normalized = msg.toLowerCase();
      if (normalized.includes("user not found") || normalized.includes("no account")) {
        setEmailError("No account found with this email address.");
      } else {
        setEmailError("Could not verify email. Please try again.");
      }
    } finally {
      setCheckingEmail(false);
    }
  };
  // end+ handle add email

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
    if (startD <= new Date()) {
      showPopup("warning", "Start time must be in the future.");
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

      if (eventId && participants.length > 0) {
        await Promise.all(
          participants.map((p) =>
            api.post(API_ENDPOINTS.EVENTS.INVITE_PARTICIPANT, {
              eventId,
              email: p.email,
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
                      onInvalidSelect={(reason) => {
                        if (reason === "past") showPopup("warning", "Start date cannot be in the past.");
                      }}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-slate-700">
                      Start Time
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <AnimatedDropdown<string>
                        value={getHH(startTime)}
                        options={startHourOptions}
                        onChange={(h) => handleStartTimeChange(`${h}:${getMM(startTime)}`)}
                        buttonClassName="h-[38px] px-2.5 text-xs font-semibold tabular-nums"
                        ariaLabel="Start hour"
                      />
                      <AnimatedDropdown<string>
                        value={getMM(startTime)}
                        options={startMinuteOptions}
                        onChange={(m) => handleStartTimeChange(`${getHH(startTime)}:${m}`)}
                        buttonClassName="h-[38px] px-2.5 text-xs font-semibold tabular-nums"
                        ariaLabel="Start minute"
                      />
                    </div>
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
                    <div className="grid grid-cols-2 gap-2">
                      <AnimatedDropdown<string>
                        value={getHH(endTime)}
                        options={TIME_HOURS}
                        onChange={(h) => handleEndTimeChange(`${h}:${getMM(endTime)}`)}
                        buttonClassName={`h-[38px] px-2.5 text-xs font-semibold tabular-nums ${timeValidationError ? "!border-red-400" : ""}`}
                        ariaLabel="End hour"
                      />
                      <AnimatedDropdown<string>
                        value={getMM(endTime)}
                        options={TIME_MINUTES}
                        onChange={(m) => handleEndTimeChange(`${getHH(endTime)}:${m}`)}
                        buttonClassName={`h-[38px] px-2.5 text-xs font-semibold tabular-nums ${timeValidationError ? "!border-red-400" : ""}`}
                        ariaLabel="End minute"
                      />
                    </div>
                  </div>
                </div>

                {/* 8-hour duration warning */}
                {durationExceeds8h && !timeValidationError && (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Maximum booking duration is 8 hours. Please adjust your end time.
                  </div>
                )}

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
                {/* Input row */}
                <div className="flex gap-2">
                  <input
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (emailError) setEmailError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleAddEmail(); }
                    }}
                    placeholder="Enter email and press Enter"
                    disabled={checkingEmail}
                    className={[
                      "flex-1 rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-slate-400",
                      emailError
                        ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-200"
                        : "border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200",
                    ].join(" ")}
                  />
                  <button
                    type="button"
                    onClick={handleAddEmail}
                    disabled={checkingEmail || !newEmail.trim()}
                    className="inline-flex min-w-[72px] items-center justify-center rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                  >
                    {checkingEmail ? (
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                    ) : "Add"}
                  </button>
                </div>

                {/* Inline error */}
                {emailError && (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                    <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {emailError}
                  </p>
                )}

                {/* Verified participant tags */}
                {participants.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {participants.map((p) => (
                      <span
                        key={p.email}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      >
                        {/* Green checkmark — confirmed user exists */}
                        <svg className="h-3 w-3 shrink-0 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 00-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z" clipRule="evenodd" />
                        </svg>
                        <span className="max-w-[160px] truncate">
                          {p.fullName ? `${p.fullName} (${p.email})` : p.email}
                        </span>
                        <button
                          type="button"
                          onClick={() => setParticipants((prev) => prev.filter((x) => x.email !== p.email))}
                          className="font-bold text-emerald-500 hover:text-emerald-700"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Room Usage Rules ── */}
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
              <h3 className="mb-4 text-base font-bold text-emerald-900">Room usage rules</h3>
              <ul className="space-y-3 text-sm text-emerald-900">
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">1.</span>
                  <p className="font-medium">Sau khi book phòng nếu thay đổi kế hoạch và không có nhu cầu sử dụng cần thao tác hủy phòng trước thời gian đăng ký sử dụng / If plans change and the room is not needed, please cancel the booking before the scheduled time.</p>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">2.</span>
                  <p className="font-medium">Chỉ được book phòng cho mục đích học tập, nếu sử dụng sai mục đích hoặc book nhưng không sử dụng sẽ bị cấm book phòng trong 1 kỳ / Rooms are only for study purposes. Misuse or booking without usage will result in a ban for one term.</p>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">3.</span>
                  <p className="font-medium">Đảm bảo CSVC trong phòng, nếu hư phòng sẽ phải bồi theo quy định / Ensure the facilities in the room are intact. Damages will require compensation as per regulations.</p>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">4.</span>
                  <p className="font-medium">Trả lại nguyên hiện trạng ban đầu của phòng sau khi sử dụng / Return the room to its original condition after use.</p>
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-emerald-700">5.</span>
                  <p className="font-medium">Trong quá trình sử dụng không tự ý mang CSVC ra khỏi phòng học / Do not remove any facilities from the room during usage.</p>
                </li>
              </ul>
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
