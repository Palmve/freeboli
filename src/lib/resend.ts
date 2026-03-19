type ResendSendEmailInput = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

export async function sendEmailViaResend(input: ResendSendEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = input.from || process.env.RESEND_FROM || "FreeBoli <no-reply@freeboli.vercel.app>";
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
  return res.ok;
}

