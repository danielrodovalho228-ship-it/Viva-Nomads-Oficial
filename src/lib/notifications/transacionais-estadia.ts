/*
  E267 — e-mails transacionais da ESTADIA e do ADITIVO com a régua do E264-B. PURO.
  Todo e-mail nomeia no corpo: (a) a pessoa ("Olá <primeiro nome>"), (b) o imóvel (título · bairro, cidade) e (c) o fato
  concreto — quem propôs/aceitou/recusou/assinou, o que muda, o prazo, as novas datas, o motivo do encerramento.
  Privacidade: da outra parte, só o primeiro nome; nunca o endereço exato (o "bairro" é o campo público `address`).
  Roda: node --test src/lib/notifications/transacionais-estadia.test.ts
*/
import { imovelDoPedido, type LinhaEmail } from "../parceiros/email-pedido.ts";

export type EventoEstadia =
  | "estadia_aditivo_proposto"
  | "estadia_aditivo_respondido"
  | "estadia_remarcada"
  | "estadia_encerramento_pedido"
  | "saida_sem_parceiro"
  | "sugestao_parceiros_morador";

export const EVENTOS_DA_ESTADIA: ReadonlySet<string> = new Set<EventoEstadia>([
  "estadia_aditivo_proposto",
  "estadia_aditivo_respondido",
  "estadia_remarcada",
  "estadia_encerramento_pedido",
  "saida_sem_parceiro",
  "sugestao_parceiros_morador",
]);

export interface ImovelEmail {
  titulo?: string | null;
  bairro?: string | null;
  cidade?: string | null;
}

export interface DadosEstadiaEmail {
  imovel: ImovelEmail | null;
  /** Primeiro nome de quem agiu (propôs, respondeu, assinou, pediu o encerramento). */
  quem?: string | null;
  numeroAditivo?: number | null;
  /** resumoDasMudancas: "Entrada: de 01/12/2026 para 03/12/2026 · Meses: de 2 para 4". */
  mudancas?: string | null;
  /** Prazo para responder a proposta (ISO). */
  prazo?: string | null;
  /** aditivo respondido: aceita (falta assinar), recusada (nada muda) ou assinada por quem respondeu (falta você). */
  resposta?: "aceita" | "recusada" | "assinada" | null;
  /** Período da estadia (yyyy-mm-dd). */
  entrada?: string | null;
  saida?: string | null;
  motivo?: string | null;
  /** sugestao_parceiros_morador: a ajuda é para a entrada ou para a saída. */
  momento?: "entrada" | "saida" | null;
}

const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function dia(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Data de Brasília de um instante (prazo da proposta). */
function diaBrasilia(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date(t));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")}`;
}

export function linhaImovel(im: ImovelEmail | null | undefined): string {
  return imovelDoPedido(im ?? null);
}

function periodo(d: DadosEstadiaEmail): string {
  const e = dia(d.entrada);
  const s = dia(d.saida);
  return e && s ? `${e} a ${s}` : e || s;
}

export function aberturaEstadia(ev: EventoEstadia, d: DadosEstadiaEmail, nome?: string): string {
  const ola = `Olá${nome ? " " + nome : ""}`;
  const titulo = limpo(d.imovel?.titulo);
  const de = titulo ? ` de ${titulo}` : "";
  const quem = limpo(d.quem);
  const mudancas = limpo(d.mudancas);
  const aditivo = d.numeroAditivo ? `o aditivo ${d.numeroAditivo}` : "o aditivo";
  switch (ev) {
    case "estadia_aditivo_proposto": {
      const prazo = diaBrasilia(d.prazo);
      return `${ola}, ${quem || "a outra parte"} propôs uma alteração no contrato${de}${mudancas ? `: ${mudancas}` : ""}. Aceite ou recuse ${prazo ? `até ${prazo}` : "em até 7 dias"} pela página da estadia.`;
    }
    case "estadia_aditivo_respondido":
      if (d.resposta === "recusada") return `${ola}, ${quem || "a outra parte"} recusou a sua proposta de alteração do contrato${de}. Nada muda no contrato.`;
      if (d.resposta === "assinada") return `${ola}, ${quem || "a outra parte"} assinou ${aditivo} do contrato${de}. Falta a sua assinatura para as mudanças valerem.`;
      return `${ola}, ${quem || "a outra parte"} aceitou a sua proposta de alteração do contrato${de}${mudancas ? ` (${mudancas})` : ""}. Agora as duas partes assinam ${aditivo} pela página da estadia.`;
    case "estadia_remarcada": {
      const p = periodo(d);
      return `${ola}, ${aditivo} do contrato${de} foi assinado pelas duas partes${mudancas ? `: ${mudancas}` : ""}.${p ? ` A estadia agora vai de ${p}.` : ""} Os blocos já estão atualizados na página da estadia.`;
    }
    case "estadia_encerramento_pedido":
      return `${ola}, ${quem || "a outra parte"} pediu o encerramento do contrato${de}${d.motivo ? ` (motivo: ${limpo(d.motivo).toLowerCase()})` : ""}. A Viva recebeu o pedido e vai conduzir o encerramento com vocês.`;
    case "saida_sem_parceiro":
      return `${ola}, o morador sai${titulo ? ` de ${titulo}` : ""}${d.saida ? ` em ${dia(d.saida)}` : " em 5 dias"} e o imóvel não tem limpeza fixa. Peça um orçamento a um parceiro da cidade.`;
    case "sugestao_parceiros_morador": {
      const quando = d.momento === "saida" ? (d.saida ? `a sua saída${de} em ${dia(d.saida)}` : `a sua saída${de}`) : d.entrada ? `a sua entrada em ${titulo || "seu imóvel"} em ${dia(d.entrada)}` : `a sua entrada${titulo ? ` em ${titulo}` : ""}`;
      return `${ola}, separamos parceiros da cidade para ${quando}. Peça um orçamento se quiser: nada é contratado sem você.`;
    }
  }
}

export function linhasEstadia(ev: EventoEstadia, d: DadosEstadiaEmail): LinhaEmail[] {
  const l: LinhaEmail[] = [];
  const im = linhaImovel(d.imovel);
  if (im) l.push({ rotulo: "Imóvel", valor: im });
  if (d.numeroAditivo && ev !== "estadia_encerramento_pedido") l.push({ rotulo: "Aditivo", valor: String(d.numeroAditivo) });
  if (limpo(d.mudancas) && ev !== "estadia_encerramento_pedido") l.push({ rotulo: "O que muda", valor: limpo(d.mudancas) });
  if (ev === "estadia_aditivo_proposto" && diaBrasilia(d.prazo)) l.push({ rotulo: "Responder até", valor: diaBrasilia(d.prazo) });
  if (ev === "estadia_aditivo_respondido" && d.resposta) l.push({ rotulo: "Resposta", valor: `${d.resposta === "recusada" ? "Recusada" : d.resposta === "assinada" ? "Assinada" : "Aceita"}${limpo(d.quem) ? ` por ${limpo(d.quem)}` : ""}` });
  if (ev === "estadia_encerramento_pedido") {
    if (limpo(d.quem)) l.push({ rotulo: "Pedido por", valor: limpo(d.quem) });
    if (d.motivo) l.push({ rotulo: "Motivo", valor: limpo(d.motivo) });
  }
  if (ev === "saida_sem_parceiro" && dia(d.saida)) l.push({ rotulo: "Saída", valor: dia(d.saida) });
  else if (ev === "sugestao_parceiros_morador") {
    const data = d.momento === "saida" ? dia(d.saida) : dia(d.entrada);
    if (data) l.push({ rotulo: d.momento === "saida" ? "Saída" : "Entrada", valor: data });
  } else if (periodo(d) && ev !== "saida_sem_parceiro") l.push({ rotulo: "Período", valor: periodo(d) });
  return l;
}
