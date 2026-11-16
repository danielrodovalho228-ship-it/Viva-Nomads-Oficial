/*
  E975: os chamados de EXEMPLO (modo demonstração) moram aqui, fora de src/lib/service-orders.ts — aquele módulo é
  importado por componentes de cliente (cartao-ordem) e levava estes nomes fictícios ao pacote JS de páginas como
  /dashboard/pedidos-cidade, onde a trava de privacidade do pré-aceite (t11 T-TRAV-B) os lia como sobrenome vazado.
*/
import type { ServiceOrder } from "@/lib/service-orders";

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
