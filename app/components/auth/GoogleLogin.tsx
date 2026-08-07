"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
declare global {
  interface Window {
    google: any;
  }
}

interface GoogleLoginProps {
  onSuccess: (token: string) => void;
  onError: (error: string) => void;
  /** Medium GSI button for callers that need a shorter control. Login omits this. */
  compact?: boolean;
}

const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  "254642422573-4l9v69dl2km5c9gqj7m7hr2gli059vk8.apps.googleusercontent.com";

const GoogleLogin = ({
  onSuccess,
  onError,
  compact = false,
}: GoogleLoginProps) => {
  const buttonDiv = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const t = useTranslation();

  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const tRef = useRef(t);

  useEffect(() => {
    onSuccessRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const scriptTag = document.createElement("script");
    scriptTag.src = "https://accounts.google.com/gsi/client";
    scriptTag.async = true;
    scriptTag.defer = true;
    scriptTag.onload = () => {
      setScriptLoaded(true);
    };
    document.body.appendChild(scriptTag);

    return () => {
      document.body.removeChild(scriptTag);
    };
  }, []);

  useEffect(() => {
    if (scriptLoaded && buttonDiv.current && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential?: string }) => {
          if (response.credential) {
            onSuccessRef.current(response.credential);
          } else {
            onErrorRef.current(
              tRef.current("Google credential was not received.")
            );
          }
        },
      });

      buttonDiv.current.replaceChildren();
      const width = Math.max(
        240,
        Math.floor(buttonDiv.current.getBoundingClientRect().width)
      );
      window.google.accounts.id.renderButton(buttonDiv.current, {
        theme: "filled_black",
        size: compact ? "medium" : "large",
        type: "standard",
        text: "signin_with",
        width,
      });
    }
  }, [scriptLoaded, compact]);

  return (
    <div
      ref={buttonDiv}
      className={`w-full flex justify-stretch [&>div]:w-full [&>div]:flex [&>div]:justify-center ${
        compact ? "min-h-10" : "min-h-11"
      }`}
    />
  );
};

export default GoogleLogin;
