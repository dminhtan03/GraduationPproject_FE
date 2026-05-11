export const getStatusPillClass = (status?: string) => {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  if (normalized === "RESERVED") {
    return "border-emerald-300 bg-emerald-100 text-emerald-700";
  }
  if (normalized === "IN_USE" || normalized === "CHECKED_IN") {
    return "border-sky-300 bg-sky-100 text-sky-700";
  }
  if (normalized === "COMPLETED") {
    return "border-cyan-300 bg-cyan-100 text-cyan-700";
  }
  if (normalized === "CANCELLED" || normalized === "FORCE_CANCELLED") {
    return "border-rose-300 bg-rose-100 text-rose-700";
  }
  if (normalized === "NO_SHOW" || normalized === "FAILED") {
    return "border-amber-300 bg-amber-100 text-amber-700";
  }

  return "border-slate-300 bg-slate-100 text-slate-700";
};
