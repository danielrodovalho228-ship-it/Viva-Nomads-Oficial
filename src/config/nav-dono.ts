/**
 * PROP-1 (substitui o NAV-A2) — navegação do DONO no computador, como no mockup painel-proprietario-desktop:
 * sem barra lateral; abas no topo (Início · Anúncios · Interessados · Contratos · Mensagens), sino e "Conta ▾" à
 * direita, e subabas num componente único. Fonte única (PURA, testada em nav-dono.test.ts); quem desenha é o
 * TopoDono/SubabasDono. No celular nada muda: as abas do NAV-A seguem (src/lib/nav-mobile.ts).
 */
import { rotaAtiva } from "./menu-painel.ts";

export interface ItemNavDono {
  id: string;
  rotulo: string;
  href: string;
  /** Outras rotas que também acendem este item (ex.: "Propostas" do dono e a lista do morador). */
  ativoEm?: readonly string[];
}

export interface AbaDono extends ItemNavDono {
  subabas?: readonly ItemNavDono[];
}

/** /dashboard/ganhos nasce no PROP-4; até lá a subaba "Ganhos" não aparece. */
export const GANHOS_DISPONIVEL = false;

export const ABAS_DONO: readonly AbaDono[] = [
  { id: "inicio", rotulo: "Início", href: "/dashboard" },
  { id: "anuncios", rotulo: "Anúncios", href: "/dashboard/imoveis" },
  {
    id: "interessados",
    rotulo: "Interessados",
    href: "/dashboard/leads",
    subabas: [
      { id: "interessados", rotulo: "Interessados", href: "/dashboard/leads" },
      // As propostas que o dono envia moram em /dashboard/orcamentos; /dashboard/propostas é a lista do lado morador
      // (as que ele recebeu). As duas acendem a mesma subaba "Propostas".
      { id: "propostas", rotulo: "Propostas", href: "/dashboard/orcamentos", ativoEm: ["/dashboard/propostas"] },
      { id: "fechamento", rotulo: "Fechamento", href: "/dashboard/fechamento" },
      { id: "pedidos-cidade", rotulo: "Pedidos na cidade", href: "/dashboard/pedidos-cidade" },
    ],
  },
  {
    id: "contratos",
    rotulo: "Contratos",
    href: "/dashboard/contratos",
    subabas: [
      { id: "contratos", rotulo: "Contratos", href: "/dashboard/contratos" },
      ...(GANHOS_DISPONIVEL ? [{ id: "ganhos", rotulo: "Ganhos", href: "/dashboard/ganhos" }] : []),
      { id: "caucao", rotulo: "Caução", href: "/dashboard/garantias" },
      { id: "recibos", rotulo: "Recibos e notas", href: "/dashboard/recibos" },
    ],
  },
  { id: "mensagens", rotulo: "Mensagens", href: "/dashboard/mensagens" },
];

/** "Conta ▾" (à direita do topo). "Modo morador" e "Sair" são ações; os outros, links. */
export type ItemContaDono = ItemNavDono & { acao?: "modo-morador" | "sair" };
export const CONTA_DONO: readonly ItemContaDono[] = [
  { id: "perfil", rotulo: "Perfil e dados", href: "/dashboard/conta" },
  { id: "verificacao", rotulo: "Verificação", href: "/dashboard/verificacao" },
  { id: "pagamentos", rotulo: "Pagamentos e recebimentos", href: "/dashboard/conta/pagamentos" },
  { id: "notificacoes", rotulo: "Notificações", href: "/dashboard/conta/notificacoes" },
  { id: "avaliacoes", rotulo: "Avaliações recebidas", href: "/dashboard/avaliacoes" },
  { id: "plano", rotulo: "Plano", href: "/dashboard/assinatura" },
  { id: "ferramentas", rotulo: "Ferramentas", href: "/dashboard/ferramentas" },
  { id: "modo-morador", rotulo: "Modo morador", href: "/dashboard", acao: "modo-morador" },
  { id: "sair", rotulo: "Sair", href: "/", acao: "sair" },
];

/** O sino do topo leva às notificações do painel. */
export const HREF_SINO_DONO = "/dashboard/notificacoes";

function acende(item: ItemNavDono, pathname: string): boolean {
  return [item.href, ...(item.ativoEm ?? [])].some((h) => rotaAtiva(h, pathname));
}

/** A aba de cima acesa nesta rota (a aba ou qualquer subaba dela); fora das cinco, nenhuma. */
export function abaAtivaDono(pathname: string): AbaDono | null {
  // As abas com subabas antes: "/dashboard" (Início) só acende exato e não disputa com elas.
  for (const aba of ABAS_DONO) {
    if (acende(aba, pathname) || (aba.subabas ?? []).some((s) => acende(s, pathname))) return aba;
  }
  return null;
}

/** A subaba acesa nesta rota (dentro da aba ativa). */
export function subabaAtivaDono(pathname: string): ItemNavDono | null {
  const aba = abaAtivaDono(pathname);
  return (aba?.subabas ?? []).find((s) => acende(s, pathname)) ?? null;
}

/** Itens do lado MORADOR: no modo dono não aparecem em menu nenhum (PROP-1, item 4). */
export const ROTAS_SO_MORADOR: readonly string[] = [
  "/buscar",
  "/dashboard/buscas",
  "/dashboard/favoritos",
  "/dashboard/pedidos",
  "/dashboard/locacoes",
  "/dashboard/candidaturas",
];
