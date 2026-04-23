import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import { API_ENDPOINTS, buildUrl } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

type Series = {
  id: string;
  roomId: string;
  roomCode: string;
  startTimeOfDay: string;
  endTimeOfDay: string;
  daysOfWeek: string;
  purpose: string;
  note?: string | null;
  fromDate: string;
  untilDate?: string | null;
  rollingWindowWeeks?: number | null;
  status: string;
  lastSyncUntil?: string | null;
  createdAt?: string | null;
};

const DAYS: Array<{ key: string; label: string }> = [
  { key: "MONDAY", label: "Mon" },
  { key: "TUESDAY", label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY", label: "Thu" },
  { key: "FRIDAY", label: "Fri" },
  { key: "SATURDAY", label: "Sat" },
  { key: "SUNDAY", label: "Sun" },
];

// start+ chức năng đặt phòng lặp lại (demo UI)
const MyRecurringSeriesPage: React.FC = () => {
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(
    null,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    roomId: "",
    startTimeOfDay: "08:00",
    endTimeOfDay: "09:00",
    daysOfWeek: ["MONDAY", "WEDNESDAY", "FRIDAY"] as string[],
    fromDate: "",
    untilDate: "",
    rollingWindowWeeks: "4",
    purpose: "Recurring booking",
    note: "",
  });

  const payload = useMemo(() => {
    const start = form.startTimeOfDay ? `${form.startTimeOfDay}:00` : null;
    const end = form.endTimeOfDay ? `${form.endTimeOfDay}:00` : null;
    const rolling = form.rollingWindowWeeks.trim()
      ? Number(form.rollingWindowWeeks)
      : null;
    return {
      roomId: form.roomId.trim(),
      startTimeOfDay: start,
      endTimeOfDay: end,
      daysOfWeek: form.daysOfWeek,
      fromDate: form.fromDate || null,
      untilDate: form.untilDate || null,
      rollingWindowWeeks: Number.isFinite(rolling as number) ? (rolling as number) : null,
      purpose: form.purpose.trim(),
      note: form.note.trim() || null,
    };
  }, [form]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get(API_ENDPOINTS.RESERVATION_SERIES.MY);
      const raw = (res.data as any)?.data ?? res.data;
      setSeries(Array.isArray(raw) ? (raw as Series[]) : []);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to load series";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleDay = (day: string) => {
    setForm((prev) => {
      const exists = prev.daysOfWeek.includes(day);
      return {
        ...prev,
        daysOfWeek: exists ? prev.daysOfWeek.filter((d) => d !== day) : [...prev.daysOfWeek, day],
      };
    });
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payload.roomId || !payload.startTimeOfDay || !payload.endTimeOfDay || !payload.fromDate) return;
    if (!payload.purpose) return;
    if (!payload.daysOfWeek.length) return;

    try {
      await api.post(API_ENDPOINTS.RESERVATION_SERIES.CREATE, {
        roomId: payload.roomId,
        startTimeOfDay: payload.startTimeOfDay,
        endTimeOfDay: payload.endTimeOfDay,
        daysOfWeek: payload.daysOfWeek,
        fromDate: payload.fromDate,
        untilDate: payload.untilDate,
        rollingWindowWeeks: payload.rollingWindowWeeks,
        purpose: payload.purpose,
        note: payload.note,
      });
      setToast({ type: "success", message: "Series created and synced" });
      setIsModalOpen(false);
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Create series failed";
      setToast({ type: "error", message: String(msg) });
    }
  };

  const syncNow = async (seriesId: string) => {
    try {
      await api.put(buildUrl(API_ENDPOINTS.RESERVATION_SERIES.SYNC, { seriesId }));
      setToast({ type: "success", message: "Synced successfully" });
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Sync failed";
      setToast({ type: "error", message: String(msg) });
    }
  };

  const cancel = async (seriesId: string) => {
    if (!window.confirm("Cancel this recurring series? Future reservations will be cancelled.")) return;
    try {
      await api.delete(buildUrl(API_ENDPOINTS.RESERVATION_SERIES.CANCEL, { seriesId }));
      setToast({ type: "success", message: "Series cancelled" });
      load();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Cancel failed";
      setToast({ type: "error", message: String(msg) });
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Recurring Series</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tạo đặt phòng lặp lại theo tuần và tự sync các booking trong rolling window.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
        >
          Create series
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Room</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Time</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Days</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Range</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500">Status</th>
              <th className="px-4 py-3 text-xs font-bold uppercase text-slate-500 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  Loading...
                </td>
              </tr>
            ) : series.length ? (
              series.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{s.roomCode}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {String(s.startTimeOfDay).slice(0, 5)} - {String(s.endTimeOfDay).slice(0, 5)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{s.daysOfWeek}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {s.fromDate} {s.untilDate ? `→ ${s.untilDate}` : ""}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{s.status}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => syncNow(s.id)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Sync now
                      </button>
                      <button
                        onClick={() => cancel(s.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                  No recurring series yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-bold text-slate-900">Create recurring series</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <form onSubmit={create} className="space-y-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Room ID</label>
                <input
                  value={form.roomId}
                  onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="roomId..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Start</label>
                  <input
                    type="time"
                    value={form.startTimeOfDay}
                    onChange={(e) => setForm((p) => ({ ...p, startTimeOfDay: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">End</label>
                  <input
                    type="time"
                    value={form.endTimeOfDay}
                    onChange={(e) => setForm((p) => ({ ...p, endTimeOfDay: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Days of week</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((d) => (
                    <button
                      type="button"
                      key={d.key}
                      onClick={() => toggleDay(d.key)}
                      className={[
                        "rounded-lg border px-3 py-1.5 text-sm font-semibold",
                        form.daysOfWeek.includes(d.key)
                          ? "border-orange-200 bg-orange-50 text-orange-700"
                          : "border-slate-300 text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">From date</label>
                  <input
                    type="date"
                    value={form.fromDate}
                    onChange={(e) => setForm((p) => ({ ...p, fromDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Until date (optional)</label>
                  <input
                    type="date"
                    value={form.untilDate}
                    onChange={(e) => setForm((p) => ({ ...p, untilDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Rolling window (weeks)</label>
                  <input
                    value={form.rollingWindowWeeks}
                    onChange={(e) => setForm((p) => ({ ...p, rollingWindowWeeks: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                    inputMode="numeric"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">Purpose</label>
                  <input
                    value={form.purpose}
                    onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Note (optional)</label>
                <input
                  value={form.note}
                  onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />
      ) : null}
    </div>
  );
};

export default MyRecurringSeriesPage;
// end+ chức năng đặt phòng lặp lại (demo UI)

