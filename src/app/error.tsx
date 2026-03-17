"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8">
      <h2 className="text-xl font-semibold text-red-400">Algo falló</h2>
      <p className="max-w-md text-center text-slate-400">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-amber-500 px-4 py-2 text-slate-900 font-medium hover:bg-amber-400"
      >
        Reintentar
      </button>
    </div>
  );
}
