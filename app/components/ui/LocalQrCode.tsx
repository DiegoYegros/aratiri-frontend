"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface LocalQrCodeProps {
  value: string;
  alt: string;
  size?: number;
  className?: string;
}

/** Renders a QR code locally — invoice data never leaves the browser. */
export const LocalQrCode = ({
  value,
  alt,
  size = 192,
  className = "",
}: LocalQrCodeProps) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(false);

    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (error) {
    return (
      <div
        className={`bg-panel-elevated border border-panel-edge rounded-lg flex items-center justify-center ${className}`}
        style={{ width: size, height: size }}
        role="img"
        aria-label={alt}
      />
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={`bg-white rounded-lg animate-calm-busy ${className}`}
        style={{ width: size, height: size }}
        role="status"
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
    />
  );
};
