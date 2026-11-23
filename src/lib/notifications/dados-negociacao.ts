/*
  E202 — e-mails transacionais com os DADOS DA NEGOCIAÇÃO (ordem do Daniel, 28/10). Regra: todo e-mail de proposta e de
  contrato diz o imóvel (título + bairro/cidade), os valores e as datas, como já fazem o comprovante de Caução e o
  "proposta vence em menos de 24 horas". PURO (sem "@/…"): monta as linhas do quadro de dados, a frase de abertura e
  o próximo passo; quem chama só lê o banco e passa os números.
  Roda: node --test src/lib/notifications/dados-negociacao.test.ts
*/

import { codigoDoImovel } from "../imovel-pagina.ts";
import { precoDaProposta, type TermosPreco } from "../precos.ts";
import { periodoPelaSaida, periodoPeloFim } from "../texto-do-periodo.ts";

/**
 * E1066 — o "Total do contrato" do e-mail pela fonte única (precoDaProposta: mensal, contas e limpeza — a conta da
 * proposta acordada, de que o contrato nasceu). Sem proposta acordada: null (o quadro fica com a conta de antes).
 */
export function contaDoContrato(
  acordada: { valorMensal: number; meses: number; termos: Omit<TermosPreco, "valorMensal" | "meses"> } | null,
): string | null {
  if (!acordada) return null;
  return precoDaProposta({ ...acordada.termos, valorMensal: acordada.valorMensal, meses: acordada.meses }).conta ?? null;
}

/**
 * E1085 — as contas do contrato, cada uma na sua linha, DA MESMA FONTE do total (E1066): as parcelas do mês da proposta
 * acordada além do aluguel (precoDaProposta.parcelasMes, com o rótulo da fonte), por mês. Parcela zero não entra; sem
 * proposta acordada, nenhuma linha (o quadro de antes).
 */
export function contasDoContrato(
  acordada: { valorMensal: number; meses: number; termos: Omit<TermosPreco, "valorMensal" | "meses"> } | null,
): LinhaDado[] {
  if (!acordada) return [];
  return precoDaProposta({ ...acordada.termos, valorMensal: acordada.valorMensal, meses: acordada.meses })
    .parcelasMes.slice(1)
    .filter((p) => Number(p.valor) > 0)
    .map((p) => ({ rotulo: p.rotulo, valor: `${brl(p.valor)}/mês` }));
}

export interface ImovelDoEmail {
  /** E394: o id do anúncio (vira o código VN-… no e-mail). */
  id?: string | null;
  titulo: string | null | undefined;
  /** Bairro (properties.address). */
  bairro?: string | null;
  cidade?: string | null;
}

export interface LinhaDado {
  rotulo: string;
  valor: string;
}

export type Papel = "owner" | "tenant";

const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** "Apto Santa Mônica · Saraiva, Uberlândia" (sem bairro/cidade, só o título; sem título, "o imóvel"). */
export function imovelPorExtenso(im: ImovelDoEmail): string {
  const titulo = limpo(im.titulo) || "Imóvel";
  const lugar = [limpo(im.bairro), limpo(im.cidade)].filter(Boolean).join(", ");
  // E394: título + lugar + código (VN-…): o mesmo "Imóvel" em todos os e-mails transacionais.
  const codigo = limpo(im.id) ? `código ${codigoDoImovel(limpo(im.id))}` : "";
  return [titulo, lugar, codigo].filter(Boolean).join(" · ");
}

export const brl = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(Number(v)) ? 0 : 2, maximumFractionDigits: 2 })}`;

/** AAAA-MM-DD (ou ISO) → DD/MM/AAAA, sem fuso (a data é do calendário). */
export function dataBR(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Instante (ISO com hora) → "DD/MM/AAAA às HH:MM" no horário de Brasília. */
export function dataHoraBR(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}:${v("minute")}`;
}

const meses = (n: number) => `${n} ${n === 1 ? "mês" : "meses"}`;

/**
 * E210: "DD/MM/AAAA a DD/MM/AAAA (N meses)" com as datas reais. Sem as duas datas, nunca "a " vazio: só os meses
 * (o contrato sem blocos não tem período gravado — em produção, todo contrato tem blocos).
 */
export function textoPeriodo(inicio: string | null | undefined, fim: string | null | undefined, n: number, dias?: number | null): string {
  const de = dataBR(inicio);
  const ate = dataBR(fim);
  // E562: estadia em dias exatos que não fecha meses cheios → "(43 dias)".
  const duracao = dias != null && dias > 0 && dias % 30 !== 0 ? `${dias} dias` : meses(n);
  return de && ate ? `${de} a ${ate} (${duracao})` : duracao;
}

/** Linhas do quadro de dados de uma proposta (nova, contraproposta ou respondida). */
export function linhasProposta(o: {
  numero: string;
  imovel: ImovelDoEmail;
  entrada: string;
  saida: string;
  meses: number;
  /** E562: dias exatos da estadia (vazio = meses cheios). */
  dias?: number | null;
  valorMensal: number;
  /** A conta aberta do total, a mesma da tela ("4 × R$ 2.700 + preparação R$ 450 = R$ 11.250"). */
  contaTotal: string;
  /** Prazo para responder (ISO); sem prazo (proposta respondida), a linha não entra. */
  responderAte?: string | null;
  /** E1058: a linha da caução do ecrã da proposta (rótulo e valor já prontos, caucaoDaProposta); sem ela, não entra. */
  caucao?: LinhaDado | null;
}): LinhaDado[] {
  const linhas: LinhaDado[] = [
    { rotulo: "Imóvel", valor: imovelPorExtenso(o.imovel) },
    // E1089: uma só forma em toda superfície — "Entrada DD/MM/AAAA · Saída DD/MM/AAAA · N diárias" (saída = entrada + dias).
    { rotulo: "Período", valor: periodoPelaSaida(o.entrada, o.saida)?.linha ?? textoPeriodo(o.entrada, o.saida, o.meses, o.dias) },
    { rotulo: "Valor mensal", valor: brl(o.valorMensal) },
    // E562 (telas): estadia em dias exatos → o mesmo rótulo do anúncio e da montagem, "Total da estadia (43 dias)".
    { rotulo: o.dias != null && o.dias > 0 && o.dias % 30 !== 0 ? `Total da estadia (${o.dias} dias)` : "Total do contrato", valor: o.contaTotal },
  ];
  if (o.caucao) linhas.push(o.caucao);
  const prazo = dataHoraBR(o.responderAte);
  if (prazo) linhas.push({ rotulo: "Responder até", valor: prazo });
  linhas.push({ rotulo: "Proposta", valor: o.numero });
  return linhas;
}

/**
 * E599 (reprova de 05/11): a DATA DE SAÍDA de um período cujo fim gravado é a ÚLTIMA NOITE (fim inclusivo dos blocos do
 * contrato) — o dia seguinte. É a mesma data da proposta, da candidatura e do formulário (saída = entrada + dias): o
 * e-mail nunca imprime a última noite como saída ("10/01 a 21/02 (43 dias)" — um dia antes e uma conta que não fecha).
 */
export function saidaDepoisDaUltimaNoite(fimInclusivoISO: string | null | undefined): string {
  const f = String(fimInclusivoISO ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return "";
  const d = new Date(`${f}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Linhas do quadro de dados de um contrato (pronto para assinar ou assinado). `fim` é o fim gravado nos blocos do
 * contrato. E671: o período impresso vai da entrada até esse fim — a MESMA data de saída da página do contrato, da
 * estadia e dos calendários (e do prazo da conferência de saída). A proposta e a candidatura seguem com entrada + dias (E599).
 */
export function linhasContrato(o: {
  imovel: ImovelDoEmail;
  inicio: string;
  fim: string;
  meses: number;
  valorMensal: number;
  dias?: number | null;
  /** E1066: a conta da fonte única (contaDoContrato); vazia → a conta de antes, só o aluguel. */
  contaTotal?: string | null;
  /** E1066: a caução dos blocos do contrato; 0 ou vazia (seguro-fiança) → sem a linha. */
  caucao?: number | null;
  /** E1085: as contas do mês (contasDoContrato), cada uma na sua linha, logo depois do valor mensal. */
  contas?: readonly LinhaDado[] | null;
}): LinhaDado[] {
  // E562: contrato em dias exatos → "R$ 3.000 × 43 dias ÷ 30 = R$ 4.300" (em meses cheios, como antes).
  const emDias = o.dias != null && o.dias > 0 && o.dias % 30 !== 0;
  const soAluguel = emDias
    ? `${brl(o.valorMensal)} × ${o.dias} dias ÷ 30 = ${brl(Math.round(((o.valorMensal * (o.dias as number)) / 30) * 100) / 100)}`
    : `${o.meses} × ${brl(o.valorMensal)} = ${brl(o.valorMensal * o.meses)}`;
  const linhas: LinhaDado[] = [
    { rotulo: "Imóvel", valor: imovelPorExtenso(o.imovel) },
    // E1089 (coordenador): `fim` é a ÚLTIMA NOITE gravada nos blocos; o e-mail imprime a SAÍDA (o dia seguinte), a mesma
    // data da proposta — "Entrada 23/11/2026 · Saída 24/12/2026 · 31 diárias".
    { rotulo: "Período", valor: periodoPeloFim(o.inicio, o.fim)?.linha ?? textoPeriodo(o.inicio, o.fim, o.meses, o.dias) },
    { rotulo: "Valor mensal", valor: brl(o.valorMensal) },
    ...(o.contas ?? []),
    { rotulo: "Total do contrato", valor: o.contaTotal || soAluguel },
  ];
  if (o.caucao != null && Number(o.caucao) > 0) linhas.push({ rotulo: "Caução", valor: brl(Number(o.caucao)) });
  return linhas;
}

export type Desfecho = "nova" | "contraproposta" | "aceita" | "recusada";

/** Frase de abertura do e-mail de proposta: diz o desfecho e o imóvel no próprio corpo. */
export function aberturaProposta(d: Desfecho, o: { nome?: string; imovel: ImovelDoEmail; novoValorMensal?: number; motivo?: string | null }): string {
  const ola = `Olá${o.nome ? " " + o.nome : ""}`;
  const titulo = limpo(o.imovel.titulo) || "o imóvel";
  switch (d) {
    case "nova":
      return `${ola}, você recebeu uma proposta para ${titulo}. Os valores e o prazo estão abaixo.`;
    case "contraproposta":
      return `${ola}, chegou uma contraproposta para ${titulo}: o valor mensal agora é ${brl(o.novoValorMensal ?? 0)}. Os valores e o prazo estão abaixo.`;
    case "aceita":
      return `${ola}, a proposta para ${titulo} foi aceita.`;
    case "recusada":
      return `${ola}, a proposta para ${titulo} foi recusada${o.motivo ? `. Motivo: ${limpo(o.motivo)}` : ""}.`;
  }
}

/** O próximo passo de cada desfecho, para quem recebe o e-mail. */
export function proximoPassoProposta(d: Desfecho, quemRecebe: Papel): string {
  switch (d) {
    case "nova":
    case "contraproposta":
      return "Próximo passo: aceite, faça uma contraproposta ou recuse pela plataforma, antes do prazo.";
    case "aceita":
      return quemRecebe === "owner"
        ? "Próximo passo: gere o contrato no Fechamento. O morador assina pela plataforma."
        : "Próximo passo: o proprietário gera o contrato. Você recebe um e-mail para assinar.";
    case "recusada":
      return quemRecebe === "tenant"
        ? "Próximo passo: você pode buscar outros imóveis ou conversar com o proprietário pela plataforma."
        : "Próximo passo: você pode enviar uma nova proposta ou conversar com o interessado pela plataforma.";
  }
}

/** Contrato pronto para assinar (→ morador). Não há prazo de assinatura no sistema: o e-mail não inventa um. */
export function aberturaContratoPronto(o: { nome?: string; imovel: ImovelDoEmail }): string {
  return `Olá${o.nome ? " " + o.nome : ""}, o contrato de ${limpo(o.imovel.titulo) || "seu imóvel"} está pronto para você assinar. Confira os dados abaixo.`;
}
export const PROXIMO_PASSO_CONTRATO_PRONTO = "Próximo passo: leia o resumo e assine pela plataforma, com o código enviado ao seu e-mail.";

/** A outra parte assinou e falta quem recebe; ou as duas já assinaram. */
export function aberturaAssinatura(o: { nome?: string; imovel: ImovelDoEmail; asDuas: boolean; quemAssinou: Papel }): string {
  const ola = `Olá${o.nome ? " " + o.nome : ""}`;
  const titulo = limpo(o.imovel.titulo) || "o imóvel";
  if (o.asDuas) return `${ola}, o contrato de ${titulo} está assinado pelas duas partes.`;
  return `${ola}, ${o.quemAssinou === "owner" ? "o proprietário" : "o morador"} assinou o contrato de ${titulo}. Falta a sua assinatura.`;
}

/** Próximo passo depois das assinaturas: Caução e 1º pagamento, e onde registrar na plataforma. */
export function proximoPassoAssinatura(asDuas: boolean, quemRecebe: Papel): string {
  if (!asDuas) return "Próximo passo: assine pela plataforma, com o código enviado ao seu e-mail.";
  return quemRecebe === "tenant"
    ? "Próximo passo: pague a Caução e o 1º pagamento direto ao proprietário, como combinado no contrato. Depois, confirme o pagamento na página da sua estadia."
    : "Próximo passo: quando receber a Caução e o 1º pagamento, registre o recebimento no contrato, em Contratos.";
}
