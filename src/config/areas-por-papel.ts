/**
 * PAPEL-B — as ÁREAS exclusivas de cada papel (rotas do painel). Abrir uma delas troca o papel ativo para o da área e
 * grava (o selo e o menu sempre batem com a página). O que não está aqui é página comum (Visão geral, mensagens,
 * conta, ajuda, verificação…) e não muda o papel. A casca (DashboardShell, Pista A) tem cópias destas listas no guarda de
 * rota; o teste papel-ativo.test.ts confere que continuam iguais.
 */
export const AREA_PROPRIETARIO = [
  "/qualificar",
  "/dashboard/imoveis",
  "/dashboard/carteira",
  "/dashboard/ganhos",
  "/dashboard/viabilidade",
  "/dashboard/leads",
  "/dashboard/orcamentos",
  "/dashboard/fechamento",
  "/dashboard/ferramentas",
  "/dashboard/reembolsos",
  "/dashboard/assinatura",
  "/dashboard/pedidos-cidade",
  "/dashboard/simulador",
  "/dashboard/roi-imovel",
  "/dashboard/tributacao",
  "/dashboard/garantias",
] as const;

export const AREA_MORADOR = ["/dashboard/favoritos", "/dashboard/comparar", "/dashboard/buscas", "/dashboard/locacoes"] as const;

/** Só vale como área de parceiro com a parceria aprovada (antes disso, é a página do convite). */
export const AREA_PARCEIRO = ["/dashboard/parceiro"] as const;
