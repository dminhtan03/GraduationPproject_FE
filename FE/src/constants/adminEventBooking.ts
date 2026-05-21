import { ServiceStatus } from "../types/adminEventBooking";

export const ACTIVE_STATUSES: ServiceStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
];
export const HISTORY_STATUSES: ServiceStatus[] = ["DONE", "CANCELLED"];

export const statusConfig: Record<ServiceStatus, { label: string }> = {
  PENDING: { label: "Pending" },
  CONFIRMED: { label: "Confirmed" },
  IN_PROGRESS: { label: "In Progress" },
  DONE: { label: "Done" },
  CANCELLED: { label: "Cancelled" },
};
