import type { AnimatedDropdownOption } from "../components/common/AnimatedDropdown";
import type { FilterType } from "../types/roomList";

export const ROOM_LIST_PAGE_SIZE = 9;

export const roomStatusFilterOptions: Array<AnimatedDropdownOption<FilterType>> = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "broken", label: "Maintenance" },
  { value: "learning", label: "LEARNING" },
];
