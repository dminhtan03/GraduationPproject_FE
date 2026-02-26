import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "antd";
import { TagIcon } from "@heroicons/react/24/outline";
import { roomService, type RoomsMapBuilding } from "../../services/roomService";
import { ROUTES } from "../../constants";
import {
  type MapRoom,
  type MapRoomStatus,
  type FloorWithRooms,
  type SelectedRoom,
  splitRoomsForMap,
  getStatusStyles,
  sortFloorsByLevel,
} from "../../utils";

const RoomMapPage: React.FC = () => {
  const navigate = useNavigate();

  const [buildings, setBuildings] = useState<RoomsMapBuilding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null,
  );
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<SelectedRoom | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await roomService.getRoomsMap();
        const list = Array.isArray(data.buildingResponse)
          ? data.buildingResponse
          : [];

        const normalizedList = list.map((building: any) => ({
          ...building,
          floors: sortFloorsByLevel(building.floors),
        }));

        setBuildings(normalizedList as RoomsMapBuilding[]);

        if (normalizedList.length > 0) {
          const firstBuilding = normalizedList[0];
          setSelectedBuildingId(firstBuilding.buildingId);
          if (firstBuilding.floors && firstBuilding.floors.length > 0) {
            setSelectedFloorId(firstBuilding.floors[0].floorId);
          }
        }
      } catch (e: any) {
        const message =
          e && typeof e === "object" && typeof e.message === "string"
            ? e.message
            : "Unable to load room map";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const currentBuilding = useMemo(
    () => buildings.find((b) => b.buildingId === selectedBuildingId) || null,
    [buildings, selectedBuildingId],
  );

  const currentFloor: FloorWithRooms | null = useMemo(() => {
    if (!currentBuilding || !currentBuilding.floors) return null;
    const floor =
      currentBuilding.floors.find((f) => f.floorId === selectedFloorId) ||
      currentBuilding.floors[0];
    if (!floor) return null;

    const rooms: MapRoom[] = Array.isArray(floor.rooms)
      ? floor.rooms.map((r: any) => ({
          roomId: r.roomId,
          locationCode: r.locationCode,
          status: r.status as MapRoomStatus,
          score: r.score,
        }))
      : [];

    return {
      floorId: floor.floorId,
      floorName: floor.floorName,
      rooms,
    };
  }, [currentBuilding, selectedFloorId]);

  const isFloorFull = (floor: { rooms: any[] }) => {
    if (!floor.rooms || floor.rooms.length === 0) return false;
    return floor.rooms.every((r: any) => r.status !== "AVAILABLE");
  };

  const { top, left, right, bottom } = useMemo(
    () => splitRoomsForMap(currentFloor?.rooms || []),
    [currentFloor],
  );

  const handleRoomClick = (room: MapRoom) => {
    if (!currentBuilding || !currentFloor) return;
    navigate(ROUTES.ROOM_DETAIL.replace(":roomId", room.roomId), {
      state: {
        room: {
          id: room.roomId,
          roomName: room.locationCode,
          building: currentBuilding.buildingName,
          floorInfo: currentFloor.floorName,
          slot: 0,
          status: room.status === "AVAILABLE" ? "AVAILABLE" : "OCCUPIED",
        },
      },
    });
  };

  const handleBooking = () => {
    if (!selectedRoom) return;
    // Pass roomId in URL and full room data in state
    navigate(ROUTES.BOOK_ROOM.replace(":roomId", selectedRoom.roomId), {
      state: {
        room: {
          id: selectedRoom.roomId,
          roomName: selectedRoom.locationCode,
          building: selectedRoom.buildingName,
          floorInfo: selectedRoom.floorName,
          status: selectedRoom.status,
        },
      },
    });
  };

  if (loading && buildings.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="h-12 w-12 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (error && buildings.length === 0) {
    return (
      <div className="max-w-3xl mx-auto mt-10">
        <Alert
          message="Unable to load room map"
          description={error}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-1">
            Interactive Campus Map
          </h1>
          <p className="text-sm text-slate-500">
            View real-time availability across all university wings.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-full border border-slate-200 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
          >
            List view
          </button>
          <button
            type="button"
            disabled={!selectedRoom}
            onClick={handleBooking}
            className="px-4 py-2 rounded-full text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            Book a room
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Building tabs + legend */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-5">
        <div className="flex flex-wrap gap-2">
          {buildings.map((building) => (
            <button
              key={building.buildingId}
              type="button"
              onClick={() => {
                setSelectedBuildingId(building.buildingId);
                const firstFloor =
                  building.floors && building.floors.length > 0
                    ? building.floors[0]
                    : null;
                setSelectedFloorId(firstFloor ? firstFloor.floorId : null);
                setSelectedRoom(null);
              }}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition
								${
                  building.buildingId === selectedBuildingId
                    ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
            >
              {building.buildingName}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-3 h-3 rounded-full bg-emerald-400" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-700">
            <span className="w-3 h-3 rounded-full bg-amber-400" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-3 rounded-full bg-slate-300" />
            <span>Maintenance</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,_2.2fr)_minmax(0,_1.2fr)] gap-6 items-start">
        {/* Map + floor selector */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 flex flex-col gap-4">
          <div className="flex justify-between items-center mb-2">
            <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              {currentBuilding ? currentBuilding.buildingName : "No building"}
            </div>
            <div className="flex flex-col gap-2 text-xs">
              <span className="font-semibold text-slate-600">Select floor</span>
              <div className="flex flex-wrap gap-2">
                {currentBuilding?.floors?.map((floor) => (
                  <button
                    key={floor.floorId}
                    type="button"
                    onClick={() => {
                      setSelectedFloorId(floor.floorId);
                      setSelectedRoom(null);
                    }}
                    className={`relative px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-medium transition
											${
                        floor.floorId === selectedFloorId
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-white"
                      }`}
                  >
                    {floor.floorName}
                    {isFloorFull(floor) && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Full
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Map canvas */}
          <div className="relative flex-1 min-h-[320px] sm:min-h-[380px] bg-slate-50 rounded-2xl border border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
            {loading && (
              <div className="text-sm text-slate-500">Loading map...</div>
            )}
            {!loading && currentFloor && currentFloor.rooms.length === 0 && (
              <div className="text-sm text-slate-500">
                No rooms found for this floor.
              </div>
            )}

            {!loading && currentFloor && currentFloor.rooms.length > 0 && (
              <div className="relative w-full max-w-[640px] aspect-[4/3] bg-white rounded-2xl border border-slate-200 shadow-inner flex flex-col">
                {/* Top row */}
                <div className="flex-0 grid grid-cols-5 gap-2 p-3 border-b border-slate-100">
                  {top.map((room) => (
                    <button
                      key={room.roomId}
                      type="button"
                      onClick={() => handleRoomClick(room)}
                      className={`h-16 rounded-xl border text-[11px] sm:text-xs font-medium flex flex-col items-center justify-center text-center cursor-pointer transition hover:shadow-sm hover:-translate-y-0.5 ${getStatusStyles(room.status)}`}
                    >
                      <span className="mb-0.5">{room.locationCode}</span>
                    </button>
                  ))}
                </div>

                {/* Middle area with left/right columns */}
                <div className="flex-1 grid grid-cols-[80px_minmax(0,_1fr)_80px] gap-2 px-3 py-4">
                  <div className="flex flex-col gap-2">
                    {left.map((room) => (
                      <button
                        key={room.roomId}
                        type="button"
                        onClick={() => handleRoomClick(room)}
                        className={`flex-1 min-h-[52px] rounded-xl border text-[11px] sm:text-xs font-medium flex flex-col items-center justify-center text-center cursor-pointer transition hover:shadow-sm hover:-translate-y-0.5 ${getStatusStyles(room.status)}`}
                      >
                        <span className="mb-0.5">{room.locationCode}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-center">
                    <div className="w-full max-w-xs h-32 sm:h-40 rounded-2xl border border-dashed border-slate-300 bg-sky-50 flex flex-col items-center justify-center text-xs text-sky-800">
                      <span className="font-semibold mb-1">Common Area</span>
                      <span className="text-[10px] text-sky-700">
                        Collaboration & waiting space
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {right.map((room) => (
                      <button
                        key={room.roomId}
                        type="button"
                        onClick={() => handleRoomClick(room)}
                        className={`flex-1 min-h-[52px] rounded-xl border text-[11px] sm:text-xs font-medium flex flex-col items-center justify-center text-center cursor-pointer transition hover:shadow-sm hover:-translate-y-0.5 ${getStatusStyles(room.status)}`}
                      >
                        <span className="mb-0.5">{room.locationCode}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Bottom row */}
                <div className="flex-0 grid grid-cols-5 gap-2 p-3 border-t border-slate-100">
                  {bottom.map((room) => (
                    <button
                      key={room.roomId}
                      type="button"
                      onClick={() => handleRoomClick(room)}
                      className={`h-16 rounded-xl border text-[11px] sm:text-xs font-medium flex flex-col items-center justify-center text-center cursor-pointer transition hover:shadow-sm hover:-translate-y-0.5 ${getStatusStyles(room.status)}`}
                    >
                      <span className="mb-0.5">{room.locationCode}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Room details panel */}
        <aside className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 flex flex-col gap-4">
          <div className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Room details
          </div>

          {!selectedRoom && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-500 text-sm">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <TagIcon className="w-5 h-5 text-slate-500" />
              </div>
              <p className="font-medium text-slate-700 mb-1">Select a room</p>
              <p className="text-xs text-slate-500">
                Click on an available room tile to view details and book.
              </p>
            </div>
          )}

          {selectedRoom && (
            <div className="flex-1 flex flex-col gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  Selected room
                </div>
                <div className="text-xl font-semibold text-slate-900">
                  {selectedRoom.locationCode}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedRoom.buildingName} • {selectedRoom.floorName}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500 mb-0.5">
                    Status
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${getStatusStyles(selectedRoom.status)}`}
                  >
                    {selectedRoom.status === "AVAILABLE"
                      ? "Available"
                      : selectedRoom.status === "UNAVAILABLE"
                        ? "Occupied"
                        : "Maintenance"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500 mb-0.5">
                    Rating
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {selectedRoom.score != null
                      ? selectedRoom.score.toFixed(1)
                      : "N/A"}
                  </div>
                </div>
              </div>

              <button
                type="button"
                disabled={selectedRoom.status !== "AVAILABLE"}
                onClick={handleBooking}
                className="mt-auto w-full inline-flex items-center justify-center rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Booking this room
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};

export default RoomMapPage;
