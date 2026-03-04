import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Typography, message } from "antd";
import { ClockCircleOutlined } from "@ant-design/icons";
import { reservationService } from "../../services/reservationService";
import { ROUTES } from "../../constants";
import type { ApiError, Room } from "../../types";

const { Title, Text } = Typography;

interface LocationState {
  room?: Room;
}

type BookingStep = "form" | "review";

const pad = (value: number) => value.toString().padStart(2, "0");

const formatDateTimeLocal = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const addMinutesToDateTimeLocal = (startValue: string, minutesToAdd: number) => {
  const startDate = new Date(startValue);
  if (Number.isNaN(startDate.getTime())) return "";

  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + minutesToAdd);
  return formatDateTimeLocal(endDate);
};

const BookRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const [step, setStep] = useState<BookingStep>("form");
  const [purpose, setPurpose] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<30 | 60>(30);
  const [attendeeCount, setAttendeeCount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [loading, setLoading] = useState(false);

  const room = (state as LocationState | null)?.room;
  const normalizedRoomId = useMemo(() => roomId || room?.id || "", [roomId, room]);

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

    if (new Date(endTime) <= new Date(startTime)) {
      message.warning("End time must be later than start time.");
      return false;
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
      message.error((error as ApiError).message || "Unable to create booking");
    } finally {
      setLoading(false);
    }
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (!value) {
      setEndTime("");
      return;
    }

    const suggestedEndTime = addMinutesToDateTimeLocal(value, durationMinutes);
    setEndTime(suggestedEndTime);
  };

  const handleQuickDuration = (minutes: 30 | 60) => {
    setDurationMinutes(minutes);
    if (!startTime) {
      message.warning("Please pick start time first.");
      return;
    }
    setEndTime(addMinutesToDateTimeLocal(startTime, minutes));
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">Purpose</label>
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
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Start time</label>
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(event) => handleStartTimeChange(event.target.value)}
                    step={1800}
                    className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                    disabled={loading}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Quick end time</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => handleQuickDuration(30)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                        durationMinutes === 30
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50"
                      }`}
                      disabled={loading}
                    >
                      +30p
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickDuration(60)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold border ${
                        durationMinutes === 60
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-white text-orange-700 border-orange-200 hover:bg-orange-50"
                      }`}
                      disabled={loading}
                    >
                      +1h
                    </button>
                  </div>
                  <input
                    type="datetime-local"
                    value={endTime}
                    readOnly
                    className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-gray-50 text-gray-700"
                    required
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-orange-700">
                Select start time in 30-minute slots, then choose +30p or +1h to auto-fill end time quickly.
              </p>
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
