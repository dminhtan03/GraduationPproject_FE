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

const pad = (value: number) => value.toString().padStart(2, "0");

const formatDateTimeLocal = (date: Date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const getSuggestedEndTime = (startValue: string) => {
  const startDate = new Date(startValue);
  if (Number.isNaN(startDate.getTime())) return "";

  const next = new Date(startDate);
  next.setSeconds(0, 0);

  const minutes = next.getMinutes();
  if (minutes === 0 || minutes === 30) {
    next.setMinutes(minutes + 30);
  } else if (minutes < 30) {
    next.setMinutes(30);
  } else {
    next.setMinutes(60);
  }

  if (next <= startDate) {
    next.setMinutes(next.getMinutes() + 30);
  }

  return formatDateTimeLocal(next);
};

const BookRoomPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const [purpose, setPurpose] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [attendeeCount, setAttendeeCount] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const room = (state as LocationState | null)?.room;
  const normalizedRoomId = useMemo(() => roomId || room?.id || "", [roomId, room]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!normalizedRoomId) {
      message.error("Missing room information. Please choose a room again.");
      return;
    }

    if (!purpose.trim() || !startTime || !endTime) {
      message.warning("Please fill purpose, start time, and end time.");
      return;
    }

    if (new Date(endTime) <= new Date(startTime)) {
      message.warning("End time must be later than start time.");
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

    const suggestedEndTime = getSuggestedEndTime(value);
    setEndTime(suggestedEndTime);
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

      <form
        onSubmit={handleSubmit}
        className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5"
      >
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
                className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={loading}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">End time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                min={startTime || undefined}
                className="w-full border border-orange-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                disabled={loading}
                required
              />
            </div>
          </div>

          <p className="mt-3 text-xs text-orange-700">
            End time is auto-suggested to the next half-hour boundary (e.g. 14:10 → 14:30, 15:15 → 15:30).
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

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(ROUTES.ROOM_LIST)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-70"
            disabled={loading}
          >
            {loading ? "Booking..." : "Confirm booking"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookRoomPage;
