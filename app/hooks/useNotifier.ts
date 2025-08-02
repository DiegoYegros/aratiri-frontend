"use client";
import { Notification } from "@/app/lib/api";
import { useCallback, useState } from "react";

export const useNotifier = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback(
    (title: string, message: string, type: "success" | "error" = "success") => {
      const newNotification: Notification = {
        id: new Date().getTime(),
        title,
        message,
        type,
      };
      setNotifications((prev) => [...prev, newNotification]);
    },
    []
  );

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, addNotification, removeNotification };
};
