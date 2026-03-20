"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef<string>("");

  useEffect(() => {
    // No rastrear páginas de autenticación para evitar bloqueos en el login/registro
    if (pathname.startsWith("/auth")) return;
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    const timer = setTimeout(() => {
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true, // Asegura que la petición se complete sin bloquear el hilo principal
        body: JSON.stringify({
          type: "page_view",
          path: pathname,
          metadata: {
            title: document.title,
            referrer: document.referrer,
          },
        }),
      }).catch(() => {}); // Ignorar fallos de analíticas
    }, 1000);

    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
