type ResendSendEmailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export type SendEmailResult =
  | { ok: true }
  | { ok: false; error: string; status?: number };

/**
 * Igual que sendEmailViaResend pero devuelve el motivo si Resend rechaza el envío
 * (dominio no verificado, API key inválida, etc.).
 */
export async function sendEmailViaResendDetailed(input: ResendSendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY no está configurada en el servidor." };
  }
  const from = input.from || process.env.RESEND_FROM?.trim() || "FreeBoli <no-reply@freeboli.vercel.app>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (res.ok) {
    return { ok: true };
  }

  let message = res.statusText || "Error desconocido";
  try {
    const json = (await res.json()) as { message?: string | string[] };
    if (typeof json?.message === "string") {
      message = json.message;
    } else if (Array.isArray(json?.message)) {
      message = json.message.join("; ");
    }
  } catch {
    /* ignore */
  }

  return { ok: false, error: message, status: res.status };
}

export async function sendEmailViaResend(input: ResendSendEmailInput): Promise<boolean> {
  const r = await sendEmailViaResendDetailed(input);
  return r.ok;
}

