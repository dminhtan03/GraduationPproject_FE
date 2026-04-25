import type { AnimatedDropdownOption } from "../../components/common/AnimatedDropdown";
import type { MapRoomStatus } from "../../utils";

export const ROOM_LAYOUT_STORAGE_KEY = "room-map-layout-order";
export const FEEDBACK_PAGE_SIZE = 5;

export const roomMapStatusFilterOptions: Array<
  AnimatedDropdownOption<"ALL" | MapRoomStatus>
> = [
  { value: "ALL", label: "All" },
  { value: "AVAILABLE", label: "Available" },
  { value: "LEARNING", label: "Learning" },
  { value: "UNAVAILABLE", label: "In Use" },
  { value: "BROKEN", label: "Maintenance" },
];
