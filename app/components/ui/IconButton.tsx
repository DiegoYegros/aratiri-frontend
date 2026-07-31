"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
};

/** Minimum 44×44 touch target for icon-only controls. */
export const IconButton = ({
  label,
  children,
  className = "",
  type = "button",
  ...props
}: IconButtonProps) => {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center min-h-11 min-w-11 h-11 w-11 rounded-lg text-muted hover:text-foreground hover:bg-panel-elevated transition-colors disabled:opacity-50 disabled:pointer-events-none ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
