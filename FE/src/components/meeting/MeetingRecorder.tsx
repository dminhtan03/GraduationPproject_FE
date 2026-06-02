import React, { useEffect, useRef, useState } from "react";
import { Spin, Tag } from "antd";
import {
  MicrophoneIcon, StopIcon, ArrowUpTrayIcon,
  DocumentTextIcon, CheckCircleIcon, ClipboardDocumentListIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { meetingService } from "../../services/meetingService";
import { taskService } from "../../services/taskService";
import { projectService } from "../../services/projectService";
import AnimatedDropdown from "../common/AnimatedDropdown";

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
  hasAudio?: boolean;
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

  // Audio file for playback + download after recording/import
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Project / sprint selector for task assignment
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [projectSprints, setProjectSprints] = useState<any[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(undefined);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load projects for task assignment selector
  useEffect(() => {
    projectService.listProjects().then(setProjects).catch(() => {});
  }, []);

  // Load sprints of selected project
  useEffect(() => {
    if (!selectedProjectId) { setProjectSprints([]); setSelectedSprintId(undefined); return; }
    taskService.listSprints()
      .then((all: any[]) => setProjectSprints(all.filter((s: any) => s.projectId === selectedProjectId)))
      .catch(() => {});
    setSelectedSprintId(undefined);
  }, [selectedProjectId]);

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

  // Load audio từ BE khi có meetingId và hasAudio (meeting load từ DB)
  useEffect(() => {
    if (!initialData?.meetingId || !initialData?.hasAudio || audioUrl) return;
    meetingService.getAudioBlob(initialData.meetingId).then((res) => {
      if (res) {
        setAudioBlob(res.blob);
        setAudioUrl(res.url);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialData?.meetingId, initialData?.hasAudio]);

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
      setErrorMsg("Cannot access microphone. Please grant permission.");
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
    // Save audio for playback/download — revoke previous URL first
    setAudioBlob(audio);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(audio));
    try {
      const data = await meetingService.processRecording(audio, reservationId, meetingTitle, setUploadPct);
      setResult(data);
      setCreatedTasks(new Set());
      setPhase("done");
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.meta?.message || e?.message || "Processing failed");
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
        sprintId: selectedSprintId,
        projectId: selectedProjectId,
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
      // Link draft to the created task (pass taskId so backend doesn't create a duplicate)
      if (task.draftId) {
        try { await meetingService.approveDraft(task.draftId, created?.id); } catch { /* non-fatal */ }
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
      <p className="text-lg font-semibold text-slate-900 mb-1">Meeting Recorder</p>
      <p className="text-sm text-slate-500 mb-4">
        Record or import an audio file to get AI summaries and task extraction.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={startRecording}
          className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition shadow-sm">
          <MicrophoneIcon className="h-4 w-4" /> Start Recording
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
              <p className="text-sm font-semibold text-red-700">Recording… {fmtElapsed(elapsed)}</p>
              <p className="text-xs text-red-400 mt-0.5">Max 15:00 — auto stops</p>
            </div>
        </div>
        <button type="button" onClick={stopRecording}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
          <StopIcon className="h-4 w-4" /> Stop
        </button>
      </div>
    </div>
  );

  // ── processing ────────────────────────────────────────────────────────────
  if (phase === "processing") return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center py-10">
      <Spin size="large" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        {uploadPct < 100 ? `Uploading… ${uploadPct}%` : "AI is processing meeting..."}
      </p>
      <p className="text-xs text-slate-400 mt-1">This process may take a few minutes for long audio files.</p>
    </div>
  );

  // ── error ─────────────────────────────────────────────────────────────────
  if (phase === "error") return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <p className="text-sm font-semibold text-red-700 mb-2">Processing Failed</p>
      <p className="text-xs text-red-500 mb-3">{errorMsg}</p>
      <button type="button" onClick={() => setPhase("idle")}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        Try Again
      </button>
    </div>
  );

  // ── done — hiển thị kết quả (cả từ DB và từ lần ghi mới) ─────────────────
  const hasTasks = !!(result?.tasks && result.tasks.length > 0);

  const projectOptions = [
    { value: "", label: "Select Project..." },
    ...projects.map((p: any) => ({ value: p.id, label: p.name })),
  ];

  const sprintOptions = [
    { value: "", label: "Select Sprint..." },
    ...projectSprints.map((s: any) => ({ value: s.id, label: s.name })),
  ];

  return (
    <div className="space-y-5">
      {/* Header với nút ghi lại */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div>
          <p className="text-lg font-bold text-slate-900">Meeting Minutes</p>
          {meetingTitle && <p className="text-xs font-semibold text-slate-400 mt-0.5">{meetingTitle}</p>}
        </div>
        <button type="button"
          onClick={() => {
            setPhase("idle"); setResult(null); setCreatedTasks(new Set());
            setAudioBlob(null);
            if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition shadow-sm">
          <ArrowPathIcon className="h-3.5 w-3.5" /> Record Again
        </button>
      </div>

      {/* Audio player + download — full width, ngay dưới tiêu đề */}
      {audioUrl && audioBlob && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition duration-200">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <MicrophoneIcon className="h-4 w-4 text-orange-500" />
              Meeting Recording
            </p>
            <a
              href={audioUrl}
              download={`meeting-recording-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}${audioBlob.type.includes("ogg") ? ".ogg" : ".webm"}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
            >
              <ArrowUpTrayIcon className="h-3.5 w-3.5 rotate-180" /> Download
            </a>
          </div>
          <audio
            controls
            src={audioUrl}
            className="w-full h-10 bg-slate-50 rounded-xl"
            style={{ borderRadius: "12px" }}
          />
        </div>
      )}

      <div className={hasTasks ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "space-y-5 max-w-4xl"}>
        {/* Left Section (Tóm tắt) */}
        <div className={hasTasks ? "lg:col-span-7 space-y-5" : "space-y-5"}>
          {/* Tóm tắt cuộc họp */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm hover:shadow-md transition duration-200">
            <div className="flex items-center gap-2 mb-3.5">
              <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-bold text-emerald-800">Meeting Summary</p>
            </div>
            {result?.summary ? (
              <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap font-medium">{result.summary}</p>
            ) : (
              <p className="text-sm text-slate-400 italic font-medium">No summary available.</p>
            )}
          </div>
        </div>

        {/* Right Section (Extracted Tasks) */}
        {hasTasks && (
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4 hover:shadow-md transition duration-200">
            <div className="flex items-center gap-2 pb-1.5 border-b border-slate-100">
              <ClipboardDocumentListIcon className="h-5 w-5 text-orange-500" />
              <p className="text-sm font-bold text-slate-800">
                AI Extracted Tasks ({result!.tasks.length})
              </p>
            </div>

            {/* Project + Sprint Selector */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-100 space-y-3.5">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Task Settings
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Project</span>
                  <AnimatedDropdown
                    value={selectedProjectId || ""}
                    onChange={(v) => setSelectedProjectId(v || undefined)}
                    options={projectOptions}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sprint</span>
                  <AnimatedDropdown
                    value={selectedSprintId || ""}
                    onChange={(v) => setSelectedSprintId(v || undefined)}
                    options={sprintOptions}
                    disabled={!selectedProjectId || projectSprints.length === 0}
                    className="w-full"
                  />
                </div>
              </div>
              {selectedProjectId && projectSprints.length === 0 && (
                <p className="text-[11px] text-slate-400 font-medium">This project has no active sprints.</p>
              )}
            </div>

            {/* Extracted Task List */}
            <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1 scrollbar-thin">
              {result!.tasks.map((task, idx) => {
                const key = taskKey(task, idx);
                const isDone = createdTasks.has(key);
                const isCreating = creatingKey === key;
                return (
                  <div key={key}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3.5 hover:bg-slate-50 hover:border-slate-200/60 transition duration-150">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {task.priority && (
                          <Tag color={PRIORITY_COLOR[task.priority?.toUpperCase()] ?? "default"} className="m-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md border-0">
                            {task.priority}
                          </Tag>
                        )}
                        {task.dueAt && (
                          <span className="text-[11px] font-semibold text-slate-400">Due: {fmt(task.dueAt)}</span>
                        )}
                        {task.aiConfidence != null && (
                          <span className="text-[11px] font-semibold text-slate-400">
                            {Math.round(task.aiConfidence * 100)}% confidence
                          </span>
                        )}
                      </div>
                    </div>
                    <button type="button" disabled={isDone || isCreating}
                      onClick={() => createTask(task, idx)}
                      className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition shadow-sm
                        disabled:opacity-60 disabled:cursor-not-allowed
                        enabled:bg-orange-500 enabled:text-white enabled:hover:bg-orange-600
                        disabled:bg-slate-100 disabled:text-slate-500">
                      {isDone ? <><CheckCircleIcon className="h-3.5 w-3.5 text-emerald-500" /> Added</>
                        : isCreating ? "Adding..."
                        : "Add Task"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingRecorder;
