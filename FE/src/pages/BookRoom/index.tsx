import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Typography, message } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { reservationService } from "../../services/reservationService";
import { ROUTES } from "../../constants";
import { extractApiMessage } from "../../utils/errorHandlers";
import type { Room } from "../../types";

const { Title, Text } = Typography;

interface LocationState {
  room?: Room;
}

type BookingStep = "form" | "review";

const pad = (value: number) => value.toString().padStart(2, "0");
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => pad(index));
const MINUTE_OPTIONS = ["00", "10", "20", "30", "40", "50"];

const formatDateInput = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const combineDateTime = (dateValue: string, timeValue: string) => {
  if (!dateValue || !timeValue) return "";
  return `${dateValue}T${timeValue}`;
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

const buildEndFromPreset = (
  startDate: string,
  startClock: string,
  presetMinutes: 30 | 60,
) => {
  const startTime = combineDateTime(startDate, startClock);
  const nextEnd = addMinutesToDateTime(startTime, presetMinutes);
  if (!nextEnd) {
    return { endDate: "", endClock: "" };
  }

  return {
    endDate: getDatePart(nextEnd),
    endClock: getTimePart(nextEnd),
  };
};

const getMinEndSlot = (startDate: string, startClock: string, endDate: string) => {
  const start = toDate(startDate, startClock);
  if (!start || !endDate || endDate !== startDate) return null;

  const minEnd = new Date(start);
  minEnd.setMinutes(minEnd.getMinutes() + 10);
  return {
    minHour: minEnd.getHours(),
    minMinute: minEnd.getMinutes(),
  };
};

const getMinStartSlot = (selectedDate: string) => {
  if (!selectedDate) return null;
  const now = new Date();
  const today = formatDateInput(now);
  if (selectedDate !== today) return null;

  const nextMinuteDate = new Date(now);
  nextMinuteDate.setMinutes(nextMinuteDate.getMinutes() + 1, 0, 0);

  const roundedMinute = Math.ceil(nextMinuteDate.getMinutes() / 10) * 10;
  if (roundedMinute === 60) {
    nextMinuteDate.setHours(nextMinuteDate.getHours() + 1, 0, 0, 0);
  } else {
    nextMinuteDate.setMinutes(roundedMinute, 0, 0);
  }

  return {
    minHour: nextMinuteDate.getHours(),
    minMinute: nextMinuteDate.getMinutes(),
  };
};

const isClockBeforeMinSlot = (clock: string, minSlot: { minHour: number; minMinute: number }) => {
  const hour = Number(getClockHour(clock));
  const minute = Number(getClockMinute(clock));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;

  if (hour < minSlot.minHour) return true;
  if (hour === minSlot.minHour && minute < minSlot.minMinute) return true;
  return false;
};

const getClockHour = (clock: string) => {
  if (!clock.includes(":")) return "";
  return clock.split(":")[0] || "";
};

const getClockMinute = (clock: string) => {
  if (!clock.includes(":")) return "";
  return clock.split(":")[1] || "";
};

const getBookingConflictMessage = (rawMessage: string) => {
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("check in") ||
    normalized.includes("check-in") ||
    normalized.includes("to check in") ||
    normalized.includes("đến giờ check in") ||
    normalized.includes("den gio check in")
  ) {
    return "Bạn đang có booking đã đến giờ check-in. Vui lòng check-in/trả phòng hiện tại trước khi tạo booking mới.";
  }

  if (
    normalized.includes("overlap") ||
    normalized.includes("conflict") ||
    normalized.includes("same time") ||
    normalized.includes("time slot")
  ) {
    return "Khung giờ này đã bị trùng lịch (overlap). Vui lòng chọn thời gian khác.";
  }

  if (
    normalized.includes("1 room") ||
    normalized.includes("one room") ||
    normalized.includes("already booked") ||
    normalized.includes("already have") ||
    normalized.includes("same period") ||
    normalized.includes("not checkout") ||
    normalized.includes("chua tra phong") ||
    normalized.includes("chưa trả phòng")
  ) {
    return "Bạn đang có phòng chưa trả hoặc đã có booking khác trong cùng khoảng thời gian. Vui lòng hoàn tất booking hiện tại trước.";
  }

  return rawMessage;
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
  const [durationPreset, setDurationPreset] = useState<30 | 60>(60);
  const [attendeeCount, setAttendeeCount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitErrorMessage, setSubmitErrorMessage] = useState<string | null>(null);

  const room = (state as LocationState | null)?.room;
  const normalizedRoomId = useMemo(() => roomId || room?.id || "", [roomId, room]);
  const minDate = useMemo(() => formatDateInput(new Date()), []);
  const minStartSlot = useMemo(() => getMinStartSlot(startDate), [startDate]);
  const minEndSlot = useMemo(
    () => getMinEndSlot(startDate, startClock, endDate),
    [startDate, startClock, endDate],
  );

  const startTime = useMemo(
    () => combineDateTime(startDate, startClock),
    [startDate, startClock],
  );

  const endTime = useMemo(() => combineDateTime(endDate, endClock), [endDate, endClock]);

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

    if (end <= start) {
      message.warning("End time must be later than start time.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitErrorMessage(null);

    if (!validateBookingInput()) {
      return;
    }

    if (step === "form") {
      setStep("review");
      message.success("Booking details ready. Please review rules before confirming.");
      return;
    }

    if (!acceptedRules) {
      message.warning("Please accept the room rules before confirming booking.");
      return;
    }

    setLoading(true);
    try {
      await reservationService.createReservation({
        roomId: normalizedRoomId,
        purpose: purpose.trim(),
        startTime,
        endTime,
        attendeeCount: attendeeCount === "" ? undefined : attendeeCount,
        note: note.trim() || undefined,
      });

      message.success("Booking created successfully");
      navigate(ROUTES.MY_BOOKINGS);
    } catch (error) {
      const apiMessage = extractApiMessage(error, "Unable to create booking");
      const displayMessage = getBookingConflictMessage(apiMessage);
      setSubmitErrorMessage(displayMessage);
      message.error(displayMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToForm = () => {
    setStep("form");
    message.info("Back to booking form. You can edit your information.");
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <Title level={2} className="!mb-1 text-gray-800 font-semibold">
        Book Room
      </Title>
      <Text className="text-gray-500">Create a new reservation request</Text>

      {!room && (
        <Alert
          className="mt-5"
          type="info"
          showIcon
          message="Room details are limited"
          description="You can still continue booking with the selected room id."
        />
      )}

      <div className="mt-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide">
        <span className={step === "form" ? "text-orange-600" : "text-gray-400"}>1. Booking info</span>
        <span className="text-gray-300">→</span>
        <span className={step === "review" ? "text-orange-600" : "text-gray-400"}>2. Rules & confirm</span>
      </div>

      {submitErrorMessage && (
        <Alert
          className="mt-4"
          type="error"
          showIcon
          message="Không thể tạo booking"
          description={submitErrorMessage}
        />
      )}

      <form
        onSubmit={handleSubmit}
        className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
      >
        {step === "form" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Room</label>
                <input
                  value={room?.roomName || normalizedRoomId}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Building</label>
                <input
                  value={room?.building || "-"}
                  readOnly
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <span className="text-red-500 mr-1">*</span>
                Purpose
              </label>
              <input
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
                placeholder="Team meeting / workshop / class ..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={loading}
                required
              />
            </div>

            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
              <div className="flex items-center gap-2 mb-3">
                <ClockCircleOutlined className="text-orange-500" />
                <span className="text-sm font-semibold text-orange-700">Meeting Time</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500 mr-1">*</span>
                    Start date & time
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={startDate}
                      min={minDate}
                      onChange={(event) => {
                        const nextDate = event.target.value;
                        setStartDate(nextDate);

                        const nextMinSlot = getMinStartSlot(nextDate);
                        if (nextMinSlot && startClock && isClockBeforeMinSlot(startClock, nextMinSlot)) {
                          setStartClock("");
                          setEndDate("");
                          setEndClock("");
                          return;
                        }

                        if (startClock) {
                          const autoEnd = buildEndFromPreset(nextDate, startClock, durationPreset);
                          setEndDate(autoEnd.endDate);
                          setEndClock(autoEnd.endClock);
                        }
                      }}
                      className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                      disabled={loading}
                      required
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={getClockHour(startClock)}
                        onChange={(event) => {
                          const nextHour = event.target.value;
                          const currentMinute = getClockMinute(startClock) || "00";
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

                          setStartClock(`${nextHour}:${nextMinute}`);
                          const autoEnd = buildEndFromPreset(startDate, `${nextHour}:${nextMinute}`, durationPreset);
                          setEndDate(autoEnd.endDate);
                          setEndClock(autoEnd.endClock);
                        }}
                        className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        disabled={loading}
                        required
                      >
                        <option value="">Hour</option>
                        {HOUR_OPTIONS.map((hour) => (
                          <option
                            key={hour}
                            value={hour}
                            disabled={!!minStartSlot && Number(hour) < minStartSlot.minHour}
                          >
                            {hour}
                          </option>
                        ))}
                      </select>
                      <select
                        value={getClockMinute(startClock)}
                        onChange={(event) => {
                          const nextMinute = event.target.value;
                          const currentHour = getClockHour(startClock) || "00";
                          const nextClock = nextMinute ? `${currentHour}:${nextMinute}` : "";
                          setStartClock(nextClock);

                          if (nextClock && startDate) {
                            const autoEnd = buildEndFromPreset(startDate, nextClock, durationPreset);
                            setEndDate(autoEnd.endDate);
                            setEndClock(autoEnd.endClock);
                          }
                        }}
                        className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        disabled={loading}
                        required
                      >
                        <option value="">Minute</option>
                        {MINUTE_OPTIONS.map((minute) => (
                          <option
                            key={minute}
                            value={minute}
                            disabled={
                              !!minStartSlot &&
                              Number(getClockHour(startClock) || "0") === minStartSlot.minHour &&
                              Number(minute) < minStartSlot.minMinute
                            }
                          >
                            {minute}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <span className="text-red-500 mr-1">*</span>
                    Duration
                  </label>
                  <div className="space-y-2">
                    <select
                      value={String(durationPreset)}
                      onChange={(event) => {
                        const nextPreset = Number(event.target.value) as 30 | 60;
                        setDurationPreset(nextPreset);

                        if (startDate && startClock) {
                          const autoEnd = buildEndFromPreset(startDate, startClock, nextPreset);
                          setEndDate(autoEnd.endDate);
                          setEndClock(autoEnd.endClock);
                        }
                      }}
                      className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                      disabled={loading}
                      required
                    >
                      <option value="60">1 hour</option>
                      <option value="30">30 minutes</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        value={endDate}
                        min={startDate || minDate}
                        onChange={(event) => setEndDate(event.target.value)}
                        className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                        disabled={loading}
                        required
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={getClockHour(endClock)}
                          onChange={(event) => {
                            const nextHour = event.target.value;
                            const currentMinute = getClockMinute(endClock) || "00";
                            setEndClock(nextHour ? `${nextHour}:${currentMinute}` : "");
                          }}
                          className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                          disabled={loading}
                          required
                        >
                          <option value="">Hour</option>
                          {HOUR_OPTIONS.map((hour) => (
                            <option
                              key={hour}
                              value={hour}
                              disabled={!!minEndSlot && Number(hour) < minEndSlot.minHour}
                            >
                              {hour}
                            </option>
                          ))}
                        </select>
                        <select
                          value={getClockMinute(endClock)}
                          onChange={(event) => {
                            const nextMinute = event.target.value;
                            const currentHour = getClockHour(endClock) || "00";
                            setEndClock(nextMinute ? `${currentHour}:${nextMinute}` : "");
                          }}
                          className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                          disabled={loading}
                          required
                        >
                          <option value="">Minute</option>
                          {MINUTE_OPTIONS.map((minute) => (
                            <option
                              key={minute}
                              value={minute}
                              disabled={
                                !!minEndSlot &&
                                Number(getClockHour(endClock) || "0") === minEndSlot.minHour &&
                                Number(minute) < minEndSlot.minMinute
                              }
                            >
                              {minute}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Attendee count</label>
              <input
                type="number"
                min={1}
                value={attendeeCount}
                onChange={(event) =>
                  setAttendeeCount(event.target.value ? Number(event.target.value) : "")
                }
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={loading}
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Note</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={loading}
                placeholder="Optional details"
              />
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-3">Booking details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Room:</span> <span className="font-semibold text-gray-800">{room?.roomName || normalizedRoomId}</span></div>
                <div><span className="text-gray-500">Building:</span> <span className="font-semibold text-gray-800">{room?.building || "-"}</span></div>
                <div><span className="text-gray-500">Start:</span> <span className="font-semibold text-gray-800">{startTime || "-"}</span></div>
                <div><span className="text-gray-500">End:</span> <span className="font-semibold text-gray-800">{endTime || "-"}</span></div>
                <div><span className="text-gray-500">Purpose:</span> <span className="font-semibold text-gray-800">{purpose || "-"}</span></div>
                <div><span className="text-gray-500">Attendees:</span> <span className="font-semibold text-gray-800">{attendeeCount || "-"}</span></div>
              </div>
            </div>

            <div className="rounded-xl border border-green-100 bg-green-50/70 p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-3">Room usage rules</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm text-green-900">
                {roomRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
              <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={acceptedRules}
                  onChange={(event) => setAcceptedRules(event.target.checked)}
                  className="mt-1"
                />
                <span>I have read and agree to follow all room usage rules.</span>
              </label>
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(ROUTES.ROOM_LIST)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100"
            disabled={loading}
          >
            Cancel
          </button>

          {step === "review" && (
            <button
              type="button"
              onClick={handleBackToForm}
              className="px-4 py-2 rounded-lg border border-orange-200 text-orange-700 hover:bg-orange-50"
              disabled={loading}
            >
              Edit booking
            </button>
          )}

          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-70"
            disabled={loading || (step === "review" && !acceptedRules)}
          >
            {loading ? "Booking..." : step === "form" ? "Continue" : "Confirm booking"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookRoomPage;
