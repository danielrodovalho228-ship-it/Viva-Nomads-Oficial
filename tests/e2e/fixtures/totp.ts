import { createHmac } from "node:crypto";

/**
 * Código TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) para a conta ADMIN de teste do
 * laboratório entrar no /admin (verificação em duas etapas, AAL2). Sem
 * dependência externa. O segredo vem de TESTES_ADMIN_TOTP_SEGREDO (GitHub
 * Secrets) e nunca do código.
 */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decodificar(texto: string): Buffer {
  const limpo = texto.toUpperCase().replace(/[\s=-]/g, "");
  let bits = "";
  for (const c of limpo) {
    const i = BASE32.indexOf(c);
    if (i < 0) throw new Error("Segredo TOTP inválido (base32).");
    bits += i.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function gerarCodigoTotp(segredoBase32: string, agoraMs: number = Date.now(), digitos = 6): string {
  const contador = Math.floor(agoraMs / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const h = createHmac("sha1", base32Decodificar(segredoBase32)).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digitos).padStart(digitos, "0");
}
