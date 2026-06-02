import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";

export interface BaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  widthClassName?: string; // e.g. "max-w-[640px]" or "max-w-[700px]"
  disabledClose?: boolean;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, damping: 25, stiffness: 350 },
  },
  exit: { opacity: 0, scale: 0.96, y: 12, transition: { duration: 0.15 } },
};

export const BaseModal: React.FC<BaseModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  children,
  widthClassName = "max-w-[640px]",
  disabledClose = false,
}) => {
  // Support Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !disabledClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, disabledClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !disabledClose) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop Blur Overlay */}
          <motion.div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal Container */}
          <motion.div
            className={`relative w-full ${widthClassName} max-h-[90vh] overflow-hidden rounded-[24px] bg-white shadow-xl shadow-slate-900/10 border border-slate-100 flex flex-col`}
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-slate-100/60">
              <div className="flex items-center gap-3.5">
                {icon && (
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-50 text-orange-600 shrink-0">
                    {icon}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-slate-800 leading-tight">
                    {title}
                  </h3>
                  {subtitle && (
                    <p className="text-xs text-slate-400 mt-0.5 leading-snug font-medium">
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
              {!disabledClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all duration-150 -mt-0.5 -mr-1"
                  aria-label="Close modal"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 scrollbar-thin">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BaseModal;
