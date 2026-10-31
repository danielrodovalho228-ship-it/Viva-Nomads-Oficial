/*
  E204 — e-mails de orçamento com VALOR e CONTEXTO (auditoria de e-mails 28/10). PURO.
    • "Novo pedido de orçamento" (→ parceiro): serviço, imóvel (título + bairro, cidade), data-limite/janela e o link do
      pedido (não "as mensagens").
    • "Você recebeu um orçamento" (→ cliente) e "Seu orçamento foi aceito" (→ parceiro): o VALOR, o serviço, o imóvel e
      a data/prazo.
  E267 — a mesma régua em TODOS os e-mails do pedido de serviço (e do pedido automático da estadia): o corpo nomeia a
  pessoa, o imóvel (título · bairro, cidade) e o fato concreto — o horário confirmado, a nova data, quem marcou a
  entrega, por que o pedido foi cancelado. Da outra parte, só o primeiro nome (ou o nome público do parceiro).
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
  /** E267: a outra parte — o primeiro nome do cliente (para o parceiro) ou o nome público do parceiro (para o cliente). */
  outraParte?: string | null;
}

/** E267: o fato que o evento conta e que o pedido sozinho não guarda. */
export interface FatoDoPedido {
  /** Horário que o parceiro propôs e o cliente ainda confirma (parceiro_horario_confirmado sem horário confirmado). */
  horarioProposto?: string | null;
  /** pedido_auto_atualizado: renovação aceita (reagendar) × remarcação ainda sem aceite. */
  reagendado?: boolean;
  /** pedido_auto_cancelado: a saída mudou (com a nova data) ou o contrato foi encerrado. */
  cancelamento?: { motivo: "saida_remarcada" | "nova_data_recusada" | "contrato_encerrado"; novaSaida?: string | null };
  /** parceiro_pedido_recusado: o parceiro recusou a NOVA data da renovação (cancelado ou de volta a esperar). */
  novaDataRecusada?: { cancelado: boolean };
}

export interface LinhaEmail {
  rotulo: string;
  valor: string;
}

export type EventoPedido =
  | "parceiro_pedido_novo"
  | "parceiro_orcamento_recebido"
  | "parceiro_orcamento_aceito"
  // E267
  | "parceiro_pedido_recusado"
  | "parceiro_horario_confirmado"
  | "parceiro_lembrete"
  | "parceiro_entrega_feita"
  | "parceiro_conclusao_pendente"
  | "parceiro_avaliacao"
  | "pedido_auto_confirmar"
  | "pedido_auto_sem_resposta"
  | "pedido_auto_atualizado"
  | "pedido_auto_cancelado";

export const EVENTOS_DO_PEDIDO: ReadonlySet<string> = new Set<EventoPedido>([
  "parceiro_pedido_novo",
  "parceiro_orcamento_recebido",
  "parceiro_orcamento_aceito",
  "parceiro_pedido_recusado",
  "parceiro_horario_confirmado",
  "parceiro_lembrete",
  "parceiro_entrega_feita",
  "parceiro_conclusao_pendente",
  "parceiro_avaliacao",
  "pedido_auto_confirmar",
  "pedido_auto_sem_resposta",
  "pedido_auto_atualizado",
  "pedido_auto_cancelado",
]);

const limpo = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const brl = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: Number.isInteger(Number(v)) ? 0 : 2, maximumFractionDigits: 2 })}`;

export function quando(iso: string | null | undefined): string {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return "";
  const p = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}:${v("minute")}`;
}

/** "05/12/2026" (data pura, yyyy-mm-dd ou ISO). */
function dia(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
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

export function linhasDoPedido(ev: EventoPedido, p: PedidoParaEmail, fato: FatoDoPedido = {}): LinhaEmail[] {
  const l: LinhaEmail[] = [{ rotulo: "Serviço", valor: limpo(p.servico) || "Serviço" }];
  const im = imovelDoPedido(p.imovel);
  if (im) l.push({ rotulo: "Imóvel", valor: im });
  const d = dataDoPedido(p);
  if (d) l.push(d);
  if (ev === "parceiro_horario_confirmado" && !p.horarioConfirmado && quando(fato.horarioProposto)) l.push({ rotulo: "Horário proposto", valor: quando(fato.horarioProposto) });
  if (ev === "pedido_auto_cancelado" && fato.cancelamento?.novaSaida && dia(fato.cancelamento.novaSaida)) l.push({ rotulo: "Nova saída", valor: dia(fato.cancelamento.novaSaida) });
  if (ev !== "parceiro_pedido_novo" && p.valorCombinado && p.valorCombinado > 0) {
    l.push({ rotulo: "Valor", valor: brl(p.valorCombinado) });
    if (ev === "parceiro_orcamento_aceito" && p.valorParceiro && p.valorParceiro > 0) l.push({ rotulo: "Você recebe", valor: brl(p.valorParceiro) });
  }
  l.push({ rotulo: "Pedido", valor: p.codigo });
  return l;
}

/**
 * E270 — o assunto que diz o fato (hoje só o orçamento recebido: o valor e o serviço, antes só no corpo).
 * null = o assunto do evento (eventos-email.ts).
 */
export function assuntoDoPedido(ev: EventoPedido, p: PedidoParaEmail): string | null {
  if (ev === "parceiro_orcamento_recebido" && p.valorCombinado && p.valorCombinado > 0) return `Orçamento de ${brl(p.valorCombinado)} para ${limpo(p.servico) || "o seu pedido"}`;
  return null;
}

export function aberturaDoPedido(ev: EventoPedido, p: PedidoParaEmail, nome?: string, fato: FatoDoPedido = {}): string {
  const ola = `Olá${nome ? " " + nome : ""}`;
  const servico = (limpo(p.servico) || "serviço").toLowerCase();
  const titulo = limpo(p.imovel?.titulo);
  const doImovel = titulo ? ` para ${titulo}` : "";
  const em = titulo ? ` em ${titulo}` : "";
  const outra = limpo(p.outraParte);
  const data = dataDoPedido(p);
  switch (ev) {
    case "parceiro_pedido_recusado":
      if (fato.novaDataRecusada)
        return fato.novaDataRecusada.cancelado
          ? `${ola}, ${outra || "o parceiro"} recusou a nova data do serviço de ${servico}${em}. O pedido foi cancelado e volta a ser feito perto da nova saída.`
          : `${ola}, ${outra || "o parceiro"} recusou a nova data do serviço de ${servico}${em}. O pedido voltou a esperar a resposta dele; sem resposta em 24 horas, você troca de parceiro pelo pedido.`;
      return `${ola}, ${outra || "o parceiro"} recusou o pedido de ${servico}${doImovel}. Você pode pedir a outro parceiro pela plataforma.`;
    case "parceiro_horario_confirmado": {
      // E267 (resíduo): as duas cópias dizem com quem — o parceiro (para o cliente) ou o cliente (para o parceiro).
      if (p.horarioConfirmado && quando(p.horarioConfirmado)) return `${ola}, o horário do serviço de ${servico}${em}${outra ? ` com ${outra}` : ""} está confirmado: ${quando(p.horarioConfirmado)} (horário de Brasília).`;
      const proposto = quando(fato.horarioProposto);
      return `${ola}, ${outra || "o parceiro"} propôs outro horário para o serviço de ${servico}${em}${proposto ? `: ${proposto} (horário de Brasília)` : ""}. Confirme pelo pedido.`;
    }
    case "parceiro_lembrete":
      return `${ola}, o serviço de ${servico}${em} está marcado para ${quando(p.horarioConfirmado) || "as próximas horas"} (horário de Brasília).`;
    case "parceiro_entrega_feita":
      return `${ola}, ${outra || "o parceiro"} marcou o serviço de ${servico}${em} como entregue. Confira e confirme a conclusão pelo pedido.`;
    case "parceiro_conclusao_pendente":
      return `${ola}, ${outra || "o parceiro"} marcou a entrega do serviço de ${servico}${em} há 7 dias. Se está tudo certo, confirme a conclusão; se não, fale com o parceiro pelas mensagens do pedido. Nada é concluído sem você.`;
    case "parceiro_avaliacao":
      return `${ola}, o serviço de ${servico}${em}${outra ? ` com ${outra}` : ""} foi concluído. A sua avaliação ajuda outras pessoas e só aparece depois que as duas partes avaliarem.`;
    case "pedido_auto_confirmar":
      return `${ola}, a Viva preparou o pedido de ${servico}${doImovel}${outra ? ` com ${outra}` : ""}${data ? ` (${data.rotulo.toLowerCase()}: ${data.valor})` : ""}. Confira o valor-base e confirme com 1 toque.`;
    case "pedido_auto_sem_resposta":
      return `${ola}, ${outra || "o parceiro"} não respondeu em 24 horas ao pedido de ${servico}${doImovel}. Você pode esperar ou trocar de parceiro com 1 toque.`;
    case "pedido_auto_atualizado":
      return fato.reagendado
        ? `${ola}, a estadia${em} foi renovada e a data do serviço de ${servico}${outra ? ` pedido por ${outra}` : ""} mudou${data ? ` (${data.rotulo.toLowerCase()}: ${data.valor})` : ""}. Confirme um dos novos horários ou recuse a nova data pelo pedido. O valor combinado continua o mesmo.`
        : `${ola}, a estadia${em} foi remarcada e a data do serviço de ${servico}${outra ? ` pedido por ${outra}` : ""} mudou${data ? ` (${data.rotulo.toLowerCase()}: ${data.valor})` : ""}. Confira pelo pedido.`;
    case "pedido_auto_cancelado": {
      const c = fato.cancelamento;
      const dequem = outra ? ` feito por ${outra}` : "";
      if (!c || c.motivo === "contrato_encerrado") return `${ola}, o contrato${em} foi encerrado e o pedido de ${servico}${dequem} foi cancelado. Nada a fazer.`;
      const nova = dia(c.novaSaida);
      const porque = c.motivo === "nova_data_recusada" ? "você recusou a nova data" : "a saída do morador mudou";
      return `${ola}, ${porque}${nova ? ` (nova saída: ${nova})` : ""} e o pedido de ${servico}${dequem}${em} foi cancelado. O pedido volta a ser feito perto da nova data.`;
    }
    case "parceiro_pedido_novo":
      return `${ola}, você recebeu um pedido de orçamento de ${servico}${doImovel}. Veja os detalhes abaixo e responda pelo pedido.`;
    case "parceiro_orcamento_recebido":
      return `${ola}, o parceiro enviou o orçamento de ${servico}${doImovel}${p.valorCombinado ? `: ${brl(p.valorCombinado)}` : ""}. Aceite ou recuse pelo pedido.`;
    case "parceiro_orcamento_aceito":
      return `Boa notícia${nome ? ", " + nome : ""}! O cliente aceitou o seu orçamento de ${servico}${doImovel}${p.valorCombinado ? ` (${brl(p.valorCombinado)})` : ""}. Confirme o horário pelo pedido.`;
  }
}
