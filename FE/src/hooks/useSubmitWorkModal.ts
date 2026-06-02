import { useState, useCallback, useEffect } from "react";
import { taskService } from "../services/taskService";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttachedFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface RelatedLink {
  id: string;
  url: string;
}

export type ModalPhase = "idle" | "submitting" | "success" | "error";

export interface SubmitWorkFormState {
  summary: string;
  files: AttachedFile[];
  links: RelatedLink[];
}

export interface SubmitWorkModalState {
  form: SubmitWorkFormState;
  phase: ModalPhase;
  errorMessage: string;
  isDragging: boolean;
  charCount: number;
}

export interface UseSubmitWorkModalReturn {
  state: SubmitWorkModalState;
  // Summary
  setSummary: (value: string) => void;
  // Files
  addFiles: (files: FileList | File[]) => void;
  removeFile: (id: string) => void;
  setDragging: (dragging: boolean) => void;
  // Links
  addLink: () => void;
  updateLink: (id: string, url: string) => void;
  removeLink: (id: string) => void;
  // Actions
  submit: (taskId: string) => Promise<boolean>;
  reset: () => void;
  // Validation
  isValid: boolean;
  canSubmit: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CHARS = 2000;
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
];

const ALLOWED_EXTENSIONS = [
  ".pdf", ".docx", ".doc", ".xlsx", ".xls",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

let _idCounter = 0;
const genId = () => `swm_${Date.now()}_${++_idCounter}`;

const isAllowedFile = (file: File): boolean => {
  if (ALLOWED_TYPES.includes(file.type)) return true;
  const ext = "." + file.name.split(".").pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

// ── Hook ──────────────────────────────────────────────────────────────────────

const initialForm: SubmitWorkFormState = {
  summary: "",
  files: [],
  links: [],
};

export function useSubmitWorkModal(): UseSubmitWorkModalReturn {
  const [form, setForm] = useState<SubmitWorkFormState>({ ...initialForm });
  const [phase, setPhase] = useState<ModalPhase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // ── Summary ─────────────────────────────────────────────────────────────

  const setSummary = useCallback((value: string) => {
    if (value.length <= MAX_CHARS) {
      setForm((prev) => ({ ...prev, summary: value }));
    }
  }, []);

  // ── Files (local only — no Cloudinary upload) ───────────────────────────
  // Backend submitForReview only accepts { resultNote: string }.
  // We store file metadata locally and embed file names into the resultNote.

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      for (const file of fileArray) {
        if (!isAllowedFile(file)) {
          setErrorMessage(`"${file.name}" is not a supported file type.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          setErrorMessage(`"${file.name}" exceeds the 20MB size limit.`);
          continue;
        }

        setForm((prev) => {
          if (prev.files.length >= MAX_FILES) {
            setErrorMessage(`Maximum ${MAX_FILES} files allowed.`);
            return prev;
          }
          // Prevent duplicate by file name
          if (prev.files.some((f) => f.name === file.name)) {
            return prev;
          }
          return {
            ...prev,
            files: [
              ...prev.files,
              {
                id: genId(),
                name: file.name,
                size: file.size,
                type: file.type,
              },
            ],
          };
        });
      }
    },
    []
  );

  const removeFile = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      files: prev.files.filter((f) => f.id !== id),
    }));
  }, []);

  const setDragging = useCallback((dragging: boolean) => {
    setIsDragging(dragging);
  }, []);

  // ── Links ───────────────────────────────────────────────────────────────

  const addLink = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      links: [...prev.links, { id: genId(), url: "" }],
    }));
  }, []);

  const updateLink = useCallback((id: string, url: string) => {
    setForm((prev) => ({
      ...prev,
      links: prev.links.map((l) => (l.id === id ? { ...l, url } : l)),
    }));
  }, []);

  const removeLink = useCallback((id: string) => {
    setForm((prev) => ({
      ...prev,
      links: prev.links.filter((l) => l.id !== id),
    }));
  }, []);

  // ── Validation ──────────────────────────────────────────────────────────

  const isValid = form.summary.trim().length > 0;
  const canSubmit = isValid && phase === "idle";

  // ── Submit ──────────────────────────────────────────────────────────────

  const submit = useCallback(
    async (taskId: string): Promise<boolean> => {
      if (!canSubmit) return false;

      setPhase("submitting");
      setErrorMessage("");

      try {
        // Build the full resultNote string
        // Backend only stores this as a single text field
        const sections: string[] = [form.summary.trim()];

        // Append file references as text
        if (form.files.length > 0) {
          const fileParts = form.files
            .map((f) => `📎 ${f.name} (${formatFileSize(f.size)})`)
            .join("\n");
          sections.push(fileParts);
        }

        // Append links
        const validLinks = form.links.filter((l) => l.url.trim());
        if (validLinks.length > 0) {
          const linkParts = validLinks
            .map((l) => `🔗 ${l.url.trim()}`)
            .join("\n");
          sections.push(linkParts);
        }

        const fullNote = sections.join("\n\n");

        await taskService.submitForReview(taskId, fullNote);
        setPhase("success");
        return true;
      } catch (e: any) {
        setPhase("error");
        setErrorMessage(
          e?.response?.data?.meta?.message || "Submission failed. Please try again."
        );
        return false;
      }
    },
    [canSubmit, form]
  );

  // ── Reset ───────────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    setForm({ ...initialForm });
    setPhase("idle");
    setErrorMessage("");
    setIsDragging(false);
  }, []);

  // Clear error after timeout
  useEffect(() => {
    if (errorMessage) {
      const t = setTimeout(() => setErrorMessage(""), 5000);
      return () => clearTimeout(t);
    }
  }, [errorMessage]);

  return {
    state: {
      form,
      phase,
      errorMessage,
      isDragging,
      charCount: form.summary.length,
    },
    setSummary,
    addFiles,
    removeFile,
    setDragging,
    addLink,
    updateLink,
    removeLink,
    submit,
    reset,
    isValid,
    canSubmit,
  };
}
