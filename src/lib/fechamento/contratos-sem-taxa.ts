/*
  E1205 (ORDEM-DUET-979 e 1012) — a regra PURA do contrato sem taxa reservada. Uma fonte: a rotina de hora em hora (que
  avisa o dono) e a fila da Central (que mostra o item à equipe) leem daqui.
  Entra o contrato COM proposta ligada, SEM o registo da taxa dessa proposta (cobrancas_fechamento, tipo "comissao",
  chave por candidatura E proposta — 0353), criado há 30 minutos ou mais. Contrato sem proposta (direto, semeado ou
  legado) fica fora do âmbito. Nada aqui cobra: só diz quais contratos estão nessa situação.
*/
import { numeroPublicoContrato } from "../contrato-ref.ts";
import type { LinhaCentral } from "../admin/central-pendencias.ts";

/** A janela da tela entre registar o contrato e reservar a taxa: passado isto, o contrato entra na varredura. */
export const MINUTOS_SEM_TAXA = 30;

/** E1205: os textos da Central e do aviso ao dono, aprovados pelo coordenador (resposta à ORDEM-DUET-1018). */
export const TEXTOS_SEM_TAXA = {
  tituloCentral: "Contrato sem taxa reservada",
  acaoCentral: "Ver contrato",
  assuntoAviso: "Falta concluir o fechamento",
  corpoAviso: "O contrato foi gerado, mas o fechamento não terminou: falta a etapa da taxa de serviço. Abra o fechamento da estadia para concluir.",
  ctaAviso: "Concluir o fechamento",
} as const;

/** O assunto aprovado: "Falta concluir o fechamento — {título do imóvel}". */
export const assuntoDoAvisoSemTaxa = (imovel: string): string => `${TEXTOS_SEM_TAXA.assuntoAviso} — ${imovel}`;

export type ContratoDaVarredura = { id: string; lead_id: string; proposta_id: string | null; created_at: string; status: string };
export type ContratoSemTaxa = ContratoDaVarredura & { proposta_id: string };
export type ReservaDaTaxa = { lead_id: string; tipo: string; proposta_id: string | null };

/** Ajuste B do coordenador (ORDEM-DUET-1041): só o contrato ATIVO entra; cancelado, concluído e encerrados ficam fora. */
export const STATUS_DA_VARREDURA = "ativo";

/** Os contratos ATIVOS com proposta, sem a reserva da taxa dessa proposta, com MINUTOS_SEM_TAXA ou mais. */
export function contratosSemTaxa(contratos: readonly ContratoDaVarredura[], reservas: readonly ReservaDaTaxa[], agora: Date): ContratoSemTaxa[] {
  const reservada = new Set(reservas.filter((r) => r.tipo === "comissao").map((r) => `${r.lead_id}|${r.proposta_id ?? ""}`));
  const limite = agora.getTime() - MINUTOS_SEM_TAXA * 60_000;
  return contratos.filter(
    (c): c is ContratoSemTaxa =>
      c.status === STATUS_DA_VARREDURA && !!c.proposta_id && Date.parse(c.created_at) <= limite && !reservada.has(`${c.lead_id}|${c.proposta_id}`),
  );
}

/** O corpo aprovado: nomeia o contrato e a proposta (nunca só o modelo). */
export function corpoDoAvisoSemTaxa(contratoId: string, numeroProposta: string | null): (nome?: string) => string {
  const qual = `O contrato ${numeroPublicoContrato(contratoId)}${numeroProposta ? ` (proposta ${numeroProposta})` : ""}`;
  return (nome) => `Olá${nome ? `, ${nome}` : ""}. ${qual} foi gerado, mas o fechamento não terminou: falta a etapa da taxa de serviço. Abra o fechamento da estadia para concluir.`;
}

/** O assistente DAQUELA estadia (a candidatura e a proposta do contrato). */
export const hrefAssistenteDaEstadia = (leadId: string, propostaId: string): string => `/dashboard/fechamento?c=${leadId}&p=${propostaId}`;

const dataBR = (iso: string): string => {
  const d = iso.slice(0, 10);
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
};

/** O item da Central: VN-CT · proposta · data do contrato; a ação abre o contrato no admin. Sem cobrança nenhuma. */
export function linhaCentralSemTaxa(c: ContratoDaVarredura, extra: { numeroProposta: string | null; teste: boolean }): LinhaCentral {
  return {
    filtro: "contratos_sem_taxa",
    id: c.id,
    titulo: TEXTOS_SEM_TAXA.tituloCentral,
    detalhe: [numeroPublicoContrato(c.id), extra.numeroProposta ?? "Proposta", dataBR(c.created_at)].join(" · "),
    desde: c.created_at,
    prazoAte: null,
    gravidade: "alta",
    acao: { rotulo: TEXTOS_SEM_TAXA.acaoCentral, href: `/admin/contratos/${c.id}` },
    teste: extra.teste,
  };
}
