"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";
import { useTranslation } from "@/app/hooks/useTranslation";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  labelledBy?: string;
  /** Optional back control shown left of title */
  leading?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** When false, omit default body padding (caller owns layout) */
  padded?: boolean;
}

export const Modal = ({
  title,
  onClose,
  children,
  labelledBy = "modal-title",
  leading,
  className = "",
  bodyClassName = "",
  padded = true,
}: ModalProps) => {
  const t = useTranslation();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4 animate-fade-in"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`bg-panel border border-panel-edge rounded-xl w-full max-w-md max-h-[90dvh] flex flex-col shadow-none animate-fade-in-up ${className}`}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-panel-edge shrink-0">
          <div className="min-w-11 flex items-center justify-start">
            {leading ?? <span className="w-11" aria-hidden="true" />}
          </div>
          <h2
            id={labelledBy}
            className="text-lg sm:text-xl font-semibold text-center flex-1 truncate"
          >
            {title}
          </h2>
          <IconButton label={t("Close")} onClick={onClose}>
            <X className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        </div>
        <div
          className={`${padded ? "overflow-y-auto p-4 sm:p-6" : "overflow-y-auto"} ${bodyClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
