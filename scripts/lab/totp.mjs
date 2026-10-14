import { createHmac } from "node:crypto";

/**
 * TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) para o seed do laboratório criar o fator
 * da conta admin de teste. Mesmo algoritmo de tests/e2e/fixtures/totp.ts (a suíte
 * E2E gera o código com o segredo que o seed exporta). Só roda no Supabase LOCAL.
 */
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function gerarCodigoTotp(segredoBase32, agoraMs = Date.now(), digitos = 6) {
  let bits = "";
  for (const c of segredoBase32.toUpperCase().replace(/[\s=-]/g, "")) {
    const i = BASE32.indexOf(c);
    if (i < 0) throw new Error("Segredo TOTP inválido (base32).");
    bits += i.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(agoraMs / 1000 / 30)));
  const h = createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const o = h[h.length - 1] & 0x0f;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 10 ** digitos).padStart(digitos, "0");
}

/**
 * Entra como a conta de teste, inscreve um fator TOTP e o verifica (AAL2). Devolve o
 * segredo base32. `cliente` é um createClient com a chave ANON (nunca a service_role).
 */
export async function ativarTotp(cliente, email, senha) {
  const { error: eLogin } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (eLogin) throw new Error(`2FA lab: login ${email}: ${eLogin.message}`);
  const { data: fator, error: eEnroll } = await cliente.auth.mfa.enroll({ factorType: "totp", friendlyName: "lab-admin" });
  if (eEnroll) throw new Error(`2FA lab: enroll: ${eEnroll.message}`);
  const { data: desafio, error: eDesafio } = await cliente.auth.mfa.challenge({ factorId: fator.id });
  if (eDesafio) throw new Error(`2FA lab: challenge: ${eDesafio.message}`);
  const { error: eVerify } = await cliente.auth.mfa.verify({
    factorId: fator.id,
    challengeId: desafio.id,
    code: gerarCodigoTotp(fator.totp.secret),
  });
  if (eVerify) throw new Error(`2FA lab: verify: ${eVerify.message}`);
  return fator.totp.secret;
}
