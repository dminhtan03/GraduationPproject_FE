import React from "react";
import { XMarkIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (e: React.FormEvent) => void;
  importFile: File | null;
  setImportFile: (file: File | null) => void;
  title: string;
  description: string;
  structureInfo: string;
  loading?: boolean;
  error?: string | null;
  templateDownloadLink?: string;
  templateFileName?: string;
}

const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  importFile,
  setImportFile,
  title,
  description,
  structureInfo,
  loading = false,
  error = null,
  templateDownloadLink,
  templateFileName = "template.xlsx",
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-slate-100 transition-colors"
          >
            <XMarkIcon className="h-6 w-6 text-slate-400" />
          </button>
        </div>
        <form onSubmit={onImport} className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center transition-colors hover:border-orange-300">
            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-slate-300" />
            <div className="mt-4 flex flex-col items-center">
              <label className="cursor-pointer rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 transition-all">
                Choose File
                <input
                  type="file"
                  className="hidden"
                  accept=".xlsx"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </label>
              <p className="mt-2 text-xs text-slate-500 font-medium">
                {importFile ? importFile.name : description}
              </p>
            </div>
          </div>
          {error && (
            <div className="rounded-xl bg-red-50 p-4 border border-red-100 max-h-60 overflow-y-auto shadow-inner shadow-red-100/50">
              <div className="flex flex-col gap-1">
                {error.split("\n").map((err, index) => (
                  <p
                    key={index}
                    className="text-xs font-medium text-red-700 leading-relaxed flex items-start gap-2"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    {err}
                  </p>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-xl bg-blue-50 p-4 border border-blue-100">
            <p className="text-xs font-medium text-blue-700 leading-relaxed">
              {structureInfo}
            </p>
            {templateDownloadLink && (
              <a
                href={templateDownloadLink}
                download={templateFileName}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ArrowUpTrayIcon className="h-3 w-3 rotate-180" />
                Download Template
              </a>
            )}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!importFile || loading}
              className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 shadow-lg shadow-slate-100 transition-all"
            >
              {loading ? "Importing..." : "Import Now"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ImportModal;
