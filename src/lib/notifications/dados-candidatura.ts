/*
  E202 (candidatura, QA do Muse 29/10) — os três e-mails do caminho da CANDIDATURA (Solicitar → Interessados →
  Aprovar) com os mesmos dados do pacote E202–E206: imóvel, interessado, entrada/saída, valor mensal, total por mês e
  total da estadia, o próximo passo e um link desta candidatura (não a lista genérica). PURO (sem "@/…"): quem chama
  lê o banco e passa os números.
  Roda: node --test src/lib/notifications/dados-candidatura.test.ts
*/
import { brl, dataBR, imovelPorExtenso, type ImovelDoEmail, type LinhaDado } from "./dados-negociacao.ts";

export type MomentoCandidatura = "nova" | "enviada" | "aceita";

export interface DadosCandidatura {
  imovel: ImovelDoEmail;
  /** Primeiro nome de quem se candidatou (o dono não vê nome completo antes do aceite). */
  interessado: string;
  /** AAAA-MM-DD; vazio = "A combinar com o proprietário". */
  entrada?: string | null;
  saida?: string | null;
  valorMensal: number;
  /** Custo total do mês (calcularTotalMensal), o mesmo "Total por mês" da tela do Solicitar. */
  totalMensal: number;
}

const A_COMBINAR = "A combinar com o proprietário";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Dias e meses do período (30 dias = 1 mês, arredonda para cima — a mesma conta de mesesDaSelecao). */
export function periodoDaCandidatura(entrada?: string | null, saida?: string | null): { dias: number; meses: number } | null {
  const de = String(entrada ?? "").slice(0, 10);
  const ate = String(saida ?? "").slice(0, 10);
  if (!ISO.test(de) || !ISO.test(ate) || ate <= de) return null;
  const dias = Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
  return { dias, meses: Math.max(1, Math.ceil(dias / 30)) };
}

/** Quadro de dados da candidatura: o mesmo nos três e-mails. */
export function linhasCandidatura(d: DadosCandidatura): LinhaDado[] {
  const p = periodoDaCandidatura(d.entrada, d.saida);
  const linhas: LinhaDado[] = [
    { rotulo: "Imóvel", valor: imovelPorExtenso(d.imovel) },
    { rotulo: "Interessado", valor: limpo(d.interessado) || "Interessado" },
    { rotulo: "Entrada", valor: dataBR(d.entrada) || A_COMBINAR },
    { rotulo: "Saída", valor: dataBR(d.saida) ? `${dataBR(d.saida)}${p ? ` (${p.dias} ${p.dias === 1 ? "dia" : "dias"})` : ""}` : A_COMBINAR },
    { rotulo: "Valor mensal", valor: brl(d.valorMensal) },
    { rotulo: "Total por mês", valor: brl(d.totalMensal) },
  ];
  // Sem o período completo não há total da estadia (nunca um número inventado).
  if (p) linhas.push({ rotulo: "Total da estadia", valor: `${brl(Math.round(d.totalMensal * 100 * p.meses) / 100)} em ${p.meses} ${p.meses === 1 ? "mês" : "meses"}` });
  return linhas;
}

/** Frase de abertura de cada momento, com o imóvel no corpo. */
export function aberturaCandidatura(m: MomentoCandidatura, o: { nome?: string; imovel: ImovelDoEmail; interessado?: string }): string {
  const ola = `Olá${o.nome ? " " + o.nome : ""}`;
  const titulo = limpo(o.imovel.titulo) || "o imóvel";
  switch (m) {
    case "nova":
      return `${ola}, ${limpo(o.interessado) || "um interessado"} enviou uma candidatura para ${titulo}. Os dados do pedido estão abaixo.`;
    case "enviada":
      return `${ola}, sua candidatura para ${titulo} foi enviada. O proprietário já foi avisado. Os dados do pedido estão abaixo.`;
    case "aceita":
      return `${ola}, o proprietário aceitou sua candidatura para ${titulo}. Os dados do pedido estão abaixo.`;
  }
}

/** O próximo passo de quem recebe. */
export function proximoPassoCandidatura(m: MomentoCandidatura): string {
  switch (m) {
    case "nova":
      return "Próximo passo: aprove ou recuse a candidatura em Interessados. Ao aprovar, você segue para o Fechamento.";
    case "enviada":
      return "Próximo passo: aguarde a resposta do proprietário. Você recebe um e-mail quando ele responder; acompanhe em Minhas candidaturas.";
    case "aceita":
      return "Próximo passo: a conversa está liberada em Mensagens. O proprietário monta o contrato no Fechamento e você recebe um e-mail para assinar.";
  }
}

/** Links desta candidatura: o cartão em Interessados (dono) e em Minhas candidaturas (morador). */
export const linkCandidaturaDono = (leadId: string) => `/dashboard/leads#candidato-${leadId}`;
export const linkCandidaturaMorador = (leadId: string) => `/dashboard/candidaturas#candidatura-${leadId}`;
