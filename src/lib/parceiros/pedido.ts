/*
  Contratação de parceiros (Prompt 31b) — regras PURAS do pedido: estados, teto de orçamentos abertos, horários,
  valores congelados no aceite, privacidade antes do aceite e textos. Sem banco e sem tela.
  A Viva só conecta: nunca guarda dinheiro. Taxa de serviço de 10% sobre o valor do serviço, todas as categorias.
*/
import { dividirValor, TAXA_SERVICO_PARCEIRO } from "./regras.ts";
import { lerReais } from "../reais.ts";

// ── Estados ───────────────────────────────────────────────────────────────────────────────────────────────────
export const STATUS_PEDIDO = [
  "solicitado",
  "orcado",
  "aceito",
  "agendado",
  "em_execucao",
  "entregue",
  "concluido",
  "recusado",
  "cancelado",
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];
export type PapelNoPedido = "cliente" | "parceiro";

/** Ações do pedido: quem pode, de qual estado e para qual estado. Qualquer outra combinação é recusada. */
export const TRANSICOES = {
  orcar: { quem: "parceiro", de: ["solicitado", "orcado"], para: "orcado" }, // reenviar ajusta o valor
  recusar_pedido: { quem: "parceiro", de: ["solicitado", "orcado"], para: "recusado" },
  aceitar_orcamento: { quem: "cliente", de: ["orcado"], para: "aceito" },
  recusar_orcamento: { quem: "cliente", de: ["orcado"], para: "cancelado" },
  cancelar: { quem: "cliente", de: ["solicitado"], para: "cancelado" },
  confirmar_horario: { quem: "parceiro", de: ["aceito"], para: "agendado" },
  confirmar_horario_proposto: { quem: "cliente", de: ["aceito"], para: "agendado" }, // outro horário do parceiro
  iniciar: { quem: "parceiro", de: ["agendado"], para: "em_execucao" },
  entregar: { quem: "parceiro", de: ["em_execucao"], para: "entregue" },
  concluir: { quem: "cliente", de: ["entregue"], para: "concluido" },
} as const satisfies Record<string, { quem: PapelNoPedido; de: readonly StatusPedido[]; para: StatusPedido }>;
export type AcaoPedido = keyof typeof TRANSICOES;

export function podeFazer(acao: AcaoPedido, status: string, papel: PapelNoPedido): boolean {
  const t = TRANSICOES[acao];
  return t.quem === papel && (t.de as readonly string[]).includes(status);
}

/** "Em aberto" para o teto: ainda esperando orçamento ou decisão. */
export const STATUS_ABERTOS: readonly StatusPedido[] = ["solicitado", "orcado"];
export const TETO_ABERTOS_POR_CATEGORIA = 3;

export function tetoAtingido(abertosNaCategoria: number): boolean {
  return abertosNaCategoria >= TETO_ABERTOS_POR_CATEGORIA;
}
export function textoTeto(rotuloCategoriaMinusculo: string): string {
  return `Você já tem ${TETO_ABERTOS_POR_CATEGORIA} orçamentos abertos em ${rotuloCategoriaMinusculo}: feche um para pedir outro.`;
}

// ── Entrada do pedido ─────────────────────────────────────────────────────────────────────────────────────────
export const DESCRICAO_PEDIDO_MAX = 1000;
export const HORARIOS_MAX = 3;
export const MOTIVO_RECUSA_MAX = 120;

export interface JanelaAgenda {
  /** 0 = domingo … 6 = sábado (dia da semana em Brasília). */
  dia: number;
  /** "08:00" … "18:00" (horário de Brasília). */
  inicio: string;
  fim: string;
}
export interface BloqueioAgenda {
  inicio: string; // ISO
  fim: string; // ISO
}

const FUSO = "America/Sao_Paulo";
function diaEHoraBrasilia(iso: string): { dia: number; hhmm: string } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: FUSO, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const wd = partes.find((p) => p.type === "weekday")?.value ?? "";
  const h = (partes.find((p) => p.type === "hour")?.value ?? "00").replace("24", "00");
  const m = partes.find((p) => p.type === "minute")?.value ?? "00";
  return { dia: dias.indexOf(wd), hhmm: `${h}:${m}` };
}

/** O horário cabe na agenda do parceiro (janela do dia da semana) e não cai num bloqueio. Agenda vazia = sem restrição. */
export function horarioNaAgenda(iso: string, janelas: JanelaAgenda[], bloqueios: BloqueioAgenda[], agora: Date): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= agora.getTime()) return false;
  if (bloqueios.some((b) => t >= Date.parse(b.inicio) && t < Date.parse(b.fim))) return false;
  if (janelas.length === 0) return true;
  const x = diaEHoraBrasilia(iso);
  if (!x) return false;
  return janelas.some((j) => j.dia === x.dia && x.hhmm >= j.inicio && x.hhmm < j.fim);
}

export interface PedidoEntrada {
  servicoId?: string | null;
  descricao: string;
  propertyId?: string | null;
  horarios: string[];
  /** Pedido de fotógrafo aberto pelo passo de fotos do cadastro: o imóvel é obrigatório. */
  doCadastroDoImovel?: boolean;
  categoria: string;
}

export function validarPedido(
  e: PedidoEntrada,
  agenda: { janelas: JanelaAgenda[]; bloqueios: BloqueioAgenda[] },
  agora: Date,
): { ok: true; descricao: string; horarios: string[] } | { ok: false; erro: string } {
  const descricao = (e.descricao ?? "").trim();
  if (descricao.length < 10) return { ok: false, erro: "Conte em poucas palavras o que você precisa (mínimo de 10 caracteres)." };
  if (descricao.length > DESCRICAO_PEDIDO_MAX) return { ok: false, erro: `A descrição pode ter até ${DESCRICAO_PEDIDO_MAX} caracteres.` };
  if (e.categoria === "fotografia" && e.doCadastroDoImovel && !e.propertyId) return { ok: false, erro: "Escolha o imóvel das fotos." };
  const horarios = [...new Set((e.horarios ?? []).filter(Boolean))];
  if (horarios.length === 0) return { ok: false, erro: "Sugira pelo menos um horário." };
  if (horarios.length > HORARIOS_MAX) return { ok: false, erro: `Sugira no máximo ${HORARIOS_MAX} horários.` };
  if (!horarios.every((h) => horarioNaAgenda(h, agenda.janelas, agenda.bloqueios, agora)))
    return { ok: false, erro: "Algum horário está fora da agenda do parceiro. Escolha outro." };
  return { ok: true, descricao, horarios: horarios.map((h) => new Date(h).toISOString()) };
}

// ── Valores ───────────────────────────────────────────────────────────────────────────────────────────────────
export const VALOR_MIN = 1;
export const VALOR_MAX = 100_000;

export interface ValoresCongelados {
  valor_combinado: number;
  taxa_percent: number;
  valor_taxa: number;
  valor_parceiro: number;
}

/** No ACEITE: taxa e líquido congelam (mudanças futuras da taxa não afetam pedidos aceitos). */
export function congelarValores(valorCombinado: number): ValoresCongelados {
  const { taxa, parceiro } = dividirValor(valorCombinado);
  return { valor_combinado: Math.round(valorCombinado * 100) / 100, taxa_percent: TAXA_SERVICO_PARCEIRO, valor_taxa: taxa, valor_parceiro: parceiro };
}

export function validarOrcamento(valor: unknown): { ok: true; valor: number } | { ok: false; erro: string } {
  const lido = typeof valor === "string" || typeof valor === "number" ? lerReais(valor) : null;
  const v = lido?.ok && lido.valor != null ? lido.valor : NaN;
  if (!Number.isFinite(v) || v < VALOR_MIN) return { ok: false, erro: "Informe o valor do serviço." };
  if (v > VALOR_MAX) return { ok: false, erro: "Valor acima do limite. Fale com a equipe pelas mensagens." };
  return { ok: true, valor: Math.round(v * 100) / 100 };
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** O que o parceiro vê ao orçar: "Taxa de serviço da Viva: 10% = R$ X. Você recebe R$ Y." */
export function textoDivisaoParceiro(valorCombinado: number): string {
  const { taxa, parceiro } = dividirValor(valorCombinado);
  return `Taxa de serviço da Viva: 10% = ${brl(taxa)}. Você recebe ${brl(parceiro)}.`;
}

// ── Pagamento (só registro enquanto a chave estiver desligada) ────────────────────────────────────────────────
export type PagamentoStatus = "indisponivel" | "simulado" | "pago";
export const TEXTO_PAGAMENTO_INATIVO = "O pagamento pela plataforma ainda não está ativo.";
export const TEXTO_DIVISAO_NA_ORIGEM =
  "Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: 90% vai direto para o parceiro e 10% para a Viva. A Viva não guarda o seu dinheiro.";
export const ROTULO_REGISTRO_SEM_DINHEIRO = "registro, sem dinheiro";

/** Provedor de pagamento do parceiro. Só existe a implementação SIMULADA (sem gateway, sem dinheiro). */
export interface ProvedorPagamentoParceiro {
  readonly nome: string;
  pagar(p: { pedidoId: string; valores: ValoresCongelados }): Promise<{ status: PagamentoStatus; ref: string }>;
}
export const provedorSimulado: ProvedorPagamentoParceiro = {
  nome: "simulado",
  async pagar({ pedidoId }) {
    return { status: "simulado", ref: `SIM-${pedidoId.slice(0, 8).toUpperCase()}` };
  },
};
/** "Simular pagamento" só aparece com a chave desligada e para conta de teste ou laboratório. Pagar de verdade: nunca aqui. */
export function podeSimularPagamento(p: { chaveLigada: boolean; contaTeste: boolean; status: string; pagamentoStatus: string }): boolean {
  return !p.chaveLigada && p.contaTeste && ["aceito", "agendado"].includes(p.status) && p.pagamentoStatus === "indisponivel";
}

// ── Privacidade antes do aceite ───────────────────────────────────────────────────────────────────────────────
export interface ImovelDoPedido {
  bairro: string | null;
  cidade: string | null;
  areaM2: number | null;
  quartos: number | null;
  endereco: string | null;
}
export interface ClienteDoPedido {
  nomeCompleto: string | null;
}
export const STATUS_COM_DADOS_LIBERADOS: readonly StatusPedido[] = ["aceito", "agendado", "em_execucao", "entregue", "concluido"];

/** O parceiro vê só bairro, tamanho do imóvel e data antes do aceite; endereço e nome completo depois. */
export function visaoDoParceiro(status: string, imovel: ImovelDoPedido | null, cliente: ClienteDoPedido) {
  const liberado = (STATUS_COM_DADOS_LIBERADOS as readonly string[]).includes(status);
  const primeiroNome = (cliente.nomeCompleto ?? "").trim().split(/\s+/)[0] || "Cliente";
  return {
    liberado,
    nome: liberado ? (cliente.nomeCompleto ?? primeiroNome) : primeiroNome,
    imovel: imovel
      ? { bairro: imovel.bairro, cidade: imovel.cidade, areaM2: imovel.areaM2, quartos: imovel.quartos, endereco: liberado ? imovel.endereco : null }
      : null,
  };
}

// ── Conclusão sem resposta ────────────────────────────────────────────────────────────────────────────────────
export const DIAS_AVISO_CONCLUSAO = 7;
/** Entregue há 7 dias sem o cliente confirmar: só AVISO ao cliente. Nada conclui sozinho. */
export function precisaAvisoConclusao(status: string, entregueEm: string | null, agora: Date): boolean {
  if (status !== "entregue" || !entregueEm) return false;
  return agora.getTime() - Date.parse(entregueEm) >= DIAS_AVISO_CONCLUSAO * 86_400_000;
}
/**
 * Lembrete de 24 h pelo cron DIÁRIO: avisa quando faltam mais de 12 h e até 36 h. Cada horário cai em exatamente uma
 * rodada (janelas de 24 h encostadas), então o aviso chega entre 12 h e 36 h antes; o evento "lembrete_24h" evita repetir.
 */
export function precisaLembrete24h(status: string, horario: string | null, agora: Date): boolean {
  if (status !== "agendado" || !horario) return false;
  const falta = Date.parse(horario) - agora.getTime();
  return falta > 12 * 3_600_000 && falta <= 36 * 3_600_000;
}

// ── Conversa do pedido ────────────────────────────────────────────────────────────────────────────────────────
export const CHAVE_CONVERSA_PEDIDO = (pedidoId: string) => `pedido:${pedidoId}`;
export const MENSAGENS_AUTOMATICAS = {
  boas_vindas: "Aqui vocês combinam tudo. Contato pessoal só pela plataforma: telefone, e-mail e outros apps não passam por aqui.",
  orcamento: (valor: number) => `Orçamento enviado: ${brl(valor)}.`,
  horario: (quando: string) => `Horário confirmado: ${quando}.`,
  lembrete: (quando: string) => `Lembrete: o serviço está marcado para ${quando}.`,
  entrega: "O parceiro marcou a entrega. Confira os arquivos e confirme a conclusão.",
  avaliacao: "Serviço concluído. Conte como foi: a avaliação ajuda outras pessoas.",
} as const;

// ── Rótulos e próximo passo (telas do cliente, do parceiro e do admin) ────────────────────────────────────────
export const ROTULO_STATUS: Record<StatusPedido, string> = {
  solicitado: "Aguardando orçamento",
  orcado: "Orçamento recebido",
  aceito: "Orçamento aceito",
  agendado: "Horário confirmado",
  em_execucao: "Em execução",
  entregue: "Entregue",
  concluido: "Concluído",
  recusado: "Recusado pelo parceiro",
  cancelado: "Cancelado",
};
export const rotuloStatus = (s: string) => ROTULO_STATUS[s as StatusPedido] ?? s;

/** A frase do próximo passo para quem está olhando (null = nada a fazer agora). */
export function proximoPasso(status: string, papel: PapelNoPedido): string | null {
  const cliente: Partial<Record<StatusPedido, string>> = {
    solicitado: "Aguarde o orçamento do parceiro.",
    orcado: "Confira o orçamento e aceite ou recuse.",
    aceito: "Aguarde o parceiro confirmar o horário.",
    agendado: "Serviço marcado. Combine os detalhes pelas mensagens.",
    em_execucao: "O serviço está em andamento.",
    entregue: "Confira a entrega e confirme a conclusão.",
    concluido: "Avalie o serviço.",
  };
  const parceiro: Partial<Record<StatusPedido, string>> = {
    solicitado: "Envie o orçamento ou recuse o pedido.",
    orcado: "Aguarde o cliente decidir.",
    aceito: "Confirme um dos horários.",
    agendado: "No dia, marque o início do serviço.",
    em_execucao: "Envie a entrega e marque como entregue.",
    entregue: "Aguarde o cliente confirmar a conclusão.",
    concluido: "Avalie o cliente.",
  };
  return (papel === "cliente" ? cliente : parceiro)[status as StatusPedido] ?? null;
}

// ── Números do admin (contas de teste fora) ───────────────────────────────────────────────────────────────────
export interface PedidoParaNumeros {
  status: string;
  cliente_id: string;
  parceiro_id: string;
  valor_taxa: number | string | null;
  ref_tipo: string | null;
  pagamento_status: string;
}
export const FORMULAS_PEDIDOS_PARCEIRO = {
  total: "Pedidos de orçamento criados (sem contas de teste do cliente ou do parceiro).",
  abertos: "Pedidos em 'Aguardando orçamento' ou 'Orçamento recebido'.",
  fechados: "Pedidos com orçamento aceito: aceito, agendado, em execução, entregue ou concluído.",
  concluidos: "Pedidos concluídos pelo cliente.",
  conversao: "Fechados ÷ total, em %.",
  taxaRegistrada: "Soma da taxa de serviço (10%) congelada no aceite dos pedidos fechados — registro, sem dinheiro enquanto o pagamento pela plataforma estiver desligado.",
  vindosDeCartao: "Pedidos com a referência do cartão do parceiro (ref_tipo = partnercard).",
} as const;

const FECHADOS = ["aceito", "agendado", "em_execucao", "entregue", "concluido"];

export function numerosPedidosParceiro(pedidos: PedidoParaNumeros[], contasTeste: Set<string>, donoDoParceiro: Map<string, string>) {
  const reais = pedidos.filter((p) => !contasTeste.has(p.cliente_id) && !contasTeste.has(donoDoParceiro.get(p.parceiro_id) ?? ""));
  const fechados = reais.filter((p) => FECHADOS.includes(p.status));
  const centavos = fechados.reduce((t, p) => t + Math.round(Number(p.valor_taxa ?? 0) * 100), 0);
  return {
    total: reais.length,
    abertos: reais.filter((p) => (STATUS_ABERTOS as readonly string[]).includes(p.status)).length,
    fechados: fechados.length,
    concluidos: reais.filter((p) => p.status === "concluido").length,
    conversao: reais.length ? Math.round((fechados.length / reais.length) * 100) : 0,
    taxaRegistrada: centavos / 100,
    vindosDeCartao: reais.filter((p) => p.ref_tipo === "partnercard").length,
  };
}
