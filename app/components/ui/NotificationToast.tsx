"use client";

import { X, Zap } from "lucide-react";
import { useEffect } from "react";
import { Notification } from "../../lib/api";
import { useTranslation } from "@/app/hooks/useTranslation";

export const NotificationToast = ({
  notification,
  onClose,
}: {
  notification: Notification;
  onClose: (id: number) => void;
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onClose]);
  const t = useTranslation();
  const isSuccess = notification.type === "success";
  const bgColor = isSuccess ? "bg-success-bg" : "bg-danger-bg";
  const borderColor = isSuccess ? "border-success" : "border-danger";
  const iconColor = isSuccess ? "text-success" : "text-danger";
  const Icon = isSuccess ? Zap : X;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full max-w-sm rounded-lg border ${borderColor} ${bgColor} animate-fade-in-right`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 pt-0.5">
            <Icon className={`w-5 h-5 ${iconColor}`} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {notification.title}
            </p>
            <p className="mt-1 text-sm text-muted-strong">
              {notification.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onClose(notification.id)}
            className="inline-flex items-center justify-center min-h-11 min-w-11 -mr-2 -mt-2 text-muted hover:text-foreground rounded-lg"
            aria-label={t("Close")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
