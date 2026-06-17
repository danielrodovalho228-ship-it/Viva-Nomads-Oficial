/*
  Ordens de serviço (Bloco C — rodada 5). Canal de registro/notificação de
  manutenção. A plataforma documenta e notifica — não executa nem garante prazo.
*/

export type SOCategory =
  | "hidraulica"
  | "eletrica"
  | "eletrodomesticos"
  | "estrutura"
  | "internet"
  | "outros";

export type SOPriority = "baixa" | "media" | "urgente";
export type SOStatus = "aberto" | "visto" | "em_andamento" | "resolvido";

export interface ServiceOrder {
  id: string;
  property: string;
  tenantName: string;
  category: SOCategory;
  priority: SOPriority;
  description: string;
  status: SOStatus;
  openedAt: string; // ISO
  firstResponseAt?: string;
  resolvedAt?: string;
}

export const SO_CATEGORIES: { id: SOCategory; label: string }[] = [
  { id: "hidraulica", label: "Hidráulica" },
  { id: "eletrica", label: "Elétrica" },
  { id: "eletrodomesticos", label: "Eletrodomésticos" },
  { id: "estrutura", label: "Estrutura" },
  { id: "internet", label: "Internet" },
  { id: "outros", label: "Outros" },
];

export const SO_PRIORITY_META: Record<
  SOPriority,
  { label: string; rank: number; tone: string }
> = {
  urgente: { label: "Urgente", rank: 0, tone: "bg-red-100 text-red-700 border-red-200" },
  media: { label: "Média", rank: 1, tone: "bg-amber-100 text-amber-700 border-amber-200" },
  baixa: { label: "Baixa", rank: 2, tone: "bg-blue-50 text-blue-700 border-blue-200" },
};

export const SO_STATUS_FLOW: SOStatus[] = ["aberto", "visto", "em_andamento", "resolvido"];

export const SO_STATUS_META: Record<SOStatus, { label: string; tone: string }> = {
  aberto: { label: "Aberto", tone: "bg-red-50 text-red-700" },
  visto: { label: "Visto", tone: "bg-amber-50 text-amber-700" },
  em_andamento: { label: "Em andamento", tone: "bg-blue-50 text-blue-700" },
  resolvido: { label: "Resolvido", tone: "bg-emerald-50 text-emerald-700" },
};

export function categoryLabel(c: SOCategory) {
  return SO_CATEGORIES.find((x) => x.id === c)?.label ?? c;
}

/** Próximo status no fluxo Aberto → Visto → Em andamento → Resolvido. */
export function nextStatus(s: SOStatus): SOStatus | null {
  const i = SO_STATUS_FLOW.indexOf(s);
  return i < SO_STATUS_FLOW.length - 1 ? SO_STATUS_FLOW[i + 1] : null;
}

/** Ordena por prioridade (urgente primeiro) e depois por abertura. */
export function sortByPriority(orders: ServiceOrder[]): ServiceOrder[] {
  return [...orders].sort(
    (a, b) =>
      SO_PRIORITY_META[a.priority].rank - SO_PRIORITY_META[b.priority].rank ||
      +new Date(b.openedAt) - +new Date(a.openedAt)
  );
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600000).toISOString();

/** Chamados de exemplo (demo). */
export const SAMPLE_ORDERS: ServiceOrder[] = [
  {
    id: "so-1",
    property: "Apto Santa Mônica",
    tenantName: "Ana Carvalho",
    category: "hidraulica",
    priority: "urgente",
    description: "Vazamento embaixo da pia da cozinha, água acumulando no armário.",
    status: "aberto",
    openedAt: hoursAgo(3),
  },
  {
    id: "so-2",
    property: "Studio Centro",
    tenantName: "Rafael Lima",
    category: "internet",
    priority: "media",
    description: "Internet caindo várias vezes ao dia, atrapalha o trabalho remoto.",
    status: "em_andamento",
    openedAt: hoursAgo(28),
    firstResponseAt: hoursAgo(26),
  },
  {
    id: "so-3",
    property: "Apto Santa Mônica",
    tenantName: "Ana Carvalho",
    category: "eletrodomesticos",
    priority: "baixa",
    description: "Lâmpada do banheiro queimada.",
    status: "resolvido",
    openedAt: hoursAgo(72),
    firstResponseAt: hoursAgo(70),
    resolvedAt: hoursAgo(60),
  },
];

/** Métricas do selo "Proprietário Responsivo". */
export function ownerMetrics(orders: ServiceOrder[]) {
  const responded = orders.filter((o) => o.firstResponseAt);
  const resolved = orders.filter((o) => o.resolvedAt);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const avgFirstResponseH = avg(
    responded.map((o) => (+new Date(o.firstResponseAt!) - +new Date(o.openedAt)) / 3600000)
  );
  const avgResolutionH = avg(
    resolved.map((o) => (+new Date(o.resolvedAt!) - +new Date(o.openedAt)) / 3600000)
  );
  // Responsivo: responde em < 12h e resolve em < 48h (em média).
  const responsive = responded.length > 0 && avgFirstResponseH < 12 && avgResolutionH < 48;
  return { avgFirstResponseH, avgResolutionH, responsive };
}
