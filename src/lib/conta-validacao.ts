/*
  Validação dos dados pessoais da Conta (nome, telefone, LinkedIn). Módulo puro,
  usado no servidor (fonte da verdade) e testado em conta-validacao.test.ts.
*/

export type Validado<T> = { ok: true; valor: T } | { ok: false; erro: string };

/** Nome completo: 3 a 80 caracteres, com letras, sem e-mail/telefone/links. */
export function validarNome(bruto: string): Validado<string> {
  const nome = String(bruto ?? "").replace(/\s+/g, " ").trim();
  if (nome.length < 3) return { ok: false, erro: "Informe seu nome completo." };
  if (nome.length > 80) return { ok: false, erro: "Nome muito longo (máximo 80 caracteres)." };
  if (!/\p{L}/u.test(nome)) return { ok: false, erro: "O nome precisa ter letras." };
  if (/@|https?:\/\/|www\.|\d{4,}/i.test(nome)) {
    return { ok: false, erro: "O nome não pode ter e-mail, telefone ou link." };
  }
  return { ok: true, valor: nome };
}

/**
 * Telefone brasileiro com DDD: 10 (fixo) ou 11 dígitos (celular, começa com 9
 * depois do DDD). Aceita +55 e qualquer pontuação. Vazio → null (opcional).
 * Grava formatado: "(34) 99999-0000".
 */
export function normalizarTelefone(bruto: string): Validado<string | null> {
  let d = String(bruto ?? "").replace(/\D/g, "");
  if (!d) return { ok: true, valor: null };
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  const ddd = Number(d.slice(0, 2));
  if (d.length !== 10 && d.length !== 11) {
    return { ok: false, erro: "Telefone inválido. Use DDD + número, ex.: (34) 99999-0000." };
  }
  if (ddd < 11 || ddd > 99) return { ok: false, erro: "DDD inválido." };
  if (d.length === 11 && d[2] !== "9") return { ok: false, erro: "Celular deve começar com 9 depois do DDD." };
  const valor =
    d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return { ok: true, valor };
}

/** LinkedIn opcional: só perfis do linkedin.com. Vazio → null. */
export function validarLinkedin(bruto: string): Validado<string | null> {
  const v = String(bruto ?? "").trim();
  if (!v) return { ok: true, valor: null };
  const url = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(url);
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return { ok: false, erro: "Use um endereço do linkedin.com." };
    return { ok: true, valor: `https://${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "")}` };
  } catch {
    return { ok: false, erro: "Endereço do LinkedIn inválido." };
  }
}
