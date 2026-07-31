"use client";
import jsQR from "jsqr";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { IconButton } from "../ui/IconButton";
import { Alert } from "../ui/Alert";

interface QrScannerProps {
  onScanSuccess: (data: string) => void;
  onClose: () => void;
}

export const QrScanner = ({ onScanSuccess, onClose }: QrScannerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrameId: number | null = null;
    let isCancelled = false;

    const tick = () => {
      if (
        videoRef.current &&
        videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
        canvasRef.current
      ) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const ctx = canvas.getContext("2d");

        if (ctx) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);

          if (code) {
            onScanSuccess(code.data);
            return;
          }
        }
      }
      animationFrameId = requestAnimationFrame(tick);
    };

    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (isCancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true");
          videoRef.current.play();
          animationFrameId = requestAnimationFrame(tick);
        }
      } catch {
        setError(
          t("Could not access camera. Please check permissions and try again.")
        );
      }
    };

    startCamera();

    return () => {
      isCancelled = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [onScanSuccess, t]);

  return (
    <div
      className="fixed inset-0 bg-overlay flex items-center justify-center z-50 p-4 animate-fade-in"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scanner-title"
        className="bg-panel border border-panel-edge p-4 rounded-xl relative w-full max-w-md animate-fade-in-up"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 id="qr-scanner-title" className="text-lg font-semibold">
            {t("Scan QR Code")}
          </h3>
          <IconButton label={t("Close")} onClick={onClose}>
            <X className="w-5 h-5" aria-hidden="true" />
          </IconButton>
        </div>
        <div className="w-full aspect-square bg-input rounded-lg overflow-hidden border border-panel-edge">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>
        {error && (
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </div>
    </div>
  );
};
