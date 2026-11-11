/*
  Cartão "Por que estou na cidade" (ordem 9950ef15, item 3): período, empresa/instituição e frase curta.
  Módulo puro: o servidor valida aqui (fonte da verdade) e a tela mostra a mesma mensagem.
  Texto livre passa pelo filtro de contato; nada de diagnóstico (LGPD art. 11): o aviso fica na tela
  e o servidor recusa a frase com diagnóstico/doença (mencionaDiagnostico).
*/
import { contemContato } from "../pedidos/pedidos.ts";
import type { Validado } from "../conta-validacao.ts";

export const EMPRESA_MAX = 60;
export const FRASE_MAX = 140;

export interface PorQueNaCidade {
  inicio: string | null; // AAAA-MM-DD
  fim: string | null;
  empresa: string | null;
  frase: string | null;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ordem 9950ef15, item 5 (LGPD art. 11): diagnóstico e nome de doença não entram na frase que o proprietário lê.
 * Lista curta e explícita (doença/diagnóstico/tratamento nominal), para não barrar "Residência médica" ou "hospital".
 * A empresa/instituição fica de fora: nome real de hospital pode conter a especialidade.
 */
const DIAGNOSTICO =
  /diagn[oó]stic|\bdoen[cç]a|\bc[aâ]ncer|\btumor|leucemia|linfoma|quimio|radioterapia|hemodi[aá]lise|\bdi[aá]lise|\bhiv\b|\baids\b|depress[aã]o|esquizofren|bipolar|\bcid[\s-]?[a-z]\d/i;

export const ERRO_DIAGNOSTICO = "Frase: não escreva diagnóstico nem nome de doença. Para o proprietário, tratamento aparece só como \"Saúde\".";

/** true quando o texto cita diagnóstico ou doença (ordem 9950ef15, item 5). */
export function mencionaDiagnostico(texto: string | null | undefined): boolean {
  return DIAGNOSTICO.test(String(texto ?? ""));
}

function dataValida(v: string): boolean {
  if (!DATA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function texto(bruto: unknown, max: number, nome: string): Validado<string | null> {
  const v = String(bruto ?? "").replace(/\s+/g, " ").trim();
  if (!v) return { ok: true, valor: null };
  if (v.length > max) return { ok: false, erro: `${nome}: máximo de ${max} caracteres.` };
  if (contemContato(v)) return { ok: false, erro: `${nome}: não use telefone, e-mail ou rede social aqui.` };
  return { ok: true, valor: v };
}

export function validarPorQueNaCidade(entrada: {
  inicio?: unknown;
  fim?: unknown;
  empresa?: unknown;
  frase?: unknown;
}): Validado<PorQueNaCidade> {
  const inicio = String(entrada.inicio ?? "").trim() || null;
  const fim = String(entrada.fim ?? "").trim() || null;
  if (inicio && !dataValida(inicio)) return { ok: false, erro: "Data de chegada inválida." };
  if (fim && !dataValida(fim)) return { ok: false, erro: "Data de saída inválida." };
  if (inicio && fim && fim < inicio) return { ok: false, erro: "A saída não pode ser antes da chegada." };
  const empresa = texto(entrada.empresa, EMPRESA_MAX, "Empresa ou instituição");
  if (!empresa.ok) return empresa;
  const frase = texto(entrada.frase, FRASE_MAX, "Frase");
  if (!frase.ok) return frase;
  if (mencionaDiagnostico(frase.valor)) return { ok: false, erro: ERRO_DIAGNOSTICO };
  return { ok: true, valor: { inicio, fim, empresa: empresa.valor, frase: frase.valor } };
}

const dataBr = (iso: string) => iso.split("-").reverse().join("/");

/**
 * O que o proprietário lê do cartão "Por que estou na cidade" (ordem 9950ef15, itens 3 e 4): NADA antes do aceite
 * (identidade e história do morador ficam ocultas); depois do aceite, período, empresa/instituição e a frase.
 */
export function sinaisPorQueParaDono(p: PorQueNaCidade | null | undefined, aceito: boolean): string[] {
  if (!aceito || !p) return [];
  const s: string[] = [];
  if (p.inicio && p.fim) s.push(`Na cidade de ${dataBr(p.inicio)} a ${dataBr(p.fim)}`);
  else if (p.inicio) s.push(`Na cidade desde ${dataBr(p.inicio)}`);
  else if (p.fim) s.push(`Na cidade até ${dataBr(p.fim)}`);
  if (p.empresa) s.push(`Empresa ou instituição: ${p.empresa}`);
  // Frase gravada antes da regra do item 5 com diagnóstico: não chega ao proprietário.
  if (p.frase && !mencionaDiagnostico(p.frase)) s.push(`“${p.frase}”`);
  return s;
}
