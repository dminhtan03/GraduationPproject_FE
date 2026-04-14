import React from "react";
import { getStatusStyles, type MapRoom } from "../../../utils";

type RoomTileProps = {
  room: MapRoom;
  className?: string;
  textClassName?: string;
  isDragOver?: boolean;
  isDragging?: boolean;
  onSelect: (room: MapRoom) => void;
  onDragStart?: (roomId: string) => void;
  onDragEnd?: () => void;
  onDragEnter?: (roomId: string) => void;
  onDragLeave?: (roomId: string) => void;
  onDrop?: (targetRoomId: string) => void;
};

const RoomTile: React.FC<RoomTileProps> = ({
  room,
  className = "h-16",
  textClassName = "text-[11px] sm:text-xs",
  isDragOver = false,
  isDragging = false,
  onSelect,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDrop,
}) => {
  const canDrag = !room.positioned;

  return (
    <button
      type="button"
      onClick={() => onSelect(room)}
      draggable={canDrag}
      onDragStart={() => {
        if (!canDrag) return;
        onDragStart?.(room.roomId);
      }}
      onDragEnd={() => onDragEnd?.()}
      onDragOver={(event) => {
        if (!canDrag) return;
        event.preventDefault();
      }}
      onDragEnter={() => {
        if (!canDrag) return;
        onDragEnter?.(room.roomId);
      }}
      onDragLeave={() => {
        if (!canDrag) return;
        onDragLeave?.(room.roomId);
      }}
      onDrop={(event) => {
        if (!canDrag) return;
        event.preventDefault();
        onDrop?.(room.roomId);
      }}
      className={`${className} rounded-xl border ${textClassName} font-medium flex flex-col items-center justify-center text-center cursor-pointer transition hover:shadow-sm hover:-translate-y-0.5 ${getStatusStyles(room.status)} ${isDragOver ? "ring-2 ring-orange-400 ring-offset-2" : ""}`}
    >
      <span className="mb-0.5">{room.locationCode}</span>
      {isDragging && <span className="text-[10px] opacity-70">Moving...</span>}
    </button>
  );
};

export default RoomTile;
