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

export const MSG_TELEFONE_EXTERIOR =
  "Número de fora do Brasil? Comece com + e o código do país (ex.: +1).";

/** "+5534999990001" (sem o +) → formato brasileiro, ou null se não for válido. */
function formatarBrasil(d: string): string | null {
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 11) {
    if (d[2] !== "9") return null; // celular começa com 9 depois do DDD
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  // Fixo (10 dígitos): o 1º dígito depois do DDD vai de 2 a 5. Sem isso, um
  // número dos EUA (6416296134) virava "(64) 1629-6134" — fixo de Goiás errado.
  if (!/[2-5]/.test(d[2])) return null;
  return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

/**
 * Telefone. Vazio → null (opcional).
 * - Com "+": internacional no padrão E.164 (8 a 15 dígitos com o código do
 *   país). +55 é validado como Brasil; +1 é gravado "+1 641 629 6134"; os
 *   demais, "+<dígitos>".
 * - Sem "+": Brasil com DDD — celular (11 dígitos, 9 depois do DDD) ou fixo
 *   (10 dígitos, 2 a 5 depois do DDD). Fora disso, pede o + e o código do país.
 * Brasil é gravado "(34) 99999-0000".
 */
export function normalizarTelefone(bruto: string): Validado<string | null> {
  const texto = String(bruto ?? "").trim();
  const d = texto.replace(/\D/g, "");
  if (!d) return { ok: true, valor: null };

  if (texto.startsWith("+")) {
    if (d.length < 8 || d.length > 15) {
      return { ok: false, erro: "Número internacional inválido: use + código do país e o número (8 a 15 dígitos)." };
    }
    if (d.startsWith("55")) {
      const br = formatarBrasil(d.slice(2));
      return br ? { ok: true, valor: br } : { ok: false, erro: "Telefone do Brasil inválido. Use DDD + número, ex.: (34) 99999-0000." };
    }
    if (d.startsWith("1")) {
      if (d.length !== 11) return { ok: false, erro: "Número dos EUA/Canadá deve ter 10 dígitos depois do +1." };
      return { ok: true, valor: `+1 ${d.slice(1, 4)} ${d.slice(4, 7)} ${d.slice(7)}` };
    }
    return { ok: true, valor: `+${d}` };
  }

  // Sem "+": Brasil (aceita 55 na frente sem o +).
  const local = (d.length === 12 || d.length === 13) && d.startsWith("55") ? d.slice(2) : d;
  const br = formatarBrasil(local);
  if (br) return { ok: true, valor: br };
  if (local.length === 10 || local.length === 11) {
    // Tem tamanho de número brasileiro mas não é (ex.: celular sem 9, fixo
    // começando com 1/6–9): provável número de fora.
    return { ok: false, erro: MSG_TELEFONE_EXTERIOR };
  }
  return { ok: false, erro: "Telefone inválido. Use DDD + número, ex.: (34) 99999-0000, ou + e o código do país." };
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
