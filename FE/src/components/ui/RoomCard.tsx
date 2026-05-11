import React from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import type { RoomListItem } from "../../types/roomList";

interface RoomCardProps {
  room: RoomListItem;
  timeFilterActive: boolean;
  timeRange: {
    startDate: string;
    startHour: string;
    startMinute: string;
    endDate: string;
    endHour: string;
    endMinute: string;
  };
}

const RoomCard: React.FC<RoomCardProps> = ({ room, timeFilterActive, timeRange }) => {
  const navigate = useNavigate();
  const isAvailable = room.status === "AVAILABLE";

  let statusLabel = room.status;
  let statusColor = "bg-rose-500";
  let statusMessage = <span className="text-rose-500 font-semibold">In Use</span>;

  if (room.status === "AVAILABLE") {
    statusLabel = "AVAILABLE";
    statusColor = "bg-emerald-500";
    statusMessage = <span className="text-emerald-500 font-semibold">Ready now</span>;
  } else if (room.status === "BROKEN") {
    statusLabel = "MAINTENANCE";
    statusColor = "bg-slate-500";
    statusMessage = <span className="text-slate-500 font-semibold">Maintenance</span>;
  } else if (room.status === "LEARNING") {
    statusLabel = "CLASSROOM";
    statusColor = "bg-purple-500";
  } else {
    statusLabel = "OCCUPIED";
  }

  const capacity = room.capacity || 0;
  const amenities = Array.isArray(room.amenities) && room.amenities.length > 0 ? room.amenities : [];

  const roomImage = room.roomImage;

  return (
    <article className="bg-white rounded-[20px] border border-gray-200 shadow-sm overflow-hidden flex flex-col group hover:shadow-lg transition-all duration-300">
      <div className="relative h-48 w-full bg-slate-100 overflow-hidden flex items-center justify-center">
        {roomImage ? (
          <>
            <img
              src={roomImage}
              alt={room.roomName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-slate-900/20" />
          </>
        ) : (
          <>
            <div className="flex h-full w-full items-center justify-center text-sm font-medium text-slate-400 bg-slate-50 border-b border-slate-100">
              No image
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-slate-900/10" />
          </>
        )}

        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wider text-white shadow-sm ${statusColor}`}
          >
            {statusLabel}
          </span>
          <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-slate-800 text-[11px] font-semibold shadow-sm flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {capacity} Persons
          </span>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-bold text-slate-900">{room.roomName}</h3>
          <div className="text-right">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
              Status
            </div>
            <div className="text-sm">{statusMessage}</div>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-slate-500 mb-5">
          <svg className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="line-clamp-2 leading-tight">
            {room.building} &bull; <br />
            {room.floorInfo || "Floor N/A"}
          </span>
        </div>

        {amenities.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {amenities.map((amenity, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[11px] font-medium text-slate-600"
              >
                {amenity === "Fast WiFi" && (
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.906 14.142 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    />
                  </svg>
                )}
                {amenity === "4K Projector" && (
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                )}
                {amenity === "Coffee" && (
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                    />
                  </svg>
                )}
                {amenity === "Pro Audio" && (
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                    />
                  </svg>
                )}
                {amenity}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto">
          <button
            type="button"
            className={`w-full py-2.5 rounded-xl text-[13px] font-bold transition-all duration-200 ${
              isAvailable
                ? "bg-slate-50 text-slate-800 hover:bg-slate-100 border border-slate-200 hover:border-slate-300"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
            onClick={() => {
              const targetRoute = ROUTES.ROOM_DETAIL;
              if (isAvailable && timeFilterActive) {
                navigate(targetRoute.replace(":roomId", room.id), {
                  state: {
                    room,
                    timeRange,
                  },
                });
              } else {
                navigate(targetRoute.replace(":roomId", room.id), {
                  state: { room },
                });
              }
            }}
          >
            {isAvailable ? "View Details & Book" : "View Schedule"}
          </button>
        </div>
      </div>
    </article>
  );
};

export default RoomCard;
