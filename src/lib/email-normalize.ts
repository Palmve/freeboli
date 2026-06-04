/**
 * Canonicaliza un email para detectar la MISMA bandeja escrita de varias formas.
 * Objetivo anti-Sybil: que `user+1@gmail.com`, `u.s.e.r@gmail.com` y
 * `user@googlemail.com` colapsen al mismo canónico y no cuenten como cuentas
 * distintas.
 *
 * Reglas:
 *  - minúsculas + trim
 *  - se elimina el sub-address (todo lo que sigue a `+`) en cualquier proveedor
 *  - en Gmail/Googlemail se eliminan los puntos del local-part y el dominio se
 *    normaliza a gmail.com
 *
 * NO se usa para enviar correo (para eso se guarda el email original); solo para
 * comparar unicidad.
 */
export function canonicalizeEmail(email: string): string {
  const e = (email || "").trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;

  let local = e.slice(0, at);
  let domain = e.slice(at + 1);

  // Sub-addressing (+tag) — soportado por la mayoría de proveedores.
  const plus = local.indexOf("+");
  if (plus !== -1) local = local.slice(0, plus);

  // Gmail ignora los puntos y trata googlemail.com como gmail.com.
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }

  return `${local}@${domain}`;
}
