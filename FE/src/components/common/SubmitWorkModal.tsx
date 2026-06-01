import React, { useEffect, useRef, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardDocumentCheckIcon,
  XMarkIcon,
  PaperClipIcon,
  LinkIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  PhotoIcon,
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import type {
  UseSubmitWorkModalReturn,
  AttachedFile,
  RelatedLink,
} from "../../hooks/useSubmitWorkModal";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SubmitWorkModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  taskId: string;
  hook: UseSubmitWorkModalReturn;
}

// ── Backdrop animation ────────────────────────────────────────────────────────

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring", damping: 30, stiffness: 400 },
  },
  exit: { opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.15 } },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getFileIcon = (type: string) => {
  if (type.startsWith("image/"))
    return <PhotoIcon className="h-5 w-5 text-violet-500" />;
  return <DocumentIcon className="h-5 w-5 text-blue-500" />;
};

const isValidUrl = (str: string): boolean => {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const SubmitWorkModal: React.FC<SubmitWorkModalProps> = ({
  open,
  onClose,
  onSubmitted,
  taskId,
  hook,
}) => {
  const {
    state,
    setSummary,
    addFiles,
    removeFile,
    setDragging,
    addLink,
    updateLink,
    removeLink,
    submit,
    reset,
    canSubmit,
  } = hook;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Keyboard: Escape ──────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && state.phase !== "submitting") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, state.phase]);

  // ── Auto-resize textarea ──────────────────────────────────────────────

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(120, Math.min(el.scrollHeight, 280)) + "px";
  }, [state.form.summary]);

  // ── Focus trap on open ────────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 200);
    }
  }, [open]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    if (state.phase === "submitting") return;
    reset();
    onClose();
  }, [state.phase, reset, onClose]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && state.phase !== "submitting") {
        handleClose();
      }
    },
    [state.phase, handleClose]
  );

  const handleSubmit = useCallback(async () => {
    const ok = await submit(taskId);
    if (ok) {
      setTimeout(() => {
        onSubmitted();
        reset();
        onClose();
      }, 1500);
    }
  }, [submit, taskId, onSubmitted, reset, onClose]);

  // ── Drag & Drop ───────────────────────────────────────────────────────

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
    },
    [setDragging]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
    },
    [setDragging]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [setDragging, addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files);
      }
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [addFiles]
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-work-title"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-[700px] max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Success Overlay ──────────────────────────────────────── */}
            <AnimatePresence>
              {state.phase === "success" && (
                <motion.div
                  className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      damping: 15,
                      stiffness: 200,
                    }}
                  >
                    <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
                      <CheckCircleIcon className="h-10 w-10 text-emerald-500" />
                    </div>
                  </motion.div>
                  <motion.p
                    className="text-lg font-bold text-slate-800"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                  >
                    Submitted Successfully!
                  </motion.p>
                  <motion.p
                    className="text-sm text-slate-500 mt-1"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    Your work results are now under review.
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3.5">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2
                    id="submit-work-title"
                    className="text-base font-bold text-slate-800 leading-tight"
                  >
                    Submit Work Results
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5 leading-snug">
                    Provide deliverables, outcomes, and supporting materials for
                    review.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={state.phase === "submitting"}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150 disabled:opacity-50 -mt-0.5 -mr-1"
                aria-label="Close modal"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* ── Scrollable Content ──────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin">
              {/* Error Banner */}
              <AnimatePresence>
                {state.errorMessage && (
                  <motion.div
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 shrink-0" />
                    <span className="flex-1">{state.errorMessage}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Work Summary ──────────────────────────────────────── */}
              <section>
                <label
                  htmlFor="work-summary"
                  className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2"
                >
                  <span className="w-1 h-4 rounded-full bg-blue-500" />
                  Work Summary
                </label>
                <div className="relative group">
                  <textarea
                    ref={textareaRef}
                    id="work-summary"
                    value={state.form.summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Describe completed work, deliverables, achievements, links, blockers resolved, and important notes..."
                    className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-700 leading-relaxed placeholder:text-slate-400 resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white hover:border-slate-300"
                    disabled={state.phase !== "idle"}
                    aria-describedby="char-counter"
                  />
                  <div
                    id="char-counter"
                    className={`absolute bottom-3 right-3 text-[11px] font-medium tabular-nums transition-colors ${
                      state.charCount > 1800
                        ? "text-amber-500"
                        : state.charCount > 1950
                          ? "text-red-500"
                          : "text-slate-300"
                    }`}
                  >
                    {state.charCount} / 2,000
                  </div>
                </div>
              </section>

              {/* ── Attachments ───────────────────────────────────────── */}
              <section>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  <span className="w-1 h-4 rounded-full bg-violet-500" />
                  Attachments
                  <span className="text-slate-400 font-medium normal-case tracking-normal ml-1">
                    (optional)
                  </span>
                </label>

                {/* Drop zone */}
                <div
                  className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer group ${
                    state.isDragging
                      ? "border-blue-400 bg-blue-50/50 scale-[1.01]"
                      : "border-slate-200 bg-slate-50/40 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload files by clicking or dragging"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.gif,.webp,.svg"
                    onChange={handleFileSelect}
                    className="hidden"
                    aria-hidden="true"
                  />
                  <div className="flex flex-col items-center justify-center py-8 px-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 transition-all duration-200 ${
                        state.isDragging
                          ? "bg-blue-100 scale-110"
                          : "bg-slate-100 group-hover:bg-slate-200/70"
                      }`}
                    >
                      <CloudArrowUpIcon
                        className={`h-6 w-6 transition-colors ${
                          state.isDragging
                            ? "text-blue-500"
                            : "text-slate-400 group-hover:text-slate-500"
                        }`}
                      />
                    </div>
                    <p className="text-sm font-semibold text-slate-600 mb-0.5">
                      {state.isDragging
                        ? "Drop files here"
                        : "Drag & drop files or click to browse"}
                    </p>
                    <p className="text-xs text-slate-400">
                      PDF, DOCX, XLSX, Images • Max 20MB per file
                    </p>
                  </div>
                </div>

                {/* Uploaded files list */}
                <AnimatePresence>
                  {state.form.files.length > 0 && (
                    <motion.div
                      className="mt-3 space-y-2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {state.form.files.map((file) => (
                        <FileCard
                          key={file.id}
                          file={file}
                          onRemove={removeFile}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </section>

              {/* ── Related Links ─────────────────────────────────────── */}
              <section>
                <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  <span className="w-1 h-4 rounded-full bg-emerald-500" />
                  Related Links
                  <span className="text-slate-400 font-medium normal-case tracking-normal ml-1">
                    (optional)
                  </span>
                </label>

                <div className="space-y-2">
                  <AnimatePresence>
                    {state.form.links.map((link) => (
                      <LinkRow
                        key={link.id}
                        link={link}
                        onUpdate={updateLink}
                        onRemove={removeLink}
                        disabled={state.phase !== "idle"}
                      />
                    ))}
                  </AnimatePresence>

                  <button
                    type="button"
                    onClick={addLink}
                    disabled={state.phase !== "idle"}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Add Link
                  </button>
                </div>
              </section>
            </div>

            {/* ── Footer ──────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs">
                <PaperClipIcon className="h-3.5 w-3.5 inline-block mr-1 -mt-0.5 text-slate-300" />
                Files will be shared with reviewers and task owners.
              </p>
              <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={state.phase === "submitting"}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all duration-150 disabled:opacity-50 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className={`relative px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 shadow-sm disabled:cursor-not-allowed overflow-hidden ${
                    canSubmit
                      ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-md hover:shadow-blue-500/25 active:scale-[0.98]"
                      : "bg-slate-200 text-slate-400"
                  }`}
                >
                  {state.phase === "submitting" ? (
                    <span className="flex items-center gap-2">
                      <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      Submitting...
                    </span>
                  ) : state.phase === "error" ? (
                    <span className="flex items-center gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      Retry Submit
                    </span>
                  ) : (
                    "Submit Results"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── FileCard ──────────────────────────────────────────────────────────────────

const FileCard: React.FC<{
  file: AttachedFile;
  onRemove: (id: string) => void;
}> = ({ file, onRemove }) => (
  <motion.div
    className="group flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all duration-200"
    initial={{ opacity: 0, y: -8, height: 0 }}
    animate={{ opacity: 1, y: 0, height: "auto" }}
    exit={{ opacity: 0, x: -20, height: 0 }}
    transition={{ duration: 0.2 }}
    layout
  >
    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-slate-50 border border-slate-100 shrink-0">
      {getFileIcon(file.type)}
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-slate-700 truncate leading-tight">
        {file.name}
      </p>
      <p className="text-[11px] text-slate-400 mt-0.5">
        {formatFileSize(file.size)}
      </p>
    </div>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove(file.id);
      }}
      className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150 opacity-0 group-hover:opacity-100"
      aria-label={`Remove ${file.name}`}
    >
      <TrashIcon className="h-4 w-4" />
    </button>
  </motion.div>
);

// ── LinkRow ───────────────────────────────────────────────────────────────────

const LinkRow: React.FC<{
  link: RelatedLink;
  onUpdate: (id: string, url: string) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}> = ({ link, onUpdate, onRemove, disabled }) => {
  const hasValue = link.url.trim().length > 0;
  const valid = !hasValue || isValidUrl(link.url.trim());

  return (
    <motion.div
      className="flex items-center gap-2"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, height: 0 }}
      layout
    >
      <div className="relative flex-1 group">
        <LinkIcon
          className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
            hasValue && valid
              ? "text-blue-400"
              : hasValue && !valid
                ? "text-red-400"
                : "text-slate-300"
          }`}
        />
        <input
          type="url"
          value={link.url}
          onChange={(e) => onUpdate(link.id, e.target.value)}
          placeholder="https://github.com/company/project"
          disabled={disabled}
          className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm transition-all duration-200 focus:outline-none focus:ring-2 disabled:opacity-50 ${
            hasValue && !valid
              ? "border-red-300 focus:ring-red-500/20 focus:border-red-400 bg-red-50/30"
              : "border-slate-200 focus:ring-blue-500/20 focus:border-blue-400 bg-slate-50/40 hover:border-slate-300"
          }`}
          aria-label="Related link URL"
          aria-invalid={hasValue && !valid}
        />
      </div>
      <button
        type="button"
        onClick={() => onRemove(link.id)}
        disabled={disabled}
        className="flex items-center justify-center w-9 h-9 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150 shrink-0 disabled:opacity-50"
        aria-label="Remove link"
      >
        <TrashIcon className="h-4 w-4" />
      </button>
    </motion.div>
  );
};

export default SubmitWorkModal;
