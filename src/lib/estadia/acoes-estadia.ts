/*
  "Cogumelo" (Prompt 41, item 4) — PURO. Botão flutuante só no contexto de UMA estadia (o detalhe do contrato, para o
  morador e o proprietário daquela estadia), que abre a folha "Ações desta estadia" com SÓ as ações cuja função já
  existe hoje. Nunca no cogumelo: cancelar contrato, avaliar, pagar, links genéricos.

  Entraram (função existente na main):
    - Falar com o proprietário / Falar com o morador → /dashboard/mensagens (a conversa da estadia está lá)
    - Ver o contrato → o resumo do contrato nesta mesma tela (#contrato)
    - Ver instruções de chegada → o painel de check-in desta tela (#checkin-painel), quando ele aparece
    - Pedir manutenção (só o morador, estadia ativa) → /dashboard/solicitacoes (chamados ligados ao contrato)
  Esperam (a função ainda não existe ligada à estadia): ver ACOES_QUE_ESPERAM.
*/
import type { PapelContrato } from "../contrato-assinar.ts";

export type ChaveAcaoEstadia = "falar" | "contrato" | "instrucoes" | "manutencao";

export interface AcaoEstadia {
  chave: ChaveAcaoEstadia;
  rotulo: string;
  href: string;
}

/** O que ainda não entra no cogumelo e por quê (vai no relatório do PR e na guarda). */
export const ACOES_QUE_ESPERAM: { rotulo: string; motivo: string }[] = [
  { rotulo: "Pedir limpeza", motivo: "Não há pedido de limpeza ligado à estadia; os parceiros de limpeza (31b) são uma busca geral." },
  { rotulo: "Avisar um problema", motivo: "Não há um aviso de problema da estadia; o \"Não consegui entrar\" mora no check-in e a manutenção tem o próprio item." },
  { rotulo: "Propor alteração de datas", motivo: "Depende do Prompt 32 (ainda não existe)." },
];

/** Nunca no cogumelo (regra do Prompt 41). */
export const PROIBIDAS_NO_COGUMELO = /cancelar|avaliar|avalia|pagar|pagamento/i;

export function acoesDaEstadia(p: {
  papel: PapelContrato;
  /** Status do contrato (ativo, concluido, …). */
  status: string;
  /** O painel de instruções de entrada aparece nesta tela. */
  temInstrucoes: boolean;
}): AcaoEstadia[] {
  const out: AcaoEstadia[] = [
    { chave: "falar", rotulo: p.papel === "inquilino" ? "Falar com o proprietário" : "Falar com o morador", href: "/dashboard/mensagens" },
    { chave: "contrato", rotulo: "Ver o contrato", href: "#contrato" },
  ];
  if (p.temInstrucoes) out.push({ chave: "instrucoes", rotulo: "Ver instruções de chegada", href: "#checkin-painel" });
  if (p.papel === "inquilino" && p.status === "ativo") out.push({ chave: "manutencao", rotulo: "Pedir manutenção", href: "/dashboard/solicitacoes" });
  return out;
}
