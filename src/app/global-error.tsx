"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body style={{ background: "#0f172a", color: "#e2e8f0", fontFamily: "sans-serif", padding: "2rem", textAlign: "center" }}>
        <h1 style={{ color: "#f59e0b" }}>Error</h1>
        <p>{error.message}</p>
        <button
          onClick={() => reset()}
          style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#f59e0b", color: "#000", border: "none", borderRadius: "0.5rem", cursor: "pointer" }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
