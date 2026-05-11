import React from "react";
import { ServiceStatus } from "../../types/adminEventBooking";
import { statusConfig } from "../../constants/adminEventBooking";

interface ServiceStatusBadgeProps {
  status?: string | null;
  showDot?: boolean;
}

const ServiceStatusBadge: React.FC<ServiceStatusBadgeProps> = ({
  status,
  showDot = true,
}) => {
  const normalized = String(status || "PENDING").toUpperCase();
  const label = statusConfig[normalized as ServiceStatus]?.label ?? status;

  const cls =
    normalized === "DONE"
      ? "bg-emerald-50 text-emerald-700"
      : normalized === "CONFIRMED" || normalized === "IN_PROGRESS"
        ? "bg-blue-50 text-blue-700"
        : normalized === "CANCELLED"
          ? "bg-red-50 text-red-600"
          : normalized === "PENDING"
            ? "bg-amber-50 text-amber-700"
            : "bg-slate-100 text-slate-500";
  const dotCls =
    normalized === "DONE"
      ? "bg-emerald-500"
      : normalized === "CONFIRMED" || normalized === "IN_PROGRESS"
        ? "bg-blue-500"
        : normalized === "CANCELLED"
          ? "bg-red-500"
          : normalized === "PENDING"
            ? "bg-amber-500"
            : "bg-slate-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {showDot && <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />}
      {label}
    </span>
  );
};

export default ServiceStatusBadge;
