"use client";

import { useEffect, useRef, useState } from "react";
declare global {
  interface Window {
    google: any;
  }
}

interface GoogleLoginProps {
  onSuccess: (token: string) => void;
  onError: (error: string) => void;
}

const GoogleLogin = ({ onSuccess, onError }: GoogleLoginProps) => {
  const buttonDiv = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

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
    if (scriptLoaded && buttonDiv.current) {
      window.google.accounts.id.initialize({
        client_id:
          "254642422573-4l9v69dl2km5c9gqj7m7hr2gli059vk8.apps.googleusercontent.com",
        callback: handleCredentialResponse,
      });

      window.google.accounts.id.renderButton(buttonDiv.current, {
        theme: "outline",
        size: "large",
        type: "standard",
        text: "signin_with",
      });
    }
  }, [scriptLoaded]);

  const handleCredentialResponse = (response: any) => {
    if (response.credential) {
      onSuccess(response.credential);
    } else {
      onError("No se recibió la credencial de Google.");
    }
  };

  return <div ref={buttonDiv} className="flex justify-center"></div>;
};

export default GoogleLogin;
