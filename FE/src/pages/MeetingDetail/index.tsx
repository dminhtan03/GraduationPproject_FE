import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Tag, Spin, Input, Select } from "antd";
import { ArrowLeftIcon, SparklesIcon, ClipboardDocumentCheckIcon } from "@heroicons/react/24/outline";
import { meetingService } from "../../services/meetingService";
import CustomMessage, { type MessageType } from "../../components/common/CustomMessage";

const STATUS_COLOR: Record<string, string> = {
  pending: "default", running: "processing", completed: "success", failed: "error",
};
const DRAFT_STATUS_COLOR: Record<string, string> = {
  PENDING: "warning", APPROVED: "success", REJECTED: "error",
};

const formatDate = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("vi-VN", { hour12: false });
};

const MeetingDetailPage: React.FC = () => {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<any>(null);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [audioPath, setAudioPath] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: MessageType; message: string } | null>(null);

  const showToast = (type: MessageType, message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = async () => {
    if (!meetingId) return;
    try {
      const [m, d] = await Promise.all([
        meetingService.getMeeting(meetingId),
        meetingService.listDrafts(meetingId),
      ]);
      setMeeting(m);
      setDrafts(Array.isArray(d) ? d : []);
      if (m?.audioPath) setAudioPath(m.audioPath);
    } catch {
      showToast("error", "Failed to load meeting");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadData(); }, [meetingId]);

  const handleExtract = async () => {
    if (!meetingId) return;
    setExtracting(true);
    try {
      const result = await meetingService.aiExtractAssignments(meetingId, audioPath || undefined);
      showToast("success", `Extracted ${result?.drafts?.length ?? 0} task draft(s)`);
      await loadData();
    } catch {
      showToast("error", "AI extraction failed");
    } finally {
      setExtracting(false);
    }
  };

  const handleApprove = async (draftId: string) => {
    setApprovingId(draftId);
    try {
      const res = await meetingService.approveDraft(draftId);
      showToast("success", `Task created: ${res?.created_task_id ?? ""}`);
      await loadData();
    } catch {
      showToast("error", "Failed to approve draft");
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Spin size="large" /></div>;
  if (!meeting) return <div className="p-6 text-center text-slate-500">Meeting not found.</div>;

  return (
    <div className="fade-in p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
        <button type="button" onClick={() => navigate("/meetings")}
          className="rounded-xl border border-slate-200 p-2 hover:bg-slate-50 transition">
          <ArrowLeftIcon className="h-5 w-5 text-slate-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{meeting.title}</h1>
            <Tag color={STATUS_COLOR[meeting.status]}>{meeting.status?.toUpperCase()}</Tag>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">{formatDate(meeting.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-5">
        {/* Meeting summary */}
        {meeting.summary && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Summary</h3>
            <p className="text-sm text-slate-600 leading-relaxed">{meeting.summary}</p>
          </div>
        )}

        {/* Transcript */}
        {meeting.transcript && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Transcript</h3>
            <pre className="text-xs text-slate-600 bg-slate-50 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">
              {meeting.transcript}
            </pre>
          </div>
        )}

        {/* AI Extract Section */}
        <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon className="h-5 w-5 text-orange-500" />
            <h3 className="text-sm font-bold text-slate-900">AI Task Extraction</h3>
          </div>

          <div className="flex gap-3 mb-4">
            <input value={audioPath} onChange={(e) => setAudioPath(e.target.value)}
              placeholder="Audio file path (e.g., /data/recordings/meeting.wav)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200" />
            <button type="button" onClick={handleExtract} disabled={extracting}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition disabled:opacity-60">
              {extracting ? (
                <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Extracting...</>
              ) : (
                <><SparklesIcon className="h-4 w-4" />Extract Tasks</>
              )}
            </button>
          </div>

          {/* Drafts */}
          {drafts.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ClipboardDocumentCheckIcon className="h-4 w-4 text-slate-500" />
                <p className="text-sm font-semibold text-slate-700">{drafts.length} draft task(s)</p>
              </div>
              {drafts.map((draft) => (
                <div key={draft.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800 text-sm">{draft.title}</p>
                      {draft.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{draft.description}</p>
                      )}
                      {draft.aiRawText && (
                        <p className="text-xs text-slate-400 mt-1 italic">"{draft.aiRawText}"</p>
                      )}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {draft.aiConfidence != null && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {Math.round(draft.aiConfidence * 100)}% confidence
                          </span>
                        )}
                        {draft.priority && (
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                            {draft.priority}
                          </span>
                        )}
                        {draft.reviewIssues?.map((issue: string) => (
                          <span key={issue} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                            {issue.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Tag color={DRAFT_STATUS_COLOR[draft.reviewStatus]}>{draft.reviewStatus}</Tag>
                      {draft.reviewStatus === "PENDING" && !draft.createdTaskId && (
                        <button type="button" onClick={() => handleApprove(draft.id)}
                          disabled={approvingId === draft.id}
                          className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition disabled:opacity-60">
                          {approvingId === draft.id ? "Approving..." : "Approve → Create Task"}
                        </button>
                      )}
                      {draft.createdTaskId && (
                        <button type="button" onClick={() => navigate(`/tasks/${draft.createdTaskId}`)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition">
                          View Task →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {drafts.length === 0 && !extracting && (
            <p className="text-sm text-slate-400 text-center py-4">
              No drafts yet. Provide an audio path and click "Extract Tasks" to run AI extraction.
            </p>
          )}
        </div>
      </div>

      {toast && <CustomMessage type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
};

export default MeetingDetailPage;
