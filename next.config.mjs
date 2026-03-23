/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Clickjacking protection
          { key: "X-Frame-Options", value: "DENY" },
          // MIME type sniffing prevention
          { key: "X-Content-Type-Options", value: "nosniff" },
          // XSS filter (legacy browsers)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Referrer privacy
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Browser API restrictions
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()" },
          // HTTPS enforcement (1 year, con preload)
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // Cross-Origin isolation policies (previene Spectre/Meltdown side-channels)
          { key: "Cross-Origin-Embedder-Policy", value: "unsafe-none" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // Eliminar información de server
          { key: "X-Powered-By", value: "" },
          // DNS prefetch control
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      {
        // Headers específicos para la API — sin cacheo de respuestas sensibles
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
  // Ocultar que es Next.js en los headers
  poweredByHeader: false,
};

export default nextConfig;
