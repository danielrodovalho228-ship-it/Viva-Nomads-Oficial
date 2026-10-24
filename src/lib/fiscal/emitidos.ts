/*
  L2-B item 14 — Admin › Documentos › aba "Emitidos": a lista dos documentos do registro (REC, CAU, DEV, VIS…) com
  número, tipo, destinatário mascarado, data e status do envio, filtros por tipo e período, e "Reenviar e-mail" com
  confirmação e limite. O reenvio manda o MESMO documento (mesmo número e código de conferência): nada é reemitido.
  PURO.
*/
import { PREFIXOS, type Prefixo } from "./prefixos.ts";

export const ABA_EMITIDOS = "emitidos";
export const EMITIDOS_MAX = 200;

/** Reenvio: no máximo 3 por documento a cada 24 h e 30 por admin a cada hora (consumir_limite, falha fechada). */
export const LIMITE_REENVIO_DOCUMENTO = { maximo: 3, janelaSegundos: 24 * 60 * 60 } as const;
export const LIMITE_REENVIO_ADMIN = { maximo: 30, janelaSegundos: 60 * 60 } as const;

export const AVISO_REENVIO = "Reenviar o e-mail deste documento às partes? O número e o código de conferência continuam os mesmos.";
export const ERRO_LIMITE_REENVIO = "Limite de reenvios atingido para agora. Tente de novo mais tarde.";

export interface FiltrosEmitidos {
  tipo: Prefixo | null;
  de: string | null;
  ate: string | null;
}

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return DATA.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) ? s : null;
};

/** Filtros da URL (?tipo=REC&de=2026-10-01&ate=2026-10-31). O que não vale cai fora; período invertido é trocado. */
export function filtrosEmitidos(sp: Record<string, string | string[] | undefined>): FiltrosEmitidos {
  const um = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : (sp[k] as string | undefined));
  const t = String(um("tipo") ?? "").toUpperCase();
  const tipo = (Object.keys(PREFIXOS) as Prefixo[]).includes(t as Prefixo) ? (t as Prefixo) : null;
  let de = dataValida(um("de"));
  let ate = dataValida(um("ate"));
  if (de && ate && de > ate) [de, ate] = [ate, de];
  return { tipo, de, ate };
}

/** Período em instantes (dias de Brasília, UTC−3): de 00:00 do "de" até 00:00 do dia seguinte ao "ate". */
export function periodoEmInstantes(f: FiltrosEmitidos): { desde: string | null; antes: string | null } {
  const desde = f.de ? `${f.de}T03:00:00.000Z` : null;
  const antes = f.ate ? new Date(Date.parse(`${f.ate}T03:00:00.000Z`) + 86_400_000).toISOString() : null;
  return { desde, antes };
}

/** "maria.souza@gmail.com" → "ma***@gmail.com"; sem e-mail, null. Nunca o endereço inteiro na tela do admin. */
export function mascararEmail(email: string | null | undefined): string | null {
  const e = String(email ?? "").trim();
  const at = e.indexOf("@");
  if (at < 1) return null;
  const nome = e.slice(0, at);
  return `${nome.slice(0, Math.min(2, nome.length))}***${e.slice(at)}`;
}

export interface EnvioDoDocumento {
  papel: string;
  status: string;
}

export interface SituacaoEnvio {
  chave: "enviado" | "parcial" | "falhou" | "sem_registro" | "sem_email";
  rotulo: string;
  /** Há caminho de reenvio (documento fiscal com PDF guardado) e o documento não está anulado. */
  podeReenviar: boolean;
}

/**
 * Status do envio. Só os documentos fiscais (REC, CAU, DEV) saem por e-mail com o registro por destinatário; os
 * outros (ORC, VN-CT, VIS…) são entregues na própria plataforma e não têm reenvio aqui.
 */
export function situacaoEnvio(refTabela: string, envio: readonly EnvioDoDocumento[] | null | undefined, status: string): SituacaoEnvio {
  if (refTabela !== "documentos_fiscais") return { chave: "sem_email", rotulo: "Entregue na plataforma (sem e-mail)", podeReenviar: false };
  const pode = status !== "anulado";
  const lista = envio ?? [];
  if (!lista.length) return { chave: "sem_registro", rotulo: "Sem registro de envio", podeReenviar: pode };
  const ok = lista.filter((e) => e.status === "enviado").length;
  if (ok === lista.length) return { chave: "enviado", rotulo: `Enviado (${ok} de ${lista.length})`, podeReenviar: pode };
  if (ok > 0) return { chave: "parcial", rotulo: `Enviado a ${ok} de ${lista.length}`, podeReenviar: pode };
  return { chave: "falhou", rotulo: "Envio falhou", podeReenviar: pode };
}

/** O resultado do reenvio que vai para o registro (documentos_reenvios): papel, status e quando — nunca o endereço. */
export function resultadoParaRegistro(envio: readonly (EnvioDoDocumento & { em?: string | null })[]): { papel: string; status: string; em: string | null }[] {
  return envio.map((e) => ({ papel: String(e.papel), status: String(e.status), em: e.em ?? null }));
}
