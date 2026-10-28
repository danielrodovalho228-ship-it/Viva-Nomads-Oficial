/*
  E202 — e-mails transacionais com os DADOS DA NEGOCIAÇÃO (ordem do Daniel, 28/10). Regra: todo e-mail de proposta e de
  contrato diz o imóvel (título + bairro/cidade), os valores e as datas, como já fazem o comprovante de Caução e o
  "proposta vence em menos de 24 horas". PURO (sem "@/…"): monta as linhas do quadro de dados, a frase de abertura e
  o próximo passo; quem chama só lê o banco e passa os números.
  Roda: node --test src/lib/notifications/dados-negociacao.test.ts
*/

export interface ImovelDoEmail {
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
  return lugar ? `${titulo} · ${lugar}` : titulo;
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

/** Linhas do quadro de dados de uma proposta (nova, contraproposta ou respondida). */
export function linhasProposta(o: {
  numero: string;
  imovel: ImovelDoEmail;
  entrada: string;
  saida: string;
  meses: number;
  valorMensal: number;
  /** A conta aberta do total, a mesma da tela ("4 × R$ 2.700 + preparação R$ 450 = R$ 11.250"). */
  contaTotal: string;
  /** Prazo para responder (ISO); sem prazo (proposta respondida), a linha não entra. */
  responderAte?: string | null;
}): LinhaDado[] {
  const linhas: LinhaDado[] = [
    { rotulo: "Imóvel", valor: imovelPorExtenso(o.imovel) },
    { rotulo: "Período", valor: `${dataBR(o.entrada)} a ${dataBR(o.saida)} (${meses(o.meses)})` },
    { rotulo: "Valor mensal", valor: brl(o.valorMensal) },
    { rotulo: "Total do contrato", valor: o.contaTotal },
  ];
  const prazo = dataHoraBR(o.responderAte);
  if (prazo) linhas.push({ rotulo: "Responder até", valor: prazo });
  linhas.push({ rotulo: "Proposta", valor: o.numero });
  return linhas;
}

/** Linhas do quadro de dados de um contrato (pronto para assinar ou assinado). */
export function linhasContrato(o: { imovel: ImovelDoEmail; inicio: string; fim: string; meses: number; valorMensal: number }): LinhaDado[] {
  return [
    { rotulo: "Imóvel", valor: imovelPorExtenso(o.imovel) },
    { rotulo: "Período", valor: `${dataBR(o.inicio)} a ${dataBR(o.fim)} (${meses(o.meses)})` },
    { rotulo: "Valor mensal", valor: brl(o.valorMensal) },
    { rotulo: "Total do contrato", valor: `${o.meses} × ${brl(o.valorMensal)} = ${brl(o.valorMensal * o.meses)}` },
  ];
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
