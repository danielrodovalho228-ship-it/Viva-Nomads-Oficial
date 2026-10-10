/*
  Lead do "Plano Gestor" (31+ imóveis) — ordem f768b951. Validação PURA do formulário de /precos:
  o servidor nunca confia no que o cliente manda (formato, tamanho). Sem CPF; telefone é opcional.
*/

export interface LeadGestorEntrada {
  nome?: unknown;
  email?: unknown;
  telefone?: unknown;
  imoveis?: unknown;
}

export interface LeadGestor {
  nome: string;
  email: string;
  telefone: string;
  imoveis: number | null;
}

export type ResultadoLeadGestor = { ok: true; lead: LeadGestor } | { ok: false; error: string };

const EMAIL = /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/;

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "";
}

export function validarLeadGestor(entrada: LeadGestorEntrada): ResultadoLeadGestor {
  const nome = texto(entrada.nome, 100);
  const email = texto(entrada.email, 254).toLowerCase();
  const telefone = texto(entrada.telefone, 20).replace(/[^\d+()\-\s]/g, "");
  if (nome.length < 2) return { ok: false, error: "Informe seu nome." };
  if (!EMAIL.test(email)) return { ok: false, error: "Informe um e-mail válido." };
  let imoveis: number | null = null;
  if (entrada.imoveis !== undefined && entrada.imoveis !== null && entrada.imoveis !== "") {
    const n = Number(entrada.imoveis);
    if (!Number.isInteger(n) || n < 1 || n > 100000) return { ok: false, error: "Informe a quantidade de imóveis em número." };
    imoveis = n;
  }
  return { ok: true, lead: { nome, email, telefone, imoveis } };
}

export function escaparHtml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}
