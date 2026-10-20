import { isValidEmail } from "../auth-errors.ts";
import { MSG_EMAIL_INUTILIZAVEL, dominioDoEmail, dominioReservado } from "../email-dominio.ts";

/*
  Quem abre o chamado (F24, ordem f3a85544). Logado: o e-mail da conta recebe a
  resposta (mostramos só mascarado). Deslogado: nome e e-mail obrigatórios,
  validados no servidor, com a mesma regra de domínio do cadastro (F2).
*/

/** "daniel@gmail.com" → "da***@gmail.com". Nunca o e-mail completo. */
export function emailMascaradoDaConta(email: string | null | undefined): string | null {
  const t = (email ?? "").trim();
  const i = t.lastIndexOf("@");
  if (i < 1) return null;
  return `${t.slice(0, Math.min(2, i))}***${t.slice(i)}`;
}

export type VisitanteValidado = { ok: true; nome: string; email: string; telefone?: string } | { ok: false; error: string };

/** Telefone opcional: só dígitos (10 a 13, com DDD e, se quiser, 55). Vazio = "". */
export function normalizarTelefone(bruto: string | undefined): string {
  return (bruto ?? "").replace(/[\s().+-]/g, "");
}

export function validarVisitante(entrada: { nome?: string; email?: string; telefone?: string }): VisitanteValidado {
  const nome = (entrada.nome ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
  if (nome.length < 2) return { ok: false, error: "Informe seu nome para a equipe saber com quem falar." };
  const email = (entrada.email ?? "").trim().toLowerCase().slice(0, 254);
  if (!isValidEmail(email)) return { ok: false, error: "Informe um e-mail válido para receber a resposta." };
  const dominio = dominioDoEmail(email);
  if (!dominio || dominioReservado(dominio)) return { ok: false, error: MSG_EMAIL_INUTILIZAVEL };
  const telefone = normalizarTelefone(entrada.telefone);
  if (!telefone) return { ok: true, nome, email };
  if (!/^\d{10,13}$/.test(telefone)) return { ok: false, error: "Telefone inválido. Informe com DDD (ex.: 34 99999-1234) ou deixe em branco." };
  return { ok: true, nome, email, telefone };
}

/** "34999991234" → "(34) •••••-1234". A equipe vê só o fim; nunca o número inteiro na tela. */
export function telefoneMascarado(tel: string | null | undefined): string | null {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length < 10) return null;
  const ddd = d.length > 11 ? d.slice(-11, -9) : d.slice(0, 2);
  return `(${ddd}) •••••-${d.slice(-4)}`;
}
