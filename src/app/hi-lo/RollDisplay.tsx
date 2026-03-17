"use client";

/**
 * Display de 4 dígitos tipo tragamonedas (0000-9999): cada dígito en un panel negro,
 * animación de caída al cambiar el resultado.
 */
export default function RollDisplay({
  value,
  animate,
}: {
  value: string;
  animate: boolean;
}) {
  const digits = value.padStart(4, "0").split("");

  return (
    <div
      className="flex justify-center gap-1 sm:gap-2"
      key={animate ? value : "idle"}
    >
      {digits.map((d, i) => (
        <div
          key={`${value}-${i}`}
          className={`flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-black sm:h-16 sm:w-12 ${animate ? "slot-digit-ani" : ""}`}
          style={animate ? { animationDelay: `${i * 0.07}s` } : undefined}
        >
          <span className="font-mono text-2xl font-bold tabular-nums text-white sm:text-3xl">
            {d}
          </span>
        </div>
      ))}
    </div>
  );
}
