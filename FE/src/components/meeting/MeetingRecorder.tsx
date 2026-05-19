import React, { useEffect, useRef, useState } from "react";
import { Spin, Tag } from "antd";
import {
  MicrophoneIcon, StopIcon, ArrowUpTrayIcon,
  DocumentTextIcon, CheckCircleIcon, ClipboardDocumentListIcon,
} from "@heroicons/react/24/outline";
import { meetingService } from "../../services/meetingService";
import { taskService } from "../../services/taskService";

interface ExtractedTask {
  title: string;
  description?: string;
  priority?: string;
  dueAt?: string;
  aiConfidence?: number;
}

interface MeetingResult {
  meetingId: string;
  summary: string;
  transcript: string;
  tasks: ExtractedTask[];
}

interface Props {
  reservationId: string;
  meetingTitle?: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: "default", MEDIUM: "blue", HIGH: "orange", URGENT: "red",
};

const fmt = (v?: string) => {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("vi-VN");
};

const MeetingRecorder: React.FC<Props> = ({ reservationId, meetingTitle }) => {
  const [phase, setPhase] = useState<"idle" | "recording" | "processing" | "done" | "error">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [result, setResult] = useState<MeetingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdTaskIds, setCreatedTaskIds] = useState<Set<number>>(new Set());
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => clearInterval(timerRef.current), []);

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
      setErrorMsg("Cannot access microphone. Please allow microphone permission.");
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
  };

  const processAudio = async (audio: Blob) => {
    setPhase("processing");
    setUploadPct(0);
    setErrorMsg("");
    try {
      const data = await meetingService.processRecording(
        audio,
        reservationId,
        meetingTitle,
        setUploadPct,
      );
      setResult(data);
      setPhase("done");
    } catch (e: any) {
      setErrorMsg(e?.response?.data?.meta?.message || e?.message || "Processing failed");
      setPhase("error");
    }
  };

  const createTask = async (task: ExtractedTask, idx: number) => {
    setCreatingIdx(idx);
    try {
      await taskService.createTask({
        title: task.title,
        description: task.description,
        priority: task.priority ?? "MEDIUM",
        dueAt: task.dueAt,
        meetingId: result?.meetingId,
      });
      setCreatedTaskIds((prev) => new Set(prev).add(idx));
    } catch { /* ignore */ }
    finally { setCreatingIdx(null); }
  };

  const fmtElapsed = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── idle ──────────────────────────────────────────────────────────────────
  if (phase === "idle") return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-lg font-semibold text-slate-900 mb-1">Meeting Recording</p>
      <p className="text-sm text-slate-500 mb-4">Record or import audio to get AI-powered meeting summary and task extraction.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={startRecording}
          className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 transition shadow-sm">
          <MicrophoneIcon className="h-4 w-4" />
          Start Recording
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
          <ArrowUpTrayIcon className="h-4 w-4" />
          Import Audio
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
          <p className="text-sm font-semibold text-red-700">Recording… {fmtElapsed(elapsed)}</p>
        </div>
        <button type="button" onClick={stopRecording}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
          <StopIcon className="h-4 w-4" />
          End Recording
        </button>
      </div>
    </div>
  );

  // ── processing ────────────────────────────────────────────────────────────
  if (phase === "processing") return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-center">
      <Spin size="large" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        {uploadPct < 100 ? `Uploading… ${uploadPct}%` : "AI is processing the meeting…"}
      </p>
      <p className="text-xs text-slate-400 mt-1">This may take a minute for longer recordings.</p>
    </div>
  );

  // ── error ─────────────────────────────────────────────────────────────────
  if (phase === "error") return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
      <p className="text-sm font-semibold text-red-700 mb-2">Processing failed</p>
      <p className="text-xs text-red-500 mb-3">{errorMsg}</p>
      <button type="button" onClick={() => setPhase("idle")}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
        Try again
      </button>
    </div>
  );

  // ── done ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <DocumentTextIcon className="h-5 w-5 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800">Meeting Summary</p>
        </div>
        {result?.summary ? (
          <p className="text-sm text-slate-700 leading-6 whitespace-pre-wrap">{result.summary}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">No summary generated.</p>
        )}
        {result?.transcript && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-emerald-600 hover:underline">
              Show transcript
            </summary>
            <p className="mt-2 text-xs text-slate-600 leading-5 whitespace-pre-wrap max-h-48 overflow-y-auto">
              {result.transcript}
            </p>
          </details>
        )}
      </div>

      {/* Extracted tasks */}
      {result?.tasks && result.tasks.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardDocumentListIcon className="h-5 w-5 text-orange-500" />
            <p className="text-sm font-semibold text-slate-800">
              Extracted Tasks ({result.tasks.length})
            </p>
          </div>
          <div className="space-y-2">
            {result.tasks.map((task, idx) => (
              <div key={idx}
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
                      <span className="text-xs text-slate-400">Due {fmt(task.dueAt)}</span>
                    )}
                    {task.aiConfidence != null && (
                      <span className="text-xs text-slate-400">
                        {Math.round(task.aiConfidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={createdTaskIds.has(idx) || creatingIdx === idx}
                  onClick={() => createTask(task, idx)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition
                    disabled:opacity-60
                    enabled:bg-orange-500 enabled:text-white enabled:hover:bg-orange-600
                    disabled:bg-slate-100 disabled:text-slate-500">
                  {createdTaskIds.has(idx) ? (
                    <><CheckCircleIcon className="h-3.5 w-3.5" /> Added</>
                  ) : creatingIdx === idx ? (
                    "Adding…"
                  ) : (
                    "Add Task"
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button type="button" onClick={() => { setPhase("idle"); setResult(null); setCreatedTaskIds(new Set()); }}
        className="text-xs text-slate-400 hover:text-slate-600 underline">
        Record or import another
      </button>
    </div>
  );
};

export default MeetingRecorder;
