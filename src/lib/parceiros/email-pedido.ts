/*
  E204 — e-mails de orçamento com VALOR e CONTEXTO (auditoria de e-mails 28/10). PURO.
    • "Novo pedido de orçamento" (→ parceiro): serviço, imóvel (título + bairro, cidade), data-limite/janela e o link do
      pedido (não "as mensagens").
    • "Você recebeu um orçamento" (→ cliente) e "Seu orçamento foi aceito" (→ parceiro): o VALOR, o serviço, o imóvel e
      a data/prazo.
  Roda: node --test src/lib/parceiros/email-pedido.test.ts
*/

export interface PedidoParaEmail {
  codigo: string;
  servico: string;
  imovel: { titulo?: string | null; bairro?: string | null; cidade?: string | null } | null;
  /** Janela do pedido automático (saída do morador). */
  janela?: { inicio: string; fim: string } | null;
  /** Horários sugeridos pelo cliente (ISO); o 1º é a data pedida. */
  horarios?: string[] | null;
  horarioConfirmado?: string | null;
  valorCombinado?: number | null;
  /** O que o parceiro recebe depois da taxa (só no e-mail do parceiro). */
  valorParceiro?: number | null;
}

export interface LinhaEmail {
  rotulo: string;
  valor: string;
}

export type EventoPedido = "parceiro_pedido_novo" | "parceiro_orcamento_recebido" | "parceiro_orcamento_aceito";

const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(Number(v)) ? 0 : 2, maximumFractionDigits: 2 })}`;

function quando(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}:${v("minute")}`;
}

/** "Apto Santa Mônica · Santa Mônica, Uberlândia" (sem imóvel: o pedido não é de um imóvel). */
export function imovelDoPedido(im: PedidoParaEmail["imovel"]): string {
  if (!im) return "";
  const titulo = limpo(im.titulo);
  const lugar = [limpo(im.bairro), limpo(im.cidade)].filter(Boolean).join(", ");
  return [titulo, lugar].filter(Boolean).join(" · ");
}

/** A data do pedido: horário confirmado > janela da saída > 1º horário sugerido. */
export function dataDoPedido(p: Pick<PedidoParaEmail, "janela" | "horarios" | "horarioConfirmado">): LinhaEmail | null {
  if (p.horarioConfirmado && quando(p.horarioConfirmado)) return { rotulo: "Data", valor: quando(p.horarioConfirmado) };
  if (p.janela && quando(p.janela.inicio) && quando(p.janela.fim)) return { rotulo: "Janela", valor: `${quando(p.janela.inicio)} a ${quando(p.janela.fim)}` };
  const h = (p.horarios ?? []).map(quando).filter(Boolean);
  if (h.length) return { rotulo: h.length > 1 ? "Datas sugeridas" : "Data sugerida", valor: h.join("; ") };
  return null;
}

export function linhasDoPedido(ev: EventoPedido, p: PedidoParaEmail): LinhaEmail[] {
  const l: LinhaEmail[] = [{ rotulo: "Serviço", valor: limpo(p.servico) || "Serviço" }];
  const im = imovelDoPedido(p.imovel);
  if (im) l.push({ rotulo: "Imóvel", valor: im });
  const d = dataDoPedido(p);
  if (d) l.push(d);
  if (ev !== "parceiro_pedido_novo" && p.valorCombinado && p.valorCombinado > 0) {
    l.push({ rotulo: "Valor", valor: brl(p.valorCombinado) });
    if (ev === "parceiro_orcamento_aceito" && p.valorParceiro && p.valorParceiro > 0) l.push({ rotulo: "Você recebe", valor: brl(p.valorParceiro) });
  }
  l.push({ rotulo: "Pedido", valor: p.codigo });
  return l;
}

export function aberturaDoPedido(ev: EventoPedido, p: PedidoParaEmail, nome?: string): string {
  const ola = `Olá${nome ? " " + nome : ""}`;
  const servico = (limpo(p.servico) || "serviço").toLowerCase();
  const titulo = limpo(p.imovel?.titulo);
  const doImovel = titulo ? ` para ${titulo}` : "";
  switch (ev) {
    case "parceiro_pedido_novo":
      return `${ola}, você recebeu um pedido de orçamento de ${servico}${doImovel}. Veja os detalhes abaixo e responda pelo pedido.`;
    case "parceiro_orcamento_recebido":
      return `${ola}, o parceiro enviou o orçamento de ${servico}${doImovel}${p.valorCombinado ? `: ${brl(p.valorCombinado)}` : ""}. Aceite ou recuse pelo pedido.`;
    case "parceiro_orcamento_aceito":
      return `Boa notícia${nome ? ", " + nome : ""}! O cliente aceitou o seu orçamento de ${servico}${doImovel}${p.valorCombinado ? ` (${brl(p.valorCombinado)})` : ""}. Confirme o horário pelo pedido.`;
  }
}
