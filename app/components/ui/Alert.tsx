"use client";

import { ReactNode } from "react";

type AlertVariant = "danger" | "success" | "warning";

const styles: Record<AlertVariant, string> = {
  danger: "bg-danger-bg border-danger text-danger",
  success: "bg-success-bg border-success text-success",
  warning: "bg-accent-subtle border-accent text-accent",
};

export const Alert = ({
  variant,
  children,
  className = "",
}: {
  variant: AlertVariant;
  children: ReactNode;
  className?: string;
}) => {
  const role = variant === "danger" ? "alert" : "status";
  return (
    <div
      role={role}
      className={`border px-4 py-3 rounded-lg text-center text-sm ${styles[variant]} ${className}`}
    >
      {children}
    </div>
  );
};
