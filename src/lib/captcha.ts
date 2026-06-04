import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.CAPTCHA_SECRET || process.env.NEXTAUTH_SECRET || "fallback-captcha-key";
const TTL_MS = 5 * 60 * 1000; // 5 min validity

export interface CaptchaChallenge {
  question: string;
  token: string;
  position: "top" | "bottom";
}

export function generateCaptcha(claimCount: number): CaptchaChallenge {
  const ops = ["+", "-", "*"] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;

  switch (op) {
    case "+":
      a = 1 + Math.floor(Math.random() * 20); // Sencillo 1-20
      b = 1 + Math.floor(Math.random() * 20); 
      answer = a + b;
      break;
    case "-":
      a = 10 + Math.floor(Math.random() * 20); // 10 a 29
      b = 1 + Math.floor(Math.random() * 9);   // 1 a 9 (siempre menor que a)
      answer = a - b;
      break;
    case "*":
      a = 2 + Math.floor(Math.random() * 8); // 2 a 9 (Tabla simple)
      b = 2 + Math.floor(Math.random() * 8); // 2 a 9
      answer = a * b;
      break;
  }

  const exp = Date.now() + TTL_MS;
  // SEGURIDAD: el token NO contiene la respuesta. Solo lleva `exp` y un HMAC
  // calculado sobre `answer:exp`. Sin el SECRET es imposible recuperar la
  // respuesta desde el token; la verificación recalcula el HMAC con la
  // respuesta enviada por el usuario y compara en tiempo constante.
  const hmac = createHmac("sha256", SECRET).update(`${answer}:${exp}`).digest("hex");
  const token = Buffer.from(`${exp}:${hmac}`).toString("base64");

  const position = claimCount % 2 === 0 ? "top" : "bottom";

  return {
    question: `${a} ${op} ${b} = ?`,
    token,
    position,
  };
}

export function verifyCaptcha(answer: number, token: string): { valid: boolean; reason?: string } {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 2) return { valid: false, reason: "Token inválido" };

    const [expStr, receivedHmac] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp)) return { valid: false, reason: "Token inválido" };

    if (Date.now() > exp) return { valid: false, reason: "CAPTCHA expirado, intenta de nuevo" };

    // Recalculamos el HMAC con la respuesta enviada. Si coincide con el del
    // token, la respuesta es la correcta (y el token no fue manipulado).
    const expectedHmac = createHmac("sha256", SECRET).update(`${answer}:${expStr}`).digest("hex");
    const received = Buffer.from(receivedHmac, "hex");
    const expected = Buffer.from(expectedHmac, "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      return { valid: false, reason: "Respuesta incorrecta o token inválido" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Token inválido" };
  }
}
