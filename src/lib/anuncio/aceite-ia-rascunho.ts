/*
  64-B, item 6 — o aceite do termo de IA não some ao ir e voltar na etapa Revisar. PURO. O estado do aceite (marcado,
  versão do termo e uma impressão do título e da descrição no momento do aceite) vai no draft_data do autosave e volta
  na restauração. Se o título ou a descrição mudarem depois do aceite, ele volta a desmarcado com o aviso. O registro
  legal continua no servidor, na publicação (exigirAceiteIa).
*/
import { TERMO_IA_VERSAO } from "./termo-ia.ts";

export const AVISO_TEXTO_MUDOU = "Você mudou o texto depois de aceitar: confira e aceite de novo.";

export interface AceiteIaRascunho {
  marcado: true;
  versao: string;
  /** Impressão do título + descrição no momento do aceite (só para saber se mudou; não é segurança). */
  texto: string;
}

/** FNV-1a de 32 bits sobre o título e a descrição (espaços das pontas não contam). */
export function impressaoDoTexto(titulo: string, descricao: string): string {
  const s = `${titulo.trim()}\u0000${descricao.trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** O que vai no draft_data: o aceite marcado com a versão e a impressão do texto; desmarcado = null. */
export function aceiteParaRascunho(marcado: boolean, titulo: string, descricao: string): AceiteIaRascunho | null {
  return marcado ? { marcado: true, versao: TERMO_IA_VERSAO, texto: impressaoDoTexto(titulo, descricao) } : null;
}

/** Ao restaurar o rascunho (ou a cada mudança do texto): o aceite só vale com a versão atual e o mesmo texto. */
export function aceiteRestaurado(salvo: unknown, titulo: string, descricao: string): { marcado: boolean; aviso: string | null } {
  if (!salvo || typeof salvo !== "object") return { marcado: false, aviso: null };
  const a = salvo as Partial<AceiteIaRascunho>;
  if (a.marcado !== true || a.versao !== TERMO_IA_VERSAO || typeof a.texto !== "string") return { marcado: false, aviso: null };
  return a.texto === impressaoDoTexto(titulo, descricao) ? { marcado: true, aviso: null } : { marcado: false, aviso: AVISO_TEXTO_MUDOU };
}
