/*
  Cartão "Por que estou na cidade" (ordem 9950ef15, item 3): período, empresa/instituição e frase curta.
  Módulo puro: o servidor valida aqui (fonte da verdade) e a tela mostra a mesma mensagem.
  Texto livre passa pelo filtro de contato; nada de diagnóstico (LGPD art. 11): o aviso fica na tela.
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
  return { ok: true, valor: { inicio, fim, empresa: empresa.valor, frase: frase.valor } };
}
