import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { api } from "../../services/api";
import { ROUTES } from "../../constants";
import { API_ENDPOINTS } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";
import type { Room } from "../../types";

interface LocationState {
  room?: Room;
}

const DAYS: Array<{ key: string; label: string }> = [
  { key: "MONDAY",    label: "Mon" },
  { key: "TUESDAY",   label: "Tue" },
  { key: "WEDNESDAY", label: "Wed" },
  { key: "THURSDAY",  label: "Thu" },
  { key: "FRIDAY",    label: "Fri" },
  { key: "SATURDAY",  label: "Sat" },
  { key: "SUNDAY",    label: "Sun" },
];

const todayInput = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// start+ chức năng 3 màn hình đặt phòng (màn đặt phòng định kì)
const BookRoomRecurringPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { state } = useLocation();

  const room = (state as LocationState | null)?.room;
  const normalizedRoomId = useMemo(() => roomId || room?.id || "", [roomId, room]);

  const [startTimeOfDay, setStartTimeOfDay] = useState("08:00");
  const [endTimeOfDay, setEndTimeOfDay]     = useState("09:00");
  const [daysOfWeek, setDaysOfWeek]         = useState<string[]>(["MONDAY"]);
  const [fromDate, setFromDate]             = useState(todayInput());
  const [untilDate, setUntilDate]           = useState("");
  const [rollingWeeks, setRollingWeeks]     = useState("4");
  const [purpose, setPurpose]               = useState("");
  const [note, setNote]                     = useState("");
  const [acceptedRules, setAcceptedRules]   = useState(false);
  const [loading, setLoading]               = useState(false);
  const [popup, setPopup]                   = useState<{ type: MessageType; message: string } | null>(null);

  const showPopup = (type: MessageType, msg: string) => {
    setPopup({ type, message: msg });
    window.setTimeout(() => setPopup(null), 4000);
  };

  const toggleDay = (day: string) => {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  };

  // Fix: dùng showPopup thay vì antd message (cần App context mới dùng được)
  const validateForm = (): boolean => {
    if (!normalizedRoomId)          { showPopup("error", "Missing room id"); return false; }
    if (!acceptedRules)             { showPopup("warning", "Vui lòng đồng ý với nội quy phòng trước khi xác nhận."); return false; }
    if (!purpose.trim())            { showPopup("warning", "Mục đích sử dụng là bắt buộc."); return false; }
    if (!startTimeOfDay || !endTimeOfDay || startTimeOfDay === endTimeOfDay) {
      showPopup("warning", "Giờ bắt đầu và kết thúc phải khác nhau."); return false;
    }
    if (!fromDate)                  { showPopup("warning", "Ngày bắt đầu là bắt buộc."); return false; }
    if (daysOfWeek.length === 0)    { showPopup("warning", "Vui lòng chọn ít nhất 1 ngày trong tuần."); return false; }
    return true;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.RESERVATION_SERIES.CREATE, {
        roomId: normalizedRoomId,
        startTimeOfDay: `${startTimeOfDay}:00`,
        endTimeOfDay: `${endTimeOfDay}:00`,
        daysOfWeek,
        fromDate,
        untilDate: untilDate || null,
        rollingWindowWeeks: rollingWeeks.trim() ? Number(rollingWeeks) : null,
        purpose: purpose.trim(),
        note: note.trim() || null,
      });
      showPopup("success", "Đặt phòng định kỳ thành công!");
      window.setTimeout(() => navigate(ROUTES.MY_RECURRING_SERIES), 1000);
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.message || "Không thể tạo lịch định kỳ";
      showPopup("error", String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
                Đặt phòng định kỳ
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Phòng: <span className="font-semibold">{room?.roomName || normalizedRoomId}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(ROUTES.ROOM_DETAIL.replace(":roomId", normalizedRoomId), { state: { room } })}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Quay lại
            </button>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Giờ bắt đầu</label>
                <input
                  type="time"
                  value={startTimeOfDay}
                  onChange={(e) => setStartTimeOfDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Giờ kết thúc</label>
                <input
                  type="time"
                  value={endTimeOfDay}
                  onChange={(e) => setEndTimeOfDay(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Nếu giờ kết thúc nhỏ hơn giờ bắt đầu → coi như qua ngày hôm sau.
                </p>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">Ngày trong tuần</label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => toggleDay(d.key)}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-sm font-semibold",
                      daysOfWeek.includes(d.key)
                        ? "border-orange-200 bg-orange-50 text-orange-700"
                        : "border-slate-300 text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Từ ngày</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Đến ngày (tuỳ chọn)</label>
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Rolling window (tuần)</label>
                <input
                  value={rollingWeeks}
                  onChange={(e) => setRollingWeeks(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Số tuần phía trước được tự động tạo booking.
                </p>
              </div> */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
                  Mục đích <span className="text-red-500">*</span>
                </label>
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                  placeholder="Họp nhóm hàng tuần..."
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">Ghi chú (tuỳ chọn)</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                placeholder="Ghi chú thêm..."
              />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2.5 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedRules}
                onChange={(e) => setAcceptedRules(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-emerald-600"
              />
              <span className="leading-5">Tôi đã đọc và đồng ý tuân thủ nội quy sử dụng phòng.</span>
            </label>

            <button
              disabled={loading}
              type="submit"
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-12px_rgba(249,115,22,0.85)] transition hover:brightness-105 disabled:opacity-70"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <ArrowPathIcon className="h-5 w-5" />
                {loading ? "Đang tạo..." : "Tạo lịch đặt định kỳ"}
              </span>
            </button>
          </form>
        </div>

        {popup && <CustomMessage type={popup.type} message={popup.message} onClose={() => setPopup(null)} />}
      </div>
    </div>
  );
};

export default BookRoomRecurringPage;
// end+ chức năng 3 màn hình đặt phòng (màn đặt phòng định kì)
