import React, { useState } from "react";
import { api } from "../../services/api";
import { API_ENDPOINTS } from "../../constants/endpoints";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

// start+ chức năng check-in bằng QR (demo UI)
const QrCheckInPage: React.FC = () => {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(
    null,
  );

  const consume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;

    setLoading(true);
    try {
      await api.post(API_ENDPOINTS.CHECKIN_QR.CONSUME, { token: token.trim() });
      setToast({ type: "success", message: "QR check-in successful" });
      setToken("");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "QR check-in failed";
      setToast({ type: "error", message: String(msg) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold text-slate-900">QR Check-in</h1>
      <p className="mt-1 text-sm text-slate-500">
        Dán token QR (hoặc nội dung QR) để check-in.
      </p>

      <form onSubmit={consume} className="mt-6 space-y-3">
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="QR token..."
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-200"
        />

        <button
          disabled={loading}
          className="w-full rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60"
          type="submit"
        >
          {loading ? "Checking in..." : "Check-in"}
        </button>
      </form>

      {toast ? (
        <CustomMessage
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      ) : null}
    </div>
  );
};

export default QrCheckInPage;
// end+ chức năng check-in bằng QR (demo UI)

