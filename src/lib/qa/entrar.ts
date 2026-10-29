/*
  QA-LOGIN-B — regras puras da porta de QA: entrada direta (sem código por e-mail) nas contas de TESTE e no admin
  observador da QA (profiles.qa_admin). A rota (/api/qa/entrar) só existe com QA_LOGIN_KEY_HASH definida; tudo o
  que não passa nestas regras vira 404.
  Roda: node --test src/lib/qa/entrar.test.ts
*/
import crypto from "node:crypto";

/** Entradas por hora, por IP e por conta. */
export const LIMITE_QA_POR_HORA = 30;

/** Último dia (Brasília) em que o admin observador ainda entra pela porta. Depois disso, 404 para ele. */
export const QA_ADMIN_VALIDO_ATE = "2026-12-31";

/** Papéis de conta de TESTE que a porta aceita. Administrador só se for o admin observador (qa_admin). */
export const PAPEIS_QA = ["owner", "tenant"] as const;
export type PapelQa = (typeof PAPEIS_QA)[number];
export type TipoEntradaQa = "teste" | "admin_qa";

const HASH_RE = /^[0-9a-f]{64}$/;

/** sha256 em hex minúsculo. */
export const sha256Hex = (s: string) => crypto.createHash("sha256").update(s, "utf8").digest("hex");

/** O hash configurado (QA_LOGIN_KEY_HASH) é um sha256 em hex? Sem isso, a porta não existe. */
export function hashValido(h: string | undefined | null): h is string {
  return !!h && HASH_RE.test(h.trim().toLowerCase());
}

/**
 * A chave confere com o HASH configurado? sha256(chave) comparado em tempo constante (timingSafeEqual, 32 bytes de
 * cada lado). O valor da chave nunca fica guardado em lugar nenhum: só o hash, na env.
 */
export function chaveConfere(fornecida: unknown, hashEsperado: string | undefined | null): boolean {
  if (!hashValido(hashEsperado) || typeof fornecida !== "string" || !fornecida) return false;
  const a = crypto.createHash("sha256").update(fornecida, "utf8").digest();
  const b = Buffer.from(hashEsperado.trim().toLowerCase(), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
  qa_admin?: boolean | null;
}

/**
 * A entrada do admin observador ainda vale? Desliga sozinha no que vier primeiro: PRE_LANCAMENTO = "off" (o
 * lançamento) ou o dia seguinte a QA_ADMIN_VALIDO_ATE (data de Brasília).
 */
export function portaAdminQaAberta(agora: Date, preLancamentoEnv: string | undefined | null): boolean {
  if ((preLancamentoEnv ?? "").trim().toLowerCase() === "off") return false;
  const hojeBrasilia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  return hojeBrasilia <= QA_ADMIN_VALIDO_ATE;
}

/**
 * Que entrada a conta tem pela porta? "admin_qa" só para o admin observador (qa_admin, role admin, de teste) e só com
 * a porta do admin aberta; "teste" para conta de teste de morador ou proprietário, sem 2FA. Qualquer outra (cliente
 * real, admin comum, o Daniel) → null (404).
 */
export function tipoDeEntrada(p: PerfilQa | null, temFator2fa: boolean, adminQaAberta: boolean): TipoEntradaQa | null {
  if (!p || p.is_teste !== true) return null;
  if (p.qa_admin === true) return p.role === "admin" && adminQaAberta ? "admin_qa" : null;
  if (temFator2fa) return null;
  return (PAPEIS_QA as readonly string[]).includes(String(p.role ?? "")) ? "teste" : null;
}

/** Papel da conta criada pela QA: o pedido ou, sem pedido válido, morador. Nunca admin. */
export function papelDaContaNova(cru: unknown): PapelQa {
  return cru === "owner" ? "owner" : "tenant";
}

/** Destino guardado no registro: só o caminho interno, sem query nem âncora (podem trazer e-mail ou id). */
export function destinoParaRegistro(caminhoSeguro: string): string {
  return (caminhoSeguro.split(/[?#]/)[0] || "/dashboard").slice(0, 200);
}

/** Chave de limite por conta: resumo do e-mail (o e-mail nunca vai para o banco de limites). */
export function chaveLimiteConta(email: string): string {
  return `qa-entrar:conta:${sha256Hex(`qa:${email}`).slice(0, 32)}`;
}
export const chaveLimiteIp = (ipHash: string) => `qa-entrar:ip:${ipHash}`;
