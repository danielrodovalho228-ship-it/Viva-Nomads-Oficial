/*
  Solicitações de manutenção (F27/F28, ordem dd8422ce) — regras puras, sem banco.
  A tela /dashboard/solicitacoes lê e cria pelo fluxo real (service_orders ligado
  ao contrato, via abrirChamado); estas funções só traduzem linhas e decidem o
  que pode ser feito, para ficar testável.
*/
import { SO_STATUS_FLOW, type ServiceOrder, type SOCategory, type SOPriority, type SOStatus } from "./service-orders.ts";

/** Contrato em que a manutenção pode ser pedida (mesma regra do servidor). */
export const STATUS_CONTRATO_COM_MANUTENCAO = ["ativo", "encerrado_em_acerto"] as const;

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

export function linhaParaOrdem(l: LinhaOrdem): ServiceOrder {
  return {
    id: l.id,
    property: l.properties?.title?.trim() || "Imóvel",
    tenantName: l.tenant_name?.trim() || "Inquilino",
    category: CATEGORIAS.includes(l.category as SOCategory) ? (l.category as SOCategory) : "outros",
    priority: PRIORIDADES.includes(l.priority as SOPriority) ? (l.priority as SOPriority) : "media",
    description: l.description,
    status: SO_STATUS_FLOW.includes(l.status as SOStatus) ? (l.status as SOStatus) : "aberto",
    openedAt: l.opened_at,
    firstResponseAt: l.first_response_at ?? undefined,
    resolvedAt: l.resolved_at ?? undefined,
  };
}

/** Colunas a gravar ao avançar o status (primeira resposta e resolução carimbadas uma vez). */
export function camposAoAvancar(atual: SOStatus, firstResponseAt: string | null, agora: Date): Record<string, string> | null {
  const i = SO_STATUS_FLOW.indexOf(atual);
  if (i < 0 || i >= SO_STATUS_FLOW.length - 1) return null;
  const novo = SO_STATUS_FLOW[i + 1];
  const iso = agora.toISOString();
  const campos: Record<string, string> = { status: novo };
  if (!firstResponseAt) campos.first_response_at = iso;
  if (novo === "resolvido") campos.resolved_at = iso;
  return campos;
}

/** Texto do estado vazio do inquilino sem contrato ativo. */
export const MSG_SEM_CONTRATO_MANUTENCAO =
  "A manutenção abre a partir de um contrato ativo. Quando o seu contrato começar, você pede por aqui. Antes disso, a Central de Ajuda responde.";
