/*
  Solicitações de manutenção (F27/F28, ordem dd8422ce) — regras puras, sem banco.
  A tela /dashboard/solicitacoes lê e cria pelo fluxo real (service_orders ligado
  ao contrato, via abrirChamado); estas funções só traduzem linhas e decidem o
  que pode ser feito, para ficar testável.
*/
import { SO_STATUS_META, type ServiceOrder, type SOCategory, type SOPriority, type SOStatus } from "./service-orders.ts";
import { dataHoraBrasilia, prazoManutencao, responderAte } from "../config/atendimento.ts";
import { COLUNAS_ESTADO_CONTRATO, estadoDoContratoUnico, type LinhaEstadoContrato } from "./contrato-estado.ts";

/** Contrato em que a manutenção pode ser pedida (mesma regra do servidor). */
export const STATUS_CONTRATO_COM_MANUTENCAO = ["ativo", "encerrado_em_acerto"] as const;

/** Colunas de `contratos` que a regra abaixo precisa (use no select, junto de `id`). */
export const COLUNAS_VIGENCIA = COLUNAS_ESTADO_CONTRATO;

export type ContratoParaManutencao = LinhaEstadoContrato;

/**
 * Regra de "contrato em vigência" para pedir manutenção (ordem a8905671, F27).
 * "ativo" no banco NÃO basta: o estado tem de ser "Em vigência" (duas assinaturas + 1º
 * pagamento confirmado), lido da fonte única (estadoDoContratoUnico). Em acerto de saída
 * (encerrado_em_acerto) o contrato já foi vigente e segue valendo.
 */
export function contratoPermiteManutencao(c: ContratoParaManutencao): boolean {
  if (c.status !== "ativo" && c.status !== "encerrado_em_acerto") return false;
  const e = estadoDoContratoUnico(c, "proprietario");
  return e.chave === "em_vigencia" || e.chave === "em_acerto";
}

export interface LinhaOrdem {
  id: string;
  category: string;
  priority: string;
  description: string;
  status: string;
  opened_at: string;
  first_response_at: string | null;
  resolved_at: string | null;
  properties?: { title?: string | null } | null;
  tenant_name?: string | null;
}

const CATEGORIAS: SOCategory[] = ["hidraulica", "eletrica", "eletrodomesticos", "estrutura", "internet", "outros"];
const PRIORIDADES: SOPriority[] = ["baixa", "media", "urgente"];
const STATUS_CONHECIDOS: SOStatus[] = ["aberto", "visto", "em_andamento", "resolvido"];

export function linhaParaOrdem(l: LinhaOrdem): ServiceOrder {
  return {
    id: l.id,
    property: l.properties?.title?.trim() || "Imóvel",
    tenantName: l.tenant_name?.trim() || "Inquilino",
    category: CATEGORIAS.includes(l.category as SOCategory) ? (l.category as SOCategory) : "outros",
    priority: PRIORIDADES.includes(l.priority as SOPriority) ? (l.priority as SOPriority) : "media",
    description: l.description,
    status: STATUS_CONHECIDOS.includes(l.status as SOStatus) ? (l.status as SOStatus) : "aberto",
    openedAt: l.opened_at,
    firstResponseAt: l.first_response_at ?? undefined,
    resolvedAt: l.resolved_at ?? undefined,
  };
}

/** Lado da ordem: quem abriu (inquilino) ou o dono do imóvel (proprietário). */
export type PapelOrdem = "inquilino" | "proprietario";

/**
 * Para onde cada lado pode levar a ordem (critério 4):
 *  • proprietário: Aberta → Em atendimento; Aberta/Em atendimento → Resolvida;
 *  • inquilino: marca como Resolvida enquanto não estiver resolvida;
 *  • resolvida não muda mais.
 */
export function proximosStatus(atual: SOStatus, papel: PapelOrdem): SOStatus[] {
  if (atual === "resolvido") return [];
  if (papel === "inquilino") return ["resolvido"];
  return atual === "aberto" ? ["em_andamento", "resolvido"] : ["resolvido"];
}

/**
 * Colunas a gravar na transição; null = transição proibida. A primeira ação do
 * PROPRIETÁRIO carimba a primeira resposta (uma vez); a resolução carimba o fim.
 */
export function camposTransicao(
  atual: SOStatus,
  novo: SOStatus,
  papel: PapelOrdem,
  firstResponseAt: string | null,
  agora: Date
): Record<string, string> | null {
  if (!proximosStatus(atual, papel).includes(novo)) return null;
  const iso = agora.toISOString();
  const campos: Record<string, string> = { status: novo };
  if (papel === "proprietario" && !firstResponseAt) campos.first_response_at = iso;
  if (novo === "resolvido") campos.resolved_at = iso;
  return campos;
}

export const MENSAGEM_MAX = 2000;

/** Réplica dentro da ordem: texto obrigatório, até 2.000 caracteres. */
export function validarMensagem(texto: unknown): { ok: true; texto: string } | { ok: false; erro: string } {
  const t = typeof texto === "string" ? texto.trim() : "";
  if (!t) return { ok: false, erro: "Escreva a mensagem." };
  if (t.length > MENSAGEM_MAX) return { ok: false, erro: `A mensagem passou de ${MENSAGEM_MAX} caracteres.` };
  return { ok: true, texto: t };
}

/**
 * Prazo do proprietário na ordem (critério 2): sempre com a data/hora de
 * Brasília. "respondida" quando já houve a primeira resposta; "vencido" quando
 * passou do prazo sem resposta; senão "no_prazo".
 */
export function prazoDaOrdem(o: Pick<ServiceOrder, "priority" | "openedAt" | "firstResponseAt" | "status">, agora: Date) {
  const aberto = new Date(o.openedAt);
  const ate = prazoManutencao(o.priority, aberto);
  const respondida = !!o.firstResponseAt || o.status === "resolvido";
  const estado: "respondida" | "vencido" | "no_prazo" = respondida ? "respondida" : agora.getTime() > ate.getTime() ? "vencido" : "no_prazo";
  const texto = responderAte(o.priority, aberto);
  return { ate, estado, texto: texto.charAt(0).toUpperCase() + texto.slice(1) };
}

/** Uma linha do histórico da ordem (service_order_eventos). */
export interface EventoOrdem {
  tipo: "aberto" | "status";
  papel: PapelOrdem | "sistema";
  statusPara: string | null;
  criadoEm: string;
}

const QUEM: Record<EventoOrdem["papel"], string> = { inquilino: "Inquilino", proprietario: "Proprietário", sistema: "Equipe Viva Nomads" };

/** O que aconteceu, sem a data: "Proprietário mudou para Em atendimento". */
export function descricaoEvento(e: EventoOrdem): string {
  if (e.tipo === "aberto") return `${QUEM[e.papel]} abriu a ordem`;
  const rotulo = SO_STATUS_META[(e.statusPara ?? "aberto") as SOStatus]?.label ?? "Atualizada";
  return `${QUEM[e.papel]} mudou para ${rotulo}`;
}

/** Linha do histórico, com data/hora de Brasília. */
export function textoEvento(e: EventoOrdem): string {
  return `${dataHoraBrasilia(new Date(e.criadoEm))} — ${descricaoEvento(e)}`;
}

/** Texto do estado vazio do inquilino sem contrato ativo. */
export const MSG_SEM_CONTRATO_MANUTENCAO =
  "A manutenção abre a partir de um contrato ativo. Quando o seu contrato começar, você pede por aqui. Antes disso, a Central de Ajuda responde.";
