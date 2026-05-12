import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Empty, Spin, Tag } from "antd";
import { PlusIcon, VideoCameraIcon } from "@heroicons/react/24/outline";
import { meetingService } from "../../services/meetingService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

const STATUS_COLOR: Record<string, string> = {
  pending: "default", running: "processing", completed: "success", failed: "error",
};

const formatDate = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("vi-VN", { hour12: false });
};

const MeetingListPage: React.FC = () => {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const showToast = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await meetingService.listMeetings();
      setMeetings(data);
    } catch {
      showToast("error", "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async () => {
    if (!createTitle.trim()) { showToast("warning", "Meeting title is required"); return; }
    setCreating(true);
    try {
      const meeting = await meetingService.createMeeting({ title: createTitle.trim() });
      showToast("success", "Meeting created");
      setShowCreate(false);
      setCreateTitle("");
      navigate(`/meetings/${meeting.id}`);
    } catch {
      showToast("error", "Failed to create meeting");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fade-in p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meetings</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered meeting transcription and task extraction</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 transition">
          <PlusIcon className="h-4 w-4" />
          New Meeting
        </button>
      </div>

      {/* Create form inline */}
      {showCreate && (
        <div className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">Meeting Title</p>
          <div className="flex gap-2">
            <input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              placeholder="e.g., Sprint Review Q2 2026"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
            <button type="button" onClick={handleCreate} disabled={creating}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-60">
              {creating ? "Creating..." : "Create"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spin size="large" /></div>
      ) : meetings.length === 0 ? (
        <Empty
          image={<VideoCameraIcon className="h-16 w-16 text-slate-200 mx-auto" />}
          description="No meetings yet. Create one to get started."
        />
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <div key={m.id} onClick={() => navigate(`/meetings/${m.id}`)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-900">{m.title}</p>
                  {m.summary && (
                    <p className="text-sm text-slate-500 mt-0.5 line-clamp-2">{m.summary}</p>
                  )}
                </div>
                <Tag color={STATUS_COLOR[m.status] ?? "default"} className="shrink-0">
                  {m.status?.toUpperCase()}
                </Tag>
              </div>
              <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                <span>{formatDate(m.createdAt)}</span>
                {m.durationSeconds && <span>{Math.round(m.durationSeconds / 60)}m recording</span>}
                {m.speakerCount && <span>{m.speakerCount} speakers</span>}
                {m.language && <span>{m.language.toUpperCase()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default MeetingListPage;
