/*
  Estado do contrato — FONTE ÚNICA (complemento do coordenador, 19/10, depois do reteste do #864).
  O detalhe do contrato chamava etapaContrato com "1º pagamento confirmado" fixo em false (todo contrato assinado
  aparecia "Aguardando 1º pagamento") e a manutenção tinha a própria cópia da regra. Agora toda tela — detalhe,
  listas dos dois lados, carteira, Resumo do fechamento, manutenção (e a página da estadia do Prompt 32) — lê o
  estado por estadoDoContratoUnico, a partir da linha do banco. Nenhuma tela monta a etapa sozinha.
*/
import { etapaContrato, type EtapaContrato } from "./contrato-etapas.ts";
import { lerDaterange } from "./contrato-periodo.ts";

export type Papel = "inquilino" | "proprietario";

/** Colunas de `contratos` que o estado precisa (use no select, junto de `id`). */
export const COLUNAS_ESTADO_CONTRATO = "status, periodo, assinado_proprietario_em, assinado_inquilino_em, pagamentos_bloco(tipo, confirmado_pelo_inquilino, anulado_em)";

export interface LinhaEstadoContrato {
  status?: string | null;
  /** E543: o daterange do contrato ("[2026-09-30,2026-10-31)"). Ausente = a regra de sempre, sem o período. */
  periodo?: string | null;
  assinado_proprietario_em?: string | null;
  assinado_inquilino_em?: string | null;
  pagamentos_bloco?: { tipo?: string | null; confirmado_pelo_inquilino?: boolean | null; anulado_em?: string | null }[] | null;
}

export type ChaveEstado =
  | "aguardando_assinatura"
  | "falta_voce"
  | "falta_outra_parte"
  | "aguardando_pagamento"
  | "em_vigencia"
  | "em_acerto"
  | "concluido"
  | "encerrado_sem_renovacao"
  | "encerrado_periodo"
  | "cancelado";

export interface EstadoContrato {
  chave: ChaveEstado;
  /** O selo, igual em todas as telas para o mesmo papel. */
  selo: string;
  /** Só com status "ativo": aguardando assinatura → aguardando 1º pagamento → em vigência. */
  etapa: EtapaContrato | null;
  /** Falta a assinatura de quem está olhando. */
  faltaVoce: boolean;
  /** Contrato que ocupa o imóvel (assinando, aguardando pagamento ou em vigência). */
  ativo: boolean;
}

/**
 * 1º pagamento do aluguel declarado pelo proprietário E confirmado pelo inquilino. Pagamento anulado (0182) não conta
 * (Prompt 32: um registro anulado não pode liberar as instruções de chegada nem mudar a etapa).
 */
export function primeiroPagamentoConfirmado(pagamentos: LinhaEstadoContrato["pagamentos_bloco"]): boolean {
  return (pagamentos ?? []).some((p) => p?.tipo === "aluguel" && p?.confirmado_pelo_inquilino === true && !p?.anulado_em);
}

const ENCERRADOS: Record<string, { chave: ChaveEstado; selo: string }> = {
  cancelado: { chave: "cancelado", selo: "Cancelado" },
  concluido: { chave: "concluido", selo: "Concluído" },
  encerrado_sem_renovacao: { chave: "encerrado_sem_renovacao", selo: "Encerrado (sem renovação)" },
  encerrado_em_acerto: { chave: "em_acerto", selo: "Em acerto de saída" },
};

/** Hoje no calendário de Brasília (AAAA-MM-DD). */
function hojeBRT(agora: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
}

/** A função única. `papel` muda só o "falta você / falta o inquilino" da assinatura. */
export function estadoDoContratoUnico(c: LinhaEstadoContrato, papel: Papel, agora: Date = new Date()): EstadoContrato {
  const status = c.status ?? "ativo";
  if (status !== "ativo") {
    const e = ENCERRADOS[status] ?? { chave: "concluido" as const, selo: "Concluído" };
    return { ...e, etapa: null, faltaVoce: false, ativo: false };
  }
  // E543: o período já terminou (o último dia passou, no calendário de Brasília) → encerrado em toda tela, com a mesma
  // data da página da estadia — nunca "Aguardando 1º pagamento" de um contrato que já acabou.
  const p = lerDaterange(c.periodo);
  if (p && p.fim < hojeBRT(agora)) {
    const [a, m, d] = p.fim.split("-");
    return { chave: "encerrado_periodo", selo: `Encerrado em ${d}/${m}/${a}`, etapa: null, faltaVoce: false, ativo: false };
  }
  const etapa = etapaContrato({
    assinadoProprietarioEm: c.assinado_proprietario_em ?? null,
    assinadoInquilinoEm: c.assinado_inquilino_em ?? null,
    primeiroPagamentoConfirmado: primeiroPagamentoConfirmado(c.pagamentos_bloco),
  });
  if (etapa === "aguardando_assinatura") {
    const prop = !!c.assinado_proprietario_em;
    const inq = !!c.assinado_inquilino_em;
    const eu = papel === "inquilino" ? inq : prop;
    const outro = papel === "inquilino" ? "o proprietário" : "o inquilino";
    if (!prop && !inq) return { chave: "aguardando_assinatura", selo: `Aguardando assinatura · falta você e ${outro}`, etapa, faltaVoce: true, ativo: true };
    if (!eu) return { chave: "falta_voce", selo: "Aguardando assinatura · falta você", etapa, faltaVoce: true, ativo: true };
    return { chave: "falta_outra_parte", selo: `Aguardando assinatura · falta ${outro}`, etapa, faltaVoce: false, ativo: true };
  }
  if (etapa === "aguardando_pagamento") return { chave: "aguardando_pagamento", selo: "Aguardando 1º pagamento", etapa, faltaVoce: false, ativo: true };
  return { chave: "em_vigencia", selo: "Em vigência", etapa, faltaVoce: false, ativo: true };
}

/** Cor do selo: verde em vigência, âmbar enquanto falta algo, neutro depois de encerrado. */
export function tomDoSelo(e: Pick<EstadoContrato, "chave" | "ativo">): string {
  if (e.chave === "em_vigencia") return "bg-sage-100 text-forest";
  if (e.ativo) return "bg-amber-50 text-amber-700";
  return "bg-surface-2 text-muted";
}

/**
 * O selo para a EQUIPE (admin › contrato e pacote de provas gerado pelo admin): a mesma fonte única, sem o
 * "falta você" de quem é parte — na assinatura diz quem falta.
 */
export function seloParaEquipe(c: LinhaEstadoContrato): string {
  const e = estadoDoContratoUnico(c, "proprietario");
  if (e.etapa !== "aguardando_assinatura") return e.selo;
  const prop = !!c.assinado_proprietario_em;
  const inq = !!c.assinado_inquilino_em;
  if (!prop && !inq) return "Aguardando assinatura · faltam as duas partes";
  return `Aguardando assinatura · falta o ${prop ? "inquilino" : "proprietário"}`;
}

/** E543: a situação da EQUIPE (filtro da lista do admin) — grupos da fonte única, nunca o status cru do banco. */
export type SituacaoEquipe = "aguardando_assinatura" | "aguardando_pagamento" | "em_vigencia" | "em_acerto" | "encerrado" | "cancelado";

export const ROTULO_SITUACAO_EQUIPE: Record<SituacaoEquipe, string> = {
  aguardando_assinatura: "Aguardando assinatura",
  aguardando_pagamento: "Aguardando 1º pagamento",
  em_vigencia: "Em vigência",
  em_acerto: "Em acerto de saída",
  encerrado: "Encerrado",
  cancelado: "Cancelado",
};

const GRUPO_EQUIPE: Record<ChaveEstado, SituacaoEquipe> = {
  aguardando_assinatura: "aguardando_assinatura",
  falta_voce: "aguardando_assinatura",
  falta_outra_parte: "aguardando_assinatura",
  aguardando_pagamento: "aguardando_pagamento",
  em_vigencia: "em_vigencia",
  em_acerto: "em_acerto",
  concluido: "encerrado",
  encerrado_sem_renovacao: "encerrado",
  encerrado_periodo: "encerrado",
  cancelado: "cancelado",
};

/** A situação do contrato para o filtro do admin: a mesma conta do selo (um contrato que terminou é "Encerrado"). */
export function situacaoParaEquipe(c: LinhaEstadoContrato, agora: Date = new Date()): { chave: SituacaoEquipe; rotulo: string } {
  const chave = GRUPO_EQUIPE[estadoDoContratoUnico(c, "proprietario", agora).chave];
  return { chave, rotulo: ROTULO_SITUACAO_EQUIPE[chave] };
}
