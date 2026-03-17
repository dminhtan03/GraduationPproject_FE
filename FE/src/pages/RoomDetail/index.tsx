import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Rate, Typography, message } from "antd";
import { roomService } from "../../services/roomService";
import { getProfile } from "../../services/authService";
import { ROUTES } from "../../constants";
import type { ApiError, Room, UserProfile } from "../../types";
import BookingLockCountdown from "../../components/common/BookingLockCountdown";

const { Title } = Typography;

interface LocationState {
  room?: Room;
}

type Amenity = { id?: string; name?: string };
type RoomImage = { id?: string; imageUrl?: string };
type RoomFeedback = {
  id?: string;
  rating?: number;
  description?: string;
  createdAt?: string;
};

type RoomDetailData = {
  roomId?: string;
  roomName?: string;
  locationCode?: string;
  name?: string;
  buildingName?: string;
  floorName?: string;
  capacity?: number;
  status?: string;
  amenities?: Amenity[];
  images?: RoomImage[];
  feedbacks?: RoomFeedback[];
  score?: number;
  currentUserName?: string;
  userName?: string;
  checkInTime?: string;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "No check-in yet";

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusStyles: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  UNAVAILABLE: "bg-amber-100 text-amber-700 border-amber-200",
  BROKEN: "bg-slate-200 text-slate-700 border-slate-300",
};

const RoomDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [detail, setDetail] = useState<RoomDetailData | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const roomFromState = (state as LocationState | null)?.room;
  const normalizedRoomId = roomId || roomFromState?.id || "";

  useEffect(() => {
    const loadDetail = async () => {
      if (!normalizedRoomId) {
        setError("Missing room id");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setWarning(null);
      try {
        const data = await roomService.getRoomDetail(normalizedRoomId);
        setDetail(data || null);
      } catch (e) {
        const apiMessage =
          (e as ApiError).message || "Unable to load room details";
        const isRoomNotFound = apiMessage
          .toUpperCase()
          .includes("ROOM NOT FOUND");

        if (isRoomNotFound) {
          setDetail(null);
          setWarning(
            "Room is currently empty (no active check-in information from server).",
          );
        } else {
          setError(apiMessage);
          setDetail(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [normalizedRoomId, roomFromState]);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await getProfile();
        const raw = response.data as
          | { data?: UserProfile }
          | UserProfile
          | null;
        const nested =
          raw && typeof raw === "object" && "data" in raw
            ? raw.data
            : undefined;
        setUserProfile((nested || raw || null) as UserProfile | null);
      } catch {
        setUserProfile(null);
      }
    };

    loadProfile();
  }, []);

  const roomName = useMemo(
    () =>
      detail?.locationCode ||
      detail?.roomName ||
      detail?.name ||
      normalizedRoomId,
    [detail, normalizedRoomId],
  );

  const roomCode = useMemo(
    () => detail?.locationCode || roomFromState?.roomName || "-",
    [detail, roomFromState],
  );

  const building = useMemo(
    () => detail?.buildingName || roomFromState?.building || "N/A",
    [detail, roomFromState],
  );

  const floor = useMemo(
    () => detail?.floorName || roomFromState?.floorInfo || "N/A",
    [detail, roomFromState],
  );

  const slot = useMemo(() => detail?.capacity ?? "-", [detail]);

  const status = useMemo(
    () => (detail?.status || roomFromState?.status || "UNKNOWN").toString(),
    [detail, roomFromState],
  );

  const canBookRoom = useMemo(
    () => status.trim().toUpperCase() === "AVAILABLE",
    [status],
  );

  const isBookingLocked = useMemo(() => {
    if (!userProfile?.bookingLockedUntil) return false;
    const lockDate = new Date(userProfile.bookingLockedUntil);
    if (Number.isNaN(lockDate.getTime())) return false;
    return lockDate.getTime() > Date.now();
  }, [userProfile]);

  const amenities = useMemo(
    () =>
      Array.isArray(detail?.amenities)
        ? (detail.amenities as Amenity[])
        : ([] as Amenity[]),
    [detail],
  );

  const images = useMemo(
    () =>
      Array.isArray(detail?.images)
        ? (detail.images as RoomImage[])
        : ([] as RoomImage[]),
    [detail],
  );

  const feedbacks = useMemo(
    () =>
      Array.isArray(detail?.feedbacks)
        ? (detail.feedbacks as RoomFeedback[])
        : ([] as RoomFeedback[]),
    [detail],
  );

  const score = useMemo(() => {
    const raw = detail?.score;
    return typeof raw === "number" && !Number.isNaN(raw)
      ? raw.toFixed(1)
      : "N/A";
  }, [detail]);

  const currentUserName = useMemo(
    () => detail?.currentUserName || detail?.userName || "No active user",
    [detail],
  );

  const checkInTime = useMemo(
    () => detail?.checkInTime || "No check-in yet",
    [detail],
  );

  const handleBook = () => {
    if (!normalizedRoomId) {
      message.error("Missing room id");
      return;
    }

    if (!canBookRoom) {
      message.warning("This room is currently not available for booking.");
      return;
    }

    if (isBookingLocked) {
      message.warning(
        "Booking is temporarily locked. Please wait for countdown.",
      );
      return;
    }

    navigate(ROUTES.BOOK_ROOM.replace(":roomId", normalizedRoomId), {
      state: {
        room: {
          id: normalizedRoomId,
          roomName,
          building,
          floorInfo: floor,
          slot: typeof slot === "number" ? slot : 0,
          status: status === "AVAILABLE" ? "AVAILABLE" : "OCCUPIED",
        },
      },
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Title level={2} className="!mb-0 text-slate-900 font-semibold">
            Room Details
          </Title>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(ROUTES.ROOM_LIST)}
            className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            Back to list
          </button>
          <button
            type="button"
            onClick={() => navigate(ROUTES.ROOM_MAP)}
            className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
          >
            Back to map
          </button>
        </div>
      </div>

      {error && (
        <Alert
          message="Unable to load room details"
          description={error}
          type="error"
          showIcon
          className="mb-5"
        />
      )}

      {warning && (
        <Alert
          message="Limited room details"
          description={warning}
          type="warning"
          showIcon
          className="mb-5"
        />
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        {loading ? (
          <div className="py-14 text-center text-slate-500">
            Loading room details...
          </div>
        ) : (
          <div className="space-y-6 p-5 sm:p-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
              <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                Room
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-2xl font-semibold text-slate-900">
                  {roomName}
                </div>
                <span
                  className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status] || "bg-slate-100 text-slate-700 border-slate-200"}`}
                >
                  {status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="text-[11px] text-slate-500 mb-1">Building</div>
                <div className="text-sm font-semibold text-slate-800">
                  {building}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="text-[11px] text-slate-500 mb-1">Floor</div>
                <div className="text-sm font-semibold text-slate-800">
                  {floor}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="text-[11px] text-slate-500 mb-1">
                  Location code
                </div>
                <div className="text-sm font-semibold text-slate-800">
                  {roomCode}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="text-[11px] text-slate-500 mb-1">Capacity</div>
                <div className="text-sm font-semibold text-slate-800">
                  {slot}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="text-[11px] text-slate-500 mb-1">Score</div>
                <div className="text-sm font-semibold text-slate-800">
                  {score}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,_1.2fr)_minmax(0,_0.8fr)]">
              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="text-xs text-slate-500 mb-2">Amenities</div>
                {amenities.length === 0 ? (
                  <div className="text-sm text-slate-500">
                    No amenities information.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {amenities.map((item) => (
                      <span
                        key={item.id || item.name}
                        className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {item.name || "Amenity"}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-100 bg-white p-4">
                <div className="text-xs text-slate-500 mb-2">Check-in info</div>
                <div className="space-y-2 text-sm text-slate-700">
                  <div>
                    <span className="text-slate-500">Current user: </span>
                    <span className="font-semibold text-slate-800">
                      {currentUserName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Check-in time: </span>
                    <span className="font-semibold text-slate-800">
                      {formatDateTime(checkInTime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="mb-3 text-xs text-slate-500">Room images</div>
              {images.length === 0 ? (
                <div className="text-sm text-slate-500">No room images.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img) => (
                    <div
                      key={img.id || img.imageUrl}
                      className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
                    >
                      {img.imageUrl ? (
                        <img
                          src={img.imageUrl}
                          alt="Room"
                          className="h-28 w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-28 items-center justify-center text-xs text-slate-400">
                          No image URL
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500">Latest feedbacks</div>
                <div className="text-xs text-slate-400">
                  {feedbacks.length} feedback{feedbacks.length === 1 ? "" : "s"}
                </div>
              </div>

              {feedbacks.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No feedback available for this room.
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                  {feedbacks.map((item) => (
                    <div
                      key={item.id || `${item.rating}-${item.createdAt}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Rate
                          disabled
                          allowHalf
                          value={
                            typeof item.rating === "number" &&
                            !Number.isNaN(item.rating)
                              ? item.rating
                              : 0
                          }
                          className="text-xs"
                        />
                        <span className="text-[11px] text-slate-500">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 leading-6">
                        {item.description || "No feedback content."}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <div className="w-full sm:w-auto">
                <BookingLockCountdown
                  lockedUntil={userProfile?.bookingLockedUntil}
                  cancellationCount={userProfile?.cancellationCount}
                  className="mb-3"
                />
                <button
                  type="button"
                  onClick={handleBook}
                  className="w-full rounded-full bg-orange-400 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-500"
                >
                  Book this room
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomDetailPage;
