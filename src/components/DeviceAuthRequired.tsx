"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeviceAuthRequired({ email }: { email: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "requesting" | "sent" | "verifying" | "success">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function maskEmail(emailstr: string) {
    if (!emailstr || !emailstr.includes("@")) return emailstr;
    const [name, domain] = emailstr.split("@");
    if (name.length <= 4) return name.substring(0, 1) + "***@" + domain;
    const start = name.substring(0, 3);
    const end = name.substring(name.length - 2);
    return `${start}****${end}@${domain}`;
  }

  useEffect(() => {
    // Solicitar PIN inicial automáticamente si le parece conveniente a la UX
    // RequestPin();
  }, []);

  async function requestPin() {
    setStatus("requesting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/device-auth/request", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fallo en la solicitud SMTP");
      setStatus("sent");
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus("idle");
    }
  }

  async function verifyPin(fullPin: string) {
    setStatus("verifying");
    setErrorMsg("");
    try {
      const res = await fetch("/api/admin/device-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: fullPin })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PIN inválido");
      setStatus("success");
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus("sent");
      setPin(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newPin = [...pin];
      
      // If current is empty, clear PREVIOUS and move focus
      if (pin[index] === "" && index > 0) {
        newPin[index - 1] = "";
        setPin(newPin);
        inputRefs.current[index - 1]?.focus();
      } else {
        // Clear current
        newPin[index] = "";
        setPin(newPin);
      }
    }
  }

  function handleChange(val: string, index: number) {
    if (!/^[0-9]*$/.test(val)) return;

    // Handle Paste (multiple chars)
    if (val.length > 1) {
      const pasted = val.slice(0, 6).split("");
      const newPin = [...pin];
      pasted.forEach((char, i) => {
        if (index + i < 6) newPin[index + i] = char;
      });
      setPin(newPin);
      
      const nextEmpty = newPin.findIndex(v => v === "");
      if (nextEmpty !== -1) {
        inputRefs.current[nextEmpty]?.focus();
      } else {
        inputRefs.current[5]?.focus();
        if (newPin.join("").length === 6) verifyPin(newPin.join(""));
      }
      return;
    }

    // Normal typed char
    const newPin = [...pin];
    newPin[index] = val;
    setPin(newPin);

    // Auto-advance
    if (val !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit
    if (newPin.join("").length === 6) {
      verifyPin(newPin.join(""));
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-md mx-auto p-6 text-center">
      <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-black/50 border border-slate-700">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      
      <h2 className="text-2xl font-black text-white mb-2">Dispositivo No Reconocido</h2>
      <p className="text-slate-400 text-sm mb-8">
        Has iniciado sesión desde un nuevo dispositivo o navegador. Como medida de protección de fondos, 
        necesitamos verificar que eres realmente el operador autorizado.
      </p>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm px-4 py-3 rounded-lg w-full mb-6 font-medium animate-pulse">
          {errorMsg}
        </div>
      )}

      {status === "idle" || status === "requesting" ? (
        <div className="w-full">
          <p className="text-slate-300 text-sm mb-4">
            Se enviará un código PIN de único uso a la bandeja de: <br/> <strong className="text-white block mt-1 bg-slate-800 py-1.5 rounded text-lg font-mono tracking-wide">{maskEmail(email)}</strong>
          </p>
          <button 
            onClick={requestPin}
            disabled={status === "requesting"}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:opacity-50"
          >
            {status === "requesting" ? "Generando Enlace SMTP..." : "Enviar Comando de Verificación"}
          </button>
        </div>
      ) : status === "verifying" || status === "success" ? (
        <div className="w-full">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-amber-500 font-bold">{status === "success" ? "¡Verificado! Ingresando al Panel..." : "Comprobando Código Criptográfico..."}</p>
        </div>
      ) : (
        <div className="w-full space-y-6">
          <p className="text-slate-300 text-sm font-medium">Hemos enviado el código. Ingrésalo a continuación:</p>
          
          <div className="flex gap-2 justify-center">
            {pin.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(e.target.value, i)}
                onKeyDown={(e) => handleKeyDown(e, i)}
                className="w-12 h-14 text-center text-xl font-black bg-slate-900 border-2 border-slate-700 text-white rounded-lg focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all shadow-inner"
              />
            ))}
          </div>

          <div className="pt-4">
            <button 
              onClick={requestPin}
              className="text-slate-500 text-xs hover:text-white underline underline-offset-4 transition"
            >
              No recibí el correo. ¿Reenviar PIN?
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
