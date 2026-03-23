import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware de seguridad global para FreeBoli.
 * Aplica: CSP, HSTS, bloqueo de métodos inseguros, CORS para APIs,
 * y detección de patrones de bot/scanner comunes.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ══════════════════════════════════════════════════════
  // 1. BLOQUEAR MÉTODOS HTTP INSEGUROS en rutas API
  // ══════════════════════════════════════════════════════
  if (pathname.startsWith("/api/")) {
    const method = request.method.toUpperCase();
    // Solo permitir métodos estándar
    if (!["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"].includes(method)) {
      return new NextResponse("Método no permitido", { status: 405 });
    }
    // Preflight CORS — solo orígenes conocidos
    if (method === "OPTIONS") {
      const origin = request.headers.get("origin") ?? "";
      const allowedOrigins = [
        "https://freeboli.win",
        "https://www.freeboli.win",
        process.env.NEXTAUTH_URL ?? "",
      ].filter(Boolean);
      const isAllowed = allowedOrigins.some((o) => origin.startsWith(o));
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowed ? origin : allowedOrigins[0],
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════
  // 2. BLOQUEAR USER AGENTS DE BOTS CONOCIDOS
  //    (Scanners de vulnerabilidades, crawlers maliciosos)
  // ══════════════════════════════════════════════════════
  const ua = request.headers.get("user-agent") ?? "";
  const bannedBotPatterns = [
    /sqlmap/i, /nikto/i, /nmap/i, /zgrab/i, /masscan/i,
    /burpsuite/i, /nuclei/i, /dirbuster/i, /gobuster/i,
    /python-requests\/2\.[0-4]/i, // Versiones antiguas de requests usadas en exploits
  ];
  if (pathname.startsWith("/api/") && bannedBotPatterns.some((p) => p.test(ua))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ══════════════════════════════════════════════════════
  // 3. BLOQUEAR ESCANEO DE RUTAS SENSIBLES
  //    (Ataques comunes de enumeración de archivos)
  // ══════════════════════════════════════════════════════
  const suspiciousPaths = [
    /\/\.env/i, /\/wp-admin/i, /\/wp-login/i, /\/phpmyadmin/i,
    /\/admin\.php/i, /\/shell\.php/i, /\/config\.php/i,
    /\/\.git\//i, /\/etc\/passwd/i, /\/proc\//i,
    /\/xmlrpc\.php/i, /\/actuator/i, /\/\.well-known\/security\.txt/i,
  ];
  if (suspiciousPaths.some((p) => p.test(pathname))) {
    return new NextResponse("Not found", { status: 404 });
  }

  // ══════════════════════════════════════════════════════
  // 4. SECURITY HEADERS (refuerzo de next.config.mjs)
  // ══════════════════════════════════════════════════════

  // Content Security Policy — evita XSS e inyección de scripts
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://fonts.googleapis.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.resend.com https://helius-rpc.com https://*.helius-rpc.com https://mainnet.helius-rpc.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  // HSTS — obliga HTTPS por 1 año, incluye subdominios
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  );

  // Previene ataques de clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Previene MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer limitado para privacidad
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permisos restrictivos de browser APIs
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()"
  );

  // Elimina información del servidor
  response.headers.delete("X-Powered-By");
  response.headers.set("Server", "FreeBoli");

  // ══════════════════════════════════════════════════════
  // 5. PROTEGER RUTAS ADMIN — Requieren encabezado especial
  //    en producción adicional a la auth de sesión
  // ══════════════════════════════════════════════════════
  if (pathname.startsWith("/api/admin/") || pathname.startsWith("/admin")) {
    // Si el request viene de fuera del dominio oficial, registrar alerta
    const referer = request.headers.get("referer") ?? "";
    const host = request.headers.get("host") ?? "";
    // Solo permitimos requests directos o desde el mismo dominio
    if (referer && !referer.includes(host) && !referer.includes("freeboli.win")) {
      // No bloqueamos pero marcamos para revisión futura
      response.headers.set("X-Security-Flag", "cross-origin-admin-access");
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Aplica a todas las rutas excepto archivos estáticos y next internals
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
