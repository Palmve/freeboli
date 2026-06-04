"use client";

import { useEffect, useRef } from "react";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/** True si el widget está configurado en el cliente. */
export function isTurnstileClientEnabled(): boolean {
  return !!SITE_KEY;
}

/**
 * Widget de Cloudflare Turnstile. Si no hay NEXT_PUBLIC_TURNSTILE_SITE_KEY,
 * no renderiza nada (modo dormido). Llama a `onToken` con el token resuelto
 * (o "" si expira/error).
 */
export default function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY) return;

    const render = () => {
      const ts = (window as unknown as { turnstile?: any }).turnstile;
      if (!ts || !containerRef.current || widgetIdRef.current) return;
      widgetIdRef.current = ts.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: "dark",
        callback: (token: string) => onToken(token),
        "error-callback": () => onToken(""),
        "expired-callback": () => onToken(""),
      });
    };

    if ((window as unknown as { turnstile?: any }).turnstile) {
      render();
    } else {
      const existing = document.querySelector<HTMLScriptElement>("script[data-turnstile]");
      if (!existing) {
        const s = document.createElement("script");
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        s.async = true;
        s.defer = true;
        s.setAttribute("data-turnstile", "1");
        s.onload = render;
        document.head.appendChild(s);
      } else {
        existing.addEventListener("load", render);
      }
    }

    return () => {
      const ts = (window as unknown as { turnstile?: any }).turnstile;
      if (ts && widgetIdRef.current) {
        try {
          ts.remove(widgetIdRef.current);
        } catch {
          /* noop */
        }
        widgetIdRef.current = null;
      }
    };
  }, [onToken]);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="my-2" />;
}
