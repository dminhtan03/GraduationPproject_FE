const normalizeStatus = (status?: string) =>
  String(status || "")
    .trim()
    .toUpperCase();

export const getReservationStatusClass = (status?: string) => {
  const normalized = normalizeStatus(status);

  if (normalized === "RESERVED" || normalized === "APPROVED") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  }

  if (normalized === "IN_USE" || normalized === "CHECKED_IN") {
    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
  }

  if (normalized === "COMPLETED") {
    return "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200";
  }

  if (normalized === "CANCELLED") {
    return "bg-rose-50 text-rose-700 ring-1 ring-rose-200";
  }

  if (normalized === "FORCE_CANCELLED") {
    return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
  }

  if (normalized === "NO_SHOW" || normalized === "PENDING") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
  }

  if (normalized === "FAILED") {
    return "bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-200";
  }

  if (normalized === "LEARNING") {
    return "bg-purple-50 text-purple-700 ring-1 ring-purple-200";
  }

  return "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
};

export const formatReservationStatusLabel = (status?: string) => {
  const normalized = String(status || "").trim();
  if (!normalized) return "";
  return normalized.replace(/_/g, " ");
};
