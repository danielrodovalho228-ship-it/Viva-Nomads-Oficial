/*
  Pedido de Moradia — regras PURAS (sem efeito colateral), testáveis com
  `node --test`. Mantido SEM imports (como caucao.ts / contrato-blocos.ts) para
  o alias `@/` não quebrar o runner.

  Comunicação: TODA troca acontece DENTRO da plataforma (decisão de produto). O
  filtro anti-contato bloqueia telefone/e-mail/mensageria no texto do pedido —
  se passasse, a conversa escaparia da plataforma no dia 1.
*/

export type MotivoPedido =
  | "trabalho_remoto"
  | "tratamento_medico"
  | "relocacao_corporativa"
  | "intercambio_pos"
  | "reforma_transicao"
  | "mudanca_familiar"
  | "aposentadoria_lifestyle"
  | "viagem_longa"
  | "outro";

export interface MotivoDef {
  key: MotivoPedido;
  label: string;
  /** Descrição curta exibida abaixo do rótulo no seletor. */
  descricao: string;
  /** Rótulo genérico exibido no card público (sem identificar a pessoa). */
  publico: string;
}

export const MOTIVOS: MotivoDef[] = [
  { key: "trabalho_remoto", label: "Trabalho remoto", descricao: "Home office com base temporária", publico: "Trabalho remoto" },
  { key: "tratamento_medico", label: "Tratamento médico", descricao: "Consulta, cirurgia, acompanhante", publico: "Tratamento de saúde" },
  { key: "relocacao_corporativa", label: "Relocação corporativa", descricao: "Transferência, projeto, treinamento", publico: "Relocação corporativa" },
  { key: "intercambio_pos", label: "Intercâmbio / Pós", descricao: "UFU, residência, especialização", publico: "Intercâmbio / pós-graduação" },
  { key: "reforma_transicao", label: "Reforma / Transição", descricao: "Obras, espera por casa própria", publico: "Reforma / transição" },
  { key: "mudanca_familiar", label: "Mudança familiar", descricao: "Família vindo se estabelecer", publico: "Mudança familiar" },
  { key: "aposentadoria_lifestyle", label: "Aposentadoria / Lifestyle", descricao: "Sabático, temporada longa", publico: "Aposentadoria / lifestyle" },
  { key: "viagem_longa", label: "Viagem longa", descricao: "Turismo prolongado, road trip", publico: "Viagem longa" },
  { key: "outro", label: "Outro motivo", descricao: "Descreva na apresentação abaixo", publico: "Outro" },
];

const MOTIVO_BY_KEY: Record<string, MotivoDef> = Object.fromEntries(MOTIVOS.map((m) => [m.key, m]));

export function motivoLabel(key: string): string {
  return MOTIVO_BY_KEY[key]?.label ?? key;
}
export function motivoPublico(key: string): string {
  return MOTIVO_BY_KEY[key]?.publico ?? "Interessado";
}
export function isMotivo(key: string): key is MotivoPedido {
  return key in MOTIVO_BY_KEY;
}

/** Rótulos dos status do pedido. */
export const PEDIDO_STATUS_LABEL: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  atendido: "Atendido",
  expirado: "Expirado",
  removido_admin: "Removido pela moderação",
};

/** Rótulos dos status da resposta. */
export const RESPOSTA_STATUS_LABEL: Record<string, string> = {
  enviada: "Enviada",
  vista: "Vista",
  aceita_para_conversa: "Aceita para conversa",
  recusada: "Recusada",
};

/** Máximo de pedidos ATIVOS por inquilino (anti-abuso). */
export const MAX_PEDIDOS_ATIVOS = 2;

// ── Leads do proprietário (Dashboard Fase 2) ─────────────────────────────────

/**
 * Receita potencial do período de um pedido = orçamento mensal × prazo (meses).
 * Estimativa pelo que o inquilino declarou — o lead chega precificado.
 */
export function receitaPotencial(orcamentoMensal: number, prazoMeses: number): number {
  return Math.max(0, orcamentoMensal) * Math.max(0, Math.floor(prazoMeses));
}

/** Tolerância de orçamento na compatibilidade (o pedido pode pagar 15% a menos). */
export const TOLERANCIA_ORCAMENTO = 0.15;

export interface ImovelCompat {
  city: string;
  maxGuests?: number;
  monthlyPrice: number;
}
export interface PedidoCompat {
  cidade: string;
  orcamento_mensal: number;
  qtd_ocupantes: number;
}

/**
 * Um pedido é COMPATÍVEL com o proprietário quando existe um imóvel ativo dele
 * que casa: mesma cidade, orçamento ≥ menor aluguel na cidade (com tolerância de
 * 15%) e capacidade ≥ ocupantes do pedido. Senão, é "demais pedido na cidade".
 */
export function pedidoCompativel(pedido: PedidoCompat, props: ImovelCompat[]): boolean {
  const naCidade = props.filter(
    (p) => p.city.trim().toLowerCase() === pedido.cidade.trim().toLowerCase()
  );
  if (naCidade.length === 0) return false;
  const menorAluguel = Math.min(...naCidade.map((p) => p.monthlyPrice));
  const orcamentoOk = pedido.orcamento_mensal >= menorAluguel * (1 - TOLERANCIA_ORCAMENTO);
  const capacidadeOk = naCidade.some(
    (p) => p.maxGuests == null || p.maxGuests >= pedido.qtd_ocupantes
  );
  return orcamentoOk && capacidadeOk;
}

/** Dias desde a publicação (para "publicado há N dias"). Datas ISO. */
export function diasDesde(criadoEmISO: string, hojeISO: string): number {
  const a = Date.parse(`${criadoEmISO.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${hojeISO.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}

// ── Filtro anti-contato (bloqueia; não mascara) ──────────────────────────────
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/;
// 8+ dígitos seguidos (com ou sem máscara) — cobre telefones digitados.
const PHONE_RE = /(?:\d[\s().-]?){8,}/;
// Termos que puxam a conversa para fora da plataforma.
// "insta"/"face" só isolados ou como instagram/facebook — NÃO casa "instalação",
// "instante", "faceta" (falsos positivos que bloqueariam texto legítimo).
const TERMOS_RE =
  /\b(whats\w*|zap+|telegram|te\s?legram|instagram|insta|facebook|face|chama\s+no|me\s+chama|liga\s+(?:pra|para)|meu\s+(?:n[úu]mero|whats|zap|contato))\b/i;
// Links de mensageria externa.
const MESSENGER_RE = /(?:https?:\/\/)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|t\.me|telegram\.me)\//i;

export type MotivoBloqueio = "telefone" | "email" | "mensageria" | "termo";

/**
 * Detecta contato direto proibido no texto (telefone, e-mail, link de
 * mensageria ou termos como "whats/zap/chama no"). Retorna o motivo do bloqueio
 * ou null se o texto está limpo.
 */
export function detectarContato(input: string): MotivoBloqueio | null {
  const t = input ?? "";
  if (EMAIL_RE.test(t)) return "email";
  if (MESSENGER_RE.test(t)) return "mensageria";
  if (TERMOS_RE.test(t)) return "termo";
  // Telefone por último: precisa de 8+ dígitos reais no total do trecho casado.
  const m = t.match(PHONE_RE);
  if (m && m[0].replace(/\D/g, "").length >= 8) return "telefone";
  return null;
}

/** true se o texto contém contato direto proibido. */
export function contemContato(input: string): boolean {
  return detectarContato(input) !== null;
}

/** Aviso exibido quando o texto do pedido tem contato direto. */
export const CONTATO_AVISO =
  "Para sua segurança e registro, o contato acontece pela plataforma — remova telefone, e-mail ou apps de mensagem do texto.";

/**
 * Expiração do pedido = MENOR entre (data_inicio + 15 dias) e (criado_em + 60
 * dias). Espelha o trigger `set_pedido_expira_em` do banco — usado para exibir a
 * data ao inquilino antes de gravar. Datas ISO (yyyy-mm-dd) → ISO.
 */
export function calcExpiraEm(dataInicioISO: string, criadoEmISO: string): string {
  const d1 = new Date(`${dataInicioISO}T00:00:00Z`);
  d1.setUTCDate(d1.getUTCDate() + 15);
  const d2 = new Date(`${criadoEmISO}T00:00:00Z`);
  d2.setUTCDate(d2.getUTCDate() + 60);
  const menor = d1.getTime() < d2.getTime() ? d1 : d2;
  return menor.toISOString().slice(0, 10);
}
