/*
  QA-LOGIN-B — regras puras da entrada direta da QA nas contas de teste (sem código por e-mail).
  A rota (/api/qa/entrar) só existe com QA_LOGIN_KEY definida; tudo o que não passa nestas regras vira 404.
  Roda: node --test src/lib/qa/entrar.test.ts
*/
import crypto from "node:crypto";

/** Entradas por hora, por IP e por conta. */
export const LIMITE_QA_POR_HORA = 30;

/** Papéis que a entrada da QA aceita. Administrador (e qualquer outro papel) nunca. */
export const PAPEIS_QA = ["owner", "tenant"] as const;
export type PapelQa = (typeof PAPEIS_QA)[number];

/**
 * A chave confere? Tempo constante: compara os resumos SHA-256 (mesmo tamanho) com timingSafeEqual, então nem o
 * tamanho da chave certa vaza pelo tempo. Sem chave esperada (variável vazia) → false.
 */
export function chaveConfere(fornecida: unknown, esperada: string | undefined | null): boolean {
  if (!esperada || typeof fornecida !== "string" || !fornecida) return false;
  const a = crypto.createHash("sha256").update(fornecida, "utf8").digest();
  const b = crypto.createHash("sha256").update(esperada, "utf8").digest();
  return crypto.timingSafeEqual(a, b);
}

/** E-mail normalizado (minúsculas, sem espaços) ou "" quando não parece e-mail. */
export function emailNormalizado(cru: unknown): string {
  if (typeof cru !== "string") return "";
  const e = cru.trim().toLowerCase().slice(0, 254);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : "";
}

/**
 * O e-mail casa com QA_EMAIL_PADRAO? O padrão é uma regex da env, ancorada aqui (casa o e-mail inteiro).
 * Sem padrão ou padrão inválido → false (não cria conta nenhuma).
 */
export function emailNoPadrao(email: string, padrao: string | undefined | null): boolean {
  if (!email || !padrao) return false;
  let re: RegExp;
  try {
    re = new RegExp(`^(?:${padrao})$`, "i");
  } catch {
    return false;
  }
  return re.test(email);
}

export interface PerfilQa {
  role: string | null;
  is_teste: boolean | null;
}

/** A conta pode receber a entrada da QA? Só conta de TESTE e só morador ou proprietário; sem fator de 2FA. */
export function contaPermitida(p: PerfilQa | null, temFator2fa: boolean): boolean {
  if (!p || p.is_teste !== true || temFator2fa) return false;
  return (PAPEIS_QA as readonly string[]).includes(String(p.role ?? ""));
}

/** Papel da conta criada pela QA: o pedido ou, sem pedido válido, morador. */
export function papelDaContaNova(cru: unknown): PapelQa {
  return cru === "owner" ? "owner" : "tenant";
}

/** Chave de limite por conta: resumo do e-mail (o e-mail nunca vai para o banco de limites). */
export function chaveLimiteConta(email: string): string {
  return `qa-entrar:conta:${crypto.createHash("sha256").update(`qa:${email}`).digest("hex").slice(0, 32)}`;
}
export const chaveLimiteIp = (ipHash: string) => `qa-entrar:ip:${ipHash}`;
