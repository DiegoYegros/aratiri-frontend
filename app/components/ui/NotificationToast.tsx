"use client";

import { X, Zap } from "lucide-react";
import { useEffect } from "react";
import { Notification } from "../../lib/api";

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

  const isSuccess = notification.type === "success";
  const bgColor = isSuccess ? "bg-green-500/20" : "bg-red-500/20";
  const borderColor = isSuccess ? "border-success" : "border-destructive";
  const iconColor = isSuccess ? "text-success" : "text-destructive";
  const Icon = isSuccess ? Zap : X;

  return (
    <div
      className={`w-full max-w-sm rounded-lg shadow-lg pointer-events-auto overflow-hidden border ${borderColor} ${bgColor} backdrop-blur-sm animate-fade-in-right`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={iconColor} />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className="text-sm font-bold text-white">{notification.title}</p>
            <p className="mt-1 text-sm text-gray-300">{notification.message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onClose(notification.id)}
              className="inline-flex text-gray-400 hover:text-white"
            >
              <span className="sr-only">Close</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
