import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Alert, Typography, message } from "antd";
import { roomService } from "../../services/roomService";
import { ROUTES } from "../../constants";
import type { ApiError, Room } from "../../types";

const { Title, Text } = Typography;

interface LocationState {
  room?: Room;
}

const RoomDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);

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
        } else if (roomFromState) {
          setDetail(roomFromState);
          setWarning(
            "Unable to fetch full room details from server. Showing basic data from room map.",
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

  const roomName = useMemo(
    () =>
      detail?.roomName ||
      detail?.locationCode ||
      detail?.name ||
      roomFromState?.roomName ||
      normalizedRoomId,
    [detail, roomFromState, normalizedRoomId],
  );

  const building = useMemo(
    () =>
      detail?.buildingName ||
      detail?.building ||
      roomFromState?.building ||
      "-",
    [detail, roomFromState],
  );

  const floor = useMemo(
    () => detail?.floorName || detail?.floor || roomFromState?.floorInfo || "-",
    [detail, roomFromState],
  );

  const slot = useMemo(
    () => detail?.slot ?? detail?.capacity ?? roomFromState?.slot ?? "-",
    [detail, roomFromState],
  );

  const status = useMemo(
    () => (detail?.status || roomFromState?.status || "UNKNOWN").toString(),
    [detail, roomFromState],
  );

  const currentUserName = useMemo(
    () => detail?.currentUserName || detail?.userName || "No active user",
    [detail],
  );

  const currentUserId = useMemo(
    () => detail?.currentUserId || detail?.userId || "-",
    [detail],
  );

  const checkInTime = useMemo(() => detail?.checkInTime || "-", [detail]);

  const handleBook = () => {
    if (!normalizedRoomId) {
      message.error("Missing room id");
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Title level={2} className="!mb-1 text-gray-800 font-semibold">
            Room Details
          </Title>
          <Text className="text-gray-500">
            Review room information before booking
          </Text>
        </div>
        <button
          type="button"
          onClick={() => navigate(ROUTES.ROOM_MAP)}
          className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-100"
        >
          Back to map
        </button>
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

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        {loading ? (
          <div className="py-12 text-center text-gray-500">
            Loading room details...
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="text-sm text-gray-500 mb-1">Room</div>
              <div className="text-2xl font-semibold text-gray-900">
                {roomName}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs text-gray-500 mb-1">Building</div>
                <div className="text-sm font-semibold text-gray-800">
                  {building}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs text-gray-500 mb-1">Floor</div>
                <div className="text-sm font-semibold text-gray-800">
                  {floor}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs text-gray-500 mb-1">Capacity</div>
                <div className="text-sm font-semibold text-gray-800">
                  {slot}
                </div>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <div className="text-sm font-semibold text-gray-800">
                  {status}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-2">Description</div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
                {detail?.description ||
                  detail?.note ||
                  "No additional room description."}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500 mb-2">
                Current check-in status
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] text-gray-500 mb-1">
                    Current user
                  </div>
                  <div className="font-semibold text-gray-800">
                    {currentUserName}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 mb-1">User id</div>
                  <div className="font-semibold text-gray-800">
                    {currentUserId}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-gray-500 mb-1">
                    Check-in time
                  </div>
                  <div className="font-semibold text-gray-800">
                    {checkInTime}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleBook}
                disabled={status !== "AVAILABLE"}
                className="px-4 py-2 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Book this room
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomDetailPage;
