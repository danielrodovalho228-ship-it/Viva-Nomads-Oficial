/**
 * Chave do autenticador (ordens 33c943b4 item 3 / 1d1967f4): quem ativa o 2FA no
 * MESMO celular não consegue escanear o QR; precisa da chave em texto e do link otpauth://.
 * A chave nunca é registrada em log.
 */
const BASE32 = /^[A-Z2-7]+=*$/;

/** "jbswy3dp…" → "JBSW Y3DP …" (grupos de 4 para ler e digitar). */
export function agruparChave(segredo: string): string {
  const limpo = segredo.replace(/\s+/g, "").toUpperCase();
  return limpo.match(/.{1,4}/g)?.join(" ") ?? "";
}

/** Link que abre direto o app autenticador; null se o segredo não for base32. */
export function urlOtpauth(segredo: string): string | null {
  const limpo = segredo.replace(/\s+/g, "").toUpperCase();
  if (!BASE32.test(limpo)) return null;
  return `otpauth://totp/Viva%20Nomads?secret=${limpo}&issuer=Viva%20Nomads`;
}
