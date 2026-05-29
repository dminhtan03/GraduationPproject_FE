import React, { useEffect, useRef, useState } from "react";
import { Spin, Tag } from "antd";
import {
  MicrophoneIcon, StopIcon, ArrowUpTrayIcon,
  DocumentTextIcon, CheckCircleIcon, ClipboardDocumentListIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { meetingService } from "../../services/meetingService";
import { taskService } from "../../services/taskService";

interface TaskInfo {
  draftId?: string;
  title: string;
  description?: string;
  priority?: string;
  dueAt?: string;
  aiConfidence?: number;
  createdTaskId?: string | null;
}

interface MeetingResult {
  meetingId: string;
  summary: string;
  transcript: string;
  tasks: TaskInfo[];
}

interface Props {
  reservationId: string;
  meetingTitle?: string;
  /** Dữ liệu đã có sẵn từ lần trước (load từ DB khi mở trang) */
  initialData?: MeetingResult | null;
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "default", MEDIUM: "blue", HIGH: "orange", URGENT: "red",
};

const fmt = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("vi-VN");
};

const MeetingRecorder: React.FC<Props> = ({ reservationId, meetingTitle, initialData }) => {
  const [phase, setPhase] = useState<"idle" | "recording" | "processing" | "done" | "error">(
    initialData ? "done" : "idle"
  );
  const [elapsed, setElapsed] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [result, setResult] = useState<MeetingResult | null>(initialData ?? null);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdTasks, setCreatedTasks] = useState<Set<string>>(() => {
    // Các task đã được tạo từ trước (draftId có createdTaskId)
    const done = new Set<string>();
    initialData?.tasks?.forEach((t, i) => {
      if (t.createdTaskId) done.add(t.draftId ?? String(i));
    });
    return done;
  });
  const [creatingKey, setCreatingKey] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // Auto-stop at 15 minutes
  useEffect(() => {
    if (phase === "recording" && elapsed >= 900) stopRecording();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, phase]);

  // Cập nhật khi initialData thay đổi (load lần đầu)
  useEffect(() => {
    if (initialData && phase === "idle") {
      setResult(initialData);
      setPhase("done");
      const done = new Set<string>();
      initialData.tasks?.forEach((t, i) => {
        if (t.createdTaskId) done.add(t.draftId ?? String(i));
      });
      setCreatedTasks(done);
    }
  }, [initialData]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const opts = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? { mimeType: "audio/ogg;codecs=opus" }
        : {};
      const recorder = new MediaRecorder(stream, opts);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.start(1000);
      recorderRef.current = recorder;
      setPhase("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setErrorMsg("Không thể truy cập microphone. Vui lòng cấp quyền.");
      setPhase("error");
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorder.onstop = () => {
      recorder.stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      processAudio(blob);
    };
    recorder.stop();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAudio(file);
    e.target.value = "";
  };

  const processAudio = async (audio: Blob) => {
    setPhase("processing");
    setUploadPct(0);
    setErrorMsg("");
    try {
      const data = await meetingService.processRecording(audio, reservationId, meetingTitle, setUploadPct);
      setResult(data);
      setCreatedTasks(new Set());
      setPhase("done");
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.meta?.message || e?.message || "Xử lý thất bại");
      setPhase("error");
    }
  };

  const taskKey = (task: TaskInfo, idx: number) => task.draftId ?? String(idx);

  const createTask = async (task: TaskInfo, idx: number) => {
    const key = taskKey(task, idx);
    setCreatingKey(key);
    try {
      const created = await taskService.createTask({
        title: task.title,
        description: task.description,
        priority: task.priority ?? "MEDIUM",
        dueAt: task.dueAt,
        meetingId: result?.meetingId,
      });
      // Lưu taskId vào localStorage để TaskList highlight
      if (created?.id) {
        try {
          const stored = localStorage.getItem("new_tasks_from_ai");
          const existing: string[] = stored ? JSON.parse(stored) : [];
          existing.push(created.id);
          localStorage.setItem("new_tasks_from_ai", JSON.stringify(existing));
        } catch { /* non-fatal */ }
      }
      // Nếu có draftId, approve draft để liên kết task
      if (task.draftId) {
        try { await meetingService.approveDraft(task.draftId); } catch { /* non-fatal */ }
      }
      setCreatedTasks((prev) => new Set(prev).add(key));
    } catch { /* ignore */ }
    finally { setCreatingKey(null); }
  };

  const fmtElapsed = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── idle ──────────────────────────────────────────────────────────────────
  if (phase === "idle") return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-lg font-semibold text-slate-900 mb-1">Ghi âm cuộc họp</p>
      <p className="text-sm text-slate-500 mb-4">
        Ghi âm hoặc import file audio để nhận tóm tắt và trích xuất nhiệm vụ bằng AI.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={startRecording}
          className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition shadow-sm">
          <MicrophoneIcon className="h-4 w-4" /> Bắt đầu ghi âm
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
          <ArrowUpTrayIcon className="h-4 w-4" /> Import Audio
        </button>
        <input ref={fileInputRef} type="file" accept="audio/*,.webm,.ogg,.mp3,.wav,.m4a"
          className="hidden" onChange={handleImport} />
      </div>
    </div>
  );

  // ── recording ─────────────────────────────────────────────────────────────
  if (phase === "recording") return (
    <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <div>
              <p className="text-sm font-semibold text-red-700">Đang ghi âm… {fmtElapsed(elapsed)}</p>
              <p className="text-xs text-red-400 mt-0.5">Tối đa 15:00 — tự động dừng</p>
            </div>
        </div>
        <button type="button" onClick={stopRecording}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
          <StopIcon className="h-4 w-4" /> Kết thúc
        </button>
      </div>
    </div>
  );

  // ── processing ────────────────────────────────────────────────────────────
  if (phase === "processing") return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center py-10">
      <Spin size="large" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        {uploadPct < 100 ? `Đang upload… ${uploadPct}%` : "AI đang xử lý cuộc họp…"}
      </p>
      <p className="text-xs text-slate-400 mt-1">Quá trình này có thể mất vài phút với audio dài.</p>
    </div>
  );

  // ── error ─────────────────────────────────────────────────────────────────
  if (phase === "error") return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <p className="text-sm font-semibold text-red-700 mb-2">Xử lý thất bại</p>
      <p className="text-xs text-red-500 mb-3">{errorMsg}</p>
      <button type="button" onClick={() => setPhase("idle")}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        Thử lại
      </button>
    </div>
  );

  // ── done — hiển thị kết quả (cả từ DB và từ lần ghi mới) ─────────────────
  return (
    <div className="space-y-4">
      {/* Header với nút ghi lại */}
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold text-slate-900">Biên bản cuộc họp</p>
        <button type="button"
          onClick={() => { setPhase("idle"); setResult(null); setCreatedTasks(new Set()); }}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition">
          <ArrowPathIcon className="h-3.5 w-3.5" /> Ghi âm lại
        </button>
      </div>

      {/* Tóm tắt */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800">Tóm tắt cuộc họp</p>
        </div>
        {result?.summary ? (
          <p className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">{result.summary}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">Chưa có tóm tắt.</p>
        )}
      </div>

      {/* Nhiệm vụ trích xuất */}
      {result?.tasks && result.tasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardDocumentListIcon className="h-5 w-5 text-orange-500" />
            <p className="text-sm font-semibold text-slate-800">
              Nhiệm vụ được trích xuất ({result.tasks.length})
            </p>
          </div>
          <div className="space-y-2">
            {result.tasks.map((task, idx) => {
              const key = taskKey(task, idx);
              const isDone = createdTasks.has(key);
              const isCreating = creatingKey === key;
              return (
                <div key={key}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {task.priority && (
                        <Tag color={PRIORITY_COLOR[task.priority?.toUpperCase()] ?? "default"} className="text-xs">
                          {task.priority}
                        </Tag>
                      )}
                      {task.dueAt && (
                        <span className="text-xs text-slate-400">Hạn: {fmt(task.dueAt)}</span>
                      )}
                      {task.aiConfidence != null && (
                        <span className="text-xs text-slate-400">
                          {Math.round(task.aiConfidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" disabled={isDone || isCreating}
                    onClick={() => createTask(task, idx)}
                    className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition
                      disabled:opacity-60 disabled:cursor-not-allowed
                      enabled:bg-orange-500 enabled:text-white enabled:hover:bg-orange-600
                      disabled:bg-slate-100 disabled:text-slate-500">
                    {isDone ? <><CheckCircleIcon className="h-3.5 w-3.5" /> Đã thêm</>
                      : isCreating ? "Đang thêm…"
                      : "Thêm Task"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetingRecorder;
