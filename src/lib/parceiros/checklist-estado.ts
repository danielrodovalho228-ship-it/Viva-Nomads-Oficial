/**
 * Prompt 36, item 4 — confirmação visual por item no checklist da ficha de parceria (/admin/parceiros).
 * Antes, o item gravava mas nada na tela dizia; agora cada item mostra "Salvando…", "Salvo" ou o erro com
 * "Tentar de novo". Puro (node --test); o componente só guarda este estado.
 */

export type EstadoItem = { fase: "salvando"; valor: boolean } | { fase: "salvo"; valor: boolean } | { fase: "erro"; valor: boolean; erro: string };
export type EstadosChecklist = Record<string, EstadoItem>;

export const TEXTO_SALVO = "Salvo";
export const TEXTO_SALVANDO = "Salvando…";
export const TEXTO_TENTAR_DE_NOVO = "Tentar de novo";
export const ERRO_PADRAO_CHECKLIST = "Não foi possível salvar.";

/** O item começou a gravar (o quadrado já mostra o valor pedido). */
export function comecarSalvar(estados: EstadosChecklist, chave: string, valor: boolean): EstadosChecklist {
  return { ...estados, [chave]: { fase: "salvando", valor } };
}

/** O servidor respondeu: "Salvo" ou o erro (com o valor que a pessoa pediu, para "Tentar de novo"). */
export function terminarSalvar(estados: EstadosChecklist, chave: string, r: { ok: true } | { ok: false; erro?: string }): EstadosChecklist {
  const atual = estados[chave];
  const valor = atual?.valor ?? false;
  if (r.ok) return { ...estados, [chave]: { fase: "salvo", valor } };
  return { ...estados, [chave]: { fase: "erro", valor, erro: (!r.ok && r.erro) || ERRO_PADRAO_CHECKLIST } };
}

/** Algum item ainda gravando? (os quadrados ficam travados para duas gravações não se atropelarem) */
export function algumSalvando(estados: EstadosChecklist): boolean {
  return Object.values(estados).some((e) => e.fase === "salvando");
}

/** O que o quadrado mostra: o valor pedido enquanto grava ou depois de salvo; o do servidor depois de um erro. */
export function valorExibido(estados: EstadosChecklist, chave: string, doServidor: boolean): boolean {
  const e = estados[chave];
  if (!e || e.fase === "erro") return doServidor;
  return e.valor;
}
