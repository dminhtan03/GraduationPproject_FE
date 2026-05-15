import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { message } from "antd";
import {
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import { reservationService } from "../../services/reservationService";
import { ROUTES } from "../../constants";
import { extractApiMessage } from "../../utils/errorHandlers";
import { useRealtimeClock } from "../../hooks/useRealtimeClock";
import type { Room } from "../../types";
import DatePickerField from "../../components/common/DatePickerField";
import AnimatedDropdown, {
  type AnimatedDropdownOption,
} from "../../components/common/AnimatedDropdown";
import CustomMessage, {
  MessageType,
} from "../../components/common/CustomMessage";

interface LocationState {
  room?: Room;
  timeRange?: {
    startDate: string;
    startHour: string;
    startMinute: string;
    endDate: string;
    endHour: string;
    endMinute: string;
  };
}

type BookingStep = "form" | "review";

const pad = (value: number) => value.toString().padStart(2, "0");
const ALL_HOURS = Array.from({ length: 24 }, (_, index) => pad(index));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

const getScrollableHourOptions = (anchorHour: number) => {
  const safeAnchor = Math.min(23, Math.max(0, anchorHour));
  const head = ALL_HOURS.slice(safeAnchor);
  const tail = ALL_HOURS.slice(0, safeAnchor);
  return [...head, ...tail];
};

const formatDateInput = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const combineDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue || !timeValue) return "";
  return `${dateValue}T${timeValue}`;
};

const formatDisplayDateTime = (dateTimeValue: string) => {
  if (!dateTimeValue) return "";
  const [datePart, timePart] = dateTimeValue.split("T");
  if (!datePart || !timePart) return "";
  
  const [year, month, day] = datePart.split("-");
  return `${day}/${month}/${year} ${timePart}`;
};

const toDate = (dateValue: string, timeValue: string) => {
  if (!dateValue || !timeValue) return null;
  const parsed = new Date(`${dateValue}T${timeValue}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addMinutesToDateTime = (dateTimeValue: string, minutesToAdd: number) => {
  if (!dateTimeValue) return "";
  const baseDate = new Date(dateTimeValue);
  if (Number.isNaN(baseDate.getTime())) return "";

  const endDate = new Date(baseDate);
  endDate.setMinutes(endDate.getMinutes() + minutesToAdd);

  return `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
};

const getDatePart = (dateTimeValue: string) => {
  if (!dateTimeValue.includes("T")) return "";
  return dateTimeValue.split("T")[0] || "";
};

const getTimePart = (dateTimeValue: string) => {
  if (!dateTimeValue.includes("T")) return "";
  return dateTimeValue.split("T")[1]?.slice(0, 5) || "";
};

const buildEndFromStart = (startDate: string, startClock: string) => {
  const startTime = combineDateTime(startDate, startClock);
  const nextEnd = addMinutesToDateTime(startTime, 60);
  if (!nextEnd) {
    return { endDate: "", endClock: "" };
  }

  return {
    endDate: getDatePart(nextEnd),
    endClock: getTimePart(nextEnd),
  };
};

const getMinEndSlot = (
  startDate: string,
  startClock: string,
  endDate: string,
) => {
  if (!endDate) return null;

  let minBoundary: Date | null = null;

  const start = toDate(startDate, startClock);
  if (start && endDate === startDate) {
    const startPlusOneMinute = new Date(start);
    startPlusOneMinute.setMinutes(startPlusOneMinute.getMinutes() + 1);
    minBoundary = startPlusOneMinute;
  }

  const minFutureSlot = getMinStartSlot(endDate);
  if (minFutureSlot) {
    const nowBoundary = new Date(
      `${endDate}T${pad(minFutureSlot.minHour)}:${pad(minFutureSlot.minMinute)}:00`,
    );

    if (!minBoundary || nowBoundary > minBoundary) {
      minBoundary = nowBoundary;
    }
  }

  if (!minBoundary) return null;

  return {
    minHour: minBoundary.getHours(),
    minMinute: minBoundary.getMinutes(),
  };
};

const getMinStartSlot = (selectedDate: string) => {
  if (!selectedDate) return null;
  const now = new Date();
  const today = formatDateInput(now);
  if (selectedDate !== today) return null;

  // Allow next minute (1-minute granularity)
  const next = new Date(now);
  next.setMinutes(next.getMinutes() + 1, 0, 0);

  return {
    minHour: next.getHours(),
    minMinute: next.getMinutes(),
  };
};

const getRoundedCurrentSlot = () => {
  const now = new Date();
  return {
    hour: now.getHours(),
    minute: now.getMinutes(),
  };
};

const getSuggestedStartClock = (selectedDate: string, minDate: string) => {
  const minSlot = getMinStartSlot(selectedDate);
  if (selectedDate === minDate && minSlot) {
    return `${pad(minSlot.minHour)}:${pad(minSlot.minMinute)}`;
  }

  const rounded = getRoundedCurrentSlot();
  return `${pad(rounded.hour)}:${pad(rounded.minute)}`;
};

const getClockHour = (clock: string) => {
  if (!clock.includes(":")) return "";
  return clock.split(":")[0] || "";
};

const getClockMinute = (clock: string) => {
  if (!clock.includes(":")) return "";
  return clock.split(":")[1] || "";
};

const isDateBefore = (leftDate: string, rightDate: string) => {
  if (!leftDate || !rightDate) return false;
  return leftDate < rightDate;
};

const BookRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const [step, setStep] = useState<BookingStep>("form");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startClock, setStartClock] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endClock, setEndClock] = useState("");
  const [attendeeCount, setAttendeeCount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState<{
    type: MessageType;
    message: string;
  } | null>(null);

  const showPopup = (type: MessageType, nextMessage: string) => {
    setPopup({ type, message: nextMessage });
    window.setTimeout(() => {
      setPopup((current) =>
        current && current.message === nextMessage ? null : current,
      );
    }, 3000);
  };

  const room = (state as LocationState | null)?.room;
  const timeRangeFromState = (state as LocationState | null)?.timeRange;

  const normalizedRoomId = useMemo(
    () => roomId || room?.id || "",
    [roomId, room],
  );
  const minDate = useMemo(() => formatDateInput(new Date()), []);
  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return formatDateInput(d);
  }, []);
  const nowHour = useMemo(() => new Date().getHours(), []);

  // Real-time clock for monitoring
  const _clockTick = useRealtimeClock(10_000); // Check every 10 seconds

  // Initialize time range from navigation state
  React.useEffect(() => {
    if (timeRangeFromState && !startDate) {
      setStartDate(timeRangeFromState.startDate);
      setStartClock(`${timeRangeFromState.startHour}:${timeRangeFromState.startMinute}`);
      setEndDate(timeRangeFromState.endDate);
      setEndClock(`${timeRangeFromState.endHour}:${timeRangeFromState.endMinute}`);
    }
  }, [timeRangeFromState]);

  // Auto-adjust start time if it falls in the past
  React.useEffect(() => {
    if (!startDate || !startClock) return;

    const now = new Date();
    const startDateTime = new Date(`${startDate}T${startClock}:00`);

    // If start time is in the past, auto-adjust to next available slot
    if (startDateTime <= now && startDate === minDate) {
      const nextSlot = getMinStartSlot(startDate);
      if (nextSlot) {
        const newStartTime = `${pad(nextSlot.minHour)}:${pad(nextSlot.minMinute)}`;
        setStartClock(newStartTime);
        showPopup(
          "info",
          `Start time auto-adjusted to ${newStartTime} to prevent past booking`,
        );

        // Also auto-adjust end time to start + 1 hour
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(nextSlot.minHour);
        endDateTime.setMinutes(nextSlot.minMinute);
        endDateTime.setHours(endDateTime.getHours() + 1);

        setEndDate(formatDateInput(endDateTime));
        setEndClock(
          `${pad(endDateTime.getHours())}:${pad(endDateTime.getMinutes())}`,
        );
      }
    }
  }, [_clockTick, startDate, startClock, minDate]);

  const isStartDateToday = useMemo(
    () => startDate === minDate,
    [startDate, minDate],
  );
  const minStartSlot = useMemo(() => getMinStartSlot(startDate), [startDate]);
  const minEndSlot = useMemo(
    () => getMinEndSlot(startDate, startClock, endDate),
    [startDate, startClock, endDate],
  );

  const startTime = useMemo(
    () => combineDateTime(startDate, startClock),
    [startDate, startClock],
  );

  const endTime = useMemo(
    () => combineDateTime(endDate, endClock),
    [endDate, endClock],
  );

  const durationExceeds8h = useMemo(() => {
    if (!startTime || !endTime) return false;
    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
    return end.getTime() - start.getTime() > 8 * 60 * 60 * 1000;
  }, [startTime, endTime]);

  const startExceeds1Week = useMemo(() => {
    if (!startTime) return false;
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime())) return false;
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    limit.setHours(23, 59, 59, 999);
    return start > limit;
  }, [startTime]);

  const startHourOptions = useMemo(() => {
    const selectedHour = Number(getClockHour(startClock));
    const anchor =
      Number.isFinite(selectedHour) && selectedHour >= 0
        ? selectedHour
        : nowHour;
    return getScrollableHourOptions(anchor);
  }, [nowHour, startClock]);

  const endHourOptions = useMemo(() => {
    const selectedHour = Number(getClockHour(endClock));
    const startHour = Number(getClockHour(startClock));
    const fallbackAnchor =
      Number.isFinite(startHour) && startHour >= 0
        ? Math.min(23, startHour + 1)
        : nowHour;
    const anchor =
      Number.isFinite(selectedHour) && selectedHour >= 0
        ? selectedHour
        : fallbackAnchor;
    return getScrollableHourOptions(anchor);
  }, [endClock, nowHour, startClock]);

  const startHourDropdownOptions = useMemo<
    Array<AnimatedDropdownOption<string>>
  >(
    () => [
      { value: "", label: "Hour", disabled: true },
      ...startHourOptions.map((hour) => ({
        value: hour,
        label: `${hour}h`,
        disabled: !!minStartSlot && Number(hour) < minStartSlot.minHour,
      })),
    ],
    [minStartSlot, startHourOptions],
  );

  const startMinuteDropdownOptions = useMemo<
    Array<AnimatedDropdownOption<string>>
  >(
    () => [
      { value: "", label: "Minute", disabled: true },
      ...MINUTE_OPTIONS.map((minute) => ({
        value: minute,
        label: `${minute}m`,
        disabled:
          isStartDateToday &&
          !!minStartSlot &&
          Number(getClockHour(startClock) || "0") === minStartSlot.minHour &&
          Number(minute) < minStartSlot.minMinute,
      })),
    ],
    [isStartDateToday, minStartSlot, startClock],
  );

  const endHourDropdownOptions = useMemo<Array<AnimatedDropdownOption<string>>>(
    () => [
      { value: "", label: "Hour", disabled: true },
      ...endHourOptions.map((hour) => ({
        value: hour,
        label: `${hour}h`,
        disabled: !!minEndSlot && Number(hour) < minEndSlot.minHour,
      })),
    ],
    [endHourOptions, minEndSlot],
  );

  const endMinuteDropdownOptions = useMemo<
    Array<AnimatedDropdownOption<string>>
  >(
    () => [
      { value: "", label: "Minute", disabled: true },
      ...MINUTE_OPTIONS.map((minute) => ({
        value: minute,
        label: `${minute}m`,
        disabled:
          !!minEndSlot &&
          Number(getClockHour(endClock) || "0") === minEndSlot.minHour &&
          Number(minute) < minEndSlot.minMinute,
      })),
    ],
    [endClock, minEndSlot],
  );

  const roomRules = [
    "Sau khi book phòng nếu thay đổi kế hoạch và không có nhu cầu sử dụng cần thao tác hủy phòng trước thời gian đăng ký sử dụng / If plans change and the room is not needed, please cancel the booking before the scheduled time.",
    "Chỉ được book phòng cho mục đích học tập, nếu sử dụng sai mục đích hoặc book nhưng không sử dụng sẽ bị cấm book phòng trong 1 kỳ / Rooms are only for study purposes. Misuse or booking without usage will result in a ban for one term.",
    "Đảm bảo CSVC trong phòng, nếu hư phòng sẽ phải đền bù theo quy định / Ensure the facilities in the room are intact. Damages will require compensation as per regulations.",
    "Trả lại nguyên hiện trạng ban đầu của phòng sau khi sử dụng / Return the room to its original condition after use.",
    "Trong quá trình sử dụng không tự ý mang CSVC ra khỏi phòng học / Do not remove any facilities from the room during usage.",
  ];

  const validateBookingInput = () => {
    if (!normalizedRoomId) {
      message.error("Missing room information. Please choose a room again.");
      return false;
    }

    if (!purpose.trim() || !startTime || !endTime) {
      message.warning("Please fill purpose, start time, and end time.");
      return false;
    }

    const now = new Date();
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (start <= now) {
      message.warning("Start time must be in the future.");
      return false;
    }

    const maxAllowed = new Date();
    maxAllowed.setDate(maxAllowed.getDate() + 7);
    maxAllowed.setHours(23, 59, 59, 999);
    if (start > maxAllowed) {
      message.warning("You can only book up to 7 days in advance.");
      return false;
    }

    if (end <= now) {
      message.warning("End time must be in the future.");
      return false;
    }

    if (end <= start) {
      message.warning("End time must be later than start time.");
      return false;
    }

    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours > 8) {
      message.warning("Maximum booking duration is 8 hours. Please adjust your end time.");
      return false;
    }

    if (attendeeCount !== "") {
      if (!Number.isFinite(attendeeCount) || attendeeCount <= 0) {
        message.warning("Attendee count must be greater than 0.");
        return false;
      }

      if (room?.slot != null && attendeeCount > room.slot) {
        message.warning(
          `Attendee count cannot exceed room capacity (${room.slot}).`,
        );
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateBookingInput()) {
      return;
    }

    if (step === "form") {
      setStep("review");
      message.success(
        "Booking details ready. Please review rules before confirming.",
      );
      return;
    }

    if (!acceptedRules) {
      message.warning(
        "Please accept the room rules before confirming booking.",
      );
      return;
    }

    setLoading(true);
    try {
      const normalizedAttendeeCount =
        attendeeCount === "" || !Number.isFinite(attendeeCount)
          ? undefined
          : attendeeCount;

      await reservationService.createReservation({
        roomId: normalizedRoomId,
        purpose: purpose.trim(),
        startTime,
        endTime,
        attendeeCount: normalizedAttendeeCount,
        note: note.trim() || undefined,
      });

      showPopup("success", "Booking created successfully");
      window.setTimeout(() => navigate(ROUTES.MY_BOOKINGS), 800);
    } catch (error) {
      const apiMessage = extractApiMessage(error, "Unable to create booking");
      showPopup("error", apiMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToForm = () => {
    setStep("form");
    message.info("Back to booking form. You can edit your information.");
  };

  const activeStepIndex = step === "form" ? 1 : 2;

  const bookingDurationLabel = useMemo(() => {
    if (!startTime || !endTime) return "-";

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
      return "-";
    const diffMinutes = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60),
    );
    if (diffMinutes <= 0) return "-";

    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;

    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }, [endTime, startTime]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <section className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
              Book Room
            </h1>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                  style={{ width: `${(activeStepIndex / 2) * 100}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    step === "form"
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  1. Booking info
                </div>
                <div
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    step === "review"
                      ? "border-orange-200 bg-orange-50 text-orange-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  2. Rules & confirm
                </div>
              </div>
            </div>

            {!room && (
              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="inline-flex items-center gap-2 font-semibold">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  Room details are limited
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  You can still continue booking with the selected room id.
                </p>
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
          >
            {step === "form" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Room
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-800">
                      {room?.roomName || normalizedRoomId || "-"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Building
                    </p>
                    <p className="mt-1 text-base font-bold text-slate-800">
                      {room?.building || "-"}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    <span className="mr-1 text-rose-500">*</span>
                    Purpose
                  </label>
                  <input
                    value={purpose}
                    onChange={(event) => setPurpose(event.target.value)}
                    placeholder="Team meeting / workshop / class ..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                    disabled={loading}
                    required
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ClockIcon className="h-5 w-5 text-orange-500" />
                    <span className="text-sm font-semibold text-slate-700">
                      Meeting Time (Install only one week in advance.)
                    </span>
                  </div>
                  <p className="mb-4 text-xs text-slate-500">
                    Start and end times are auto-validated to prevent booking in
                    the past.
                  
                  </p>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        <span className="mr-1 text-rose-500">*</span>
                        Start date & time
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <DatePickerField
                          value={startDate}
                          minDate={minDate}
                          maxDate={maxDate}
                          onInvalidSelect={(reason) => {
                            if (reason === "past") {
                              message.warning("Start date cannot be in the past.");
                            } else {
                              message.warning("You can only book up to 7 days in advance.");
                            }
                          }}
                          onChange={(nextDate) => {
                            if (isDateBefore(nextDate, minDate)) {
                              message.warning(
                                "Start date cannot be in the past.",
                              );
                              return;
                            }
                            if (nextDate > maxDate) {
                              message.warning(
                                "You can only book up to 7 days in advance.",
                              );
                              return;
                            }

                            setStartDate(nextDate);

                            const suggestedStartClock = getSuggestedStartClock(
                              nextDate,
                              minDate,
                            );
                            setStartClock(suggestedStartClock);

                            const autoEnd = buildEndFromStart(
                              nextDate,
                              suggestedStartClock,
                            );
                            setEndDate(autoEnd.endDate);
                            setEndClock(autoEnd.endClock);
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <AnimatedDropdown<string>
                            value={getClockHour(startClock) || ""}
                            options={startHourDropdownOptions}
                            onChange={(nextHour) => {
                              const currentMinute =
                                getClockMinute(startClock) || "00";
                              if (!nextHour) {
                                setStartClock("");
                                return;
                              }

                              let nextMinute = currentMinute;
                              if (
                                minStartSlot &&
                                Number(nextHour) === minStartSlot.minHour &&
                                Number(nextMinute) < minStartSlot.minMinute
                              ) {
                                nextMinute = pad(minStartSlot.minMinute);
                              }

                              const nextClock = `${nextHour}:${nextMinute}`;
                              setStartClock(nextClock);
                              const autoEnd = buildEndFromStart(
                                startDate,
                                nextClock,
                              );
                              setEndDate(autoEnd.endDate);
                              setEndClock(autoEnd.endClock);
                            }}
                            className="w-full"
                            buttonClassName="h-10 border-slate-200 bg-white px-2.5 text-xs font-semibold tabular-nums"
                            menuClassName="max-h-56 overflow-y-auto"
                            optionClassName="text-xs tabular-nums"
                            ariaLabel="Select start hour"
                            disabled={loading}
                          />

                          <AnimatedDropdown<string>
                            value={getClockMinute(startClock) || ""}
                            options={startMinuteDropdownOptions}
                            onChange={(nextMinute) => {
                              const currentHour =
                                getClockHour(startClock) || "00";
                              const nextClock = nextMinute
                                ? `${currentHour}:${nextMinute}`
                                : "";
                              setStartClock(nextClock);

                              if (nextClock && startDate) {
                                const autoEnd = buildEndFromStart(
                                  startDate,
                                  nextClock,
                                );
                                setEndDate(autoEnd.endDate);
                                setEndClock(autoEnd.endClock);
                              }
                            }}
                            className="w-full"
                            buttonClassName="h-10 border-slate-200 bg-white px-2.5 text-xs font-semibold tabular-nums"
                            menuClassName="max-h-56 overflow-y-auto"
                            optionClassName="text-xs tabular-nums"
                            ariaLabel="Select start minute"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <label className="mb-2 block text-sm font-semibold text-slate-700">
                        <span className="mr-1 text-rose-500">*</span>
                        End date & time
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <DatePickerField
                          value={endDate}
                          minDate={startDate || minDate}
                          onChange={(nextDate) => {
                            if (isDateBefore(nextDate, minDate)) {
                              message.warning(
                                "End date cannot be in the past.",
                              );
                              return;
                            }

                            if (
                              startDate &&
                              isDateBefore(nextDate, startDate)
                            ) {
                              message.warning(
                                "End date cannot be earlier than start date.",
                              );
                              return;
                            }

                            setEndDate(nextDate);
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <AnimatedDropdown<string>
                            value={getClockHour(endClock) || ""}
                            options={endHourDropdownOptions}
                            onChange={(nextHour) => {
                              const currentMinute =
                                getClockMinute(endClock) || "00";
                              setEndClock(
                                nextHour ? `${nextHour}:${currentMinute}` : "",
                              );
                            }}
                            className="w-full"
                            buttonClassName="h-10 border-slate-200 bg-white px-2.5 text-xs font-semibold tabular-nums"
                            menuClassName="max-h-56 overflow-y-auto"
                            optionClassName="text-xs tabular-nums"
                            ariaLabel="Select end hour"
                            disabled={loading}
                          />

                          <AnimatedDropdown<string>
                            value={getClockMinute(endClock) || ""}
                            options={endMinuteDropdownOptions}
                            onChange={(nextMinute) => {
                              const currentHour =
                                getClockHour(endClock) || "00";
                              setEndClock(
                                nextMinute
                                  ? `${currentHour}:${nextMinute}`
                                  : "",
                              );
                            }}
                            className="w-full"
                            buttonClassName="h-10 border-slate-200 bg-white px-2.5 text-xs font-semibold tabular-nums"
                            menuClassName="max-h-56 overflow-y-auto"
                            optionClassName="text-xs tabular-nums"
                            ariaLabel="Select end minute"
                            disabled={loading}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {startExceeds1Week && (
                    <div className="col-span-2 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      You can only book a room up to 7 days in advance. Please select an earlier start time.
                    </div>
                  )}

                  {durationExceeds8h && (
                    <div className="col-span-2 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700">
                      <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      Maximum booking duration is 8 hours. Please adjust your end time.
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Attendee count
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={room?.slot}
                      value={attendeeCount}
                      onChange={(event) =>
                        setAttendeeCount(
                          event.target.value ? Number(event.target.value) : "",
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                      disabled={loading}
                      placeholder="Optional"
                    />
                    {typeof room?.slot === "number" && (
                      <p className="mt-1 text-xs text-slate-500">
                        Maximum capacity: {room.slot} attendees
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Note
                    </label>
                    <textarea
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
                      disabled={loading}
                      placeholder="Optional details"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                  <h3 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                    <CheckBadgeIcon className="h-5 w-5 text-emerald-600" />
                    Booking details
                  </h3>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Room
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {room?.roomName || normalizedRoomId}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Building
                      </p>
                      <p className="mt-1 text-sm font-bold text-slate-800">
                        {room?.building || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <CalendarDaysIcon className="h-4 w-4 text-orange-500" />
                        Start
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDisplayDateTime(startTime) || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <ClockIcon className="h-4 w-4 text-orange-500" />
                        End
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {formatDisplayDateTime(endTime) || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <UserGroupIcon className="h-4 w-4 text-orange-500" />
                        Attendees
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {attendeeCount || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <InformationCircleIcon className="h-4 w-4 text-orange-500" />
                        Duration
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {bookingDurationLabel}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span className="mr-1 text-rose-500">*</span>
                      Purpose
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {purpose || "-"}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-emerald-800">
                    Room usage rules
                  </h3>
                  <ul className="list-decimal space-y-2 pl-5 text-sm text-emerald-900">
                    {roomRules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                  <label className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-100/70 px-3 py-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={acceptedRules}
                      onChange={(event) =>
                        setAcceptedRules(event.target.checked)
                      }
                      className="mt-0.5 h-4 w-4 accent-emerald-600"
                    />
                    <span className="leading-5">
                      I have read and agree to follow all room usage rules.
                    </span>
                  </label>
                </div>
              </>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5">
              <button
                type="button"
                onClick={() => navigate(ROUTES.ROOM_LIST)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                disabled={loading}
              >
                Cancel
              </button>

              {step === "review" && (
                <button
                  type="button"
                  onClick={handleBackToForm}
                  className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100"
                  disabled={loading}
                >
                  Edit booking
                </button>
              )}

              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading || (step === "review" && !acceptedRules)}
              >
                {loading
                  ? "Booking..."
                  : step === "form"
                    ? "Continue"
                    : "Confirm booking"}
              </button>
            </div>
          </form>
        </section>
      </div>

      {popup && (
        <CustomMessage
          type={popup.type}
          message={popup.message}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
};

export default BookRoomPage;
