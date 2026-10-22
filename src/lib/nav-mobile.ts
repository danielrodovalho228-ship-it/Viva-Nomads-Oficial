import {
  Search,
  MessageSquare,
  House,
  Building2,
  KeyRound,
  Wallet,
  ClipboardList,
  CalendarDays,
  UserRound,
} from "lucide-react";

/**
 * Abas da BARRA INFERIOR (Prompt 41, item 2): 5 itens por PAPEL, a mesma lista no site (celular) e no app.
 * Três papéis pela mesma conta (conta única; a troca fica no Perfil): morador, proprietário e parceiro — este
 * só com a parceria aprovada. Admin não tem barra (fica fora do app).
 * Cada aba aponta para uma rota que JÁ existe com essa função (nenhuma tela nova):
 *  - morador:      Início /dashboard · Buscar /buscar · Mensagens · Estadias /dashboard/locacoes · Perfil /dashboard/conta
 *  - proprietário: Início · Anúncios /dashboard/imoveis · Mensagens · Ganhos /dashboard/contratos · Perfil
 *    ("Ganhos" = os recebimentos registrados em Contratos & blocos; rótulo "pago direto na sua conta")
 *  - parceiro:     Início · Pedidos · Agenda · Ganhos (as seções do painel /dashboard/parceiro) · Perfil
 */
export interface MobileTab {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Exige login — sem sessão, a aba leva a /auth?redirect=<href>. */
  authRequired?: boolean;
  /** Sem sessão, a aba leva aqui em vez do login (ex.: Início do visitante = a home). */
  hrefSemLogin?: string;
  /** Chave de contador (badge). Preenchido pela casca quando houver dado. */
  badge?: "mensagens" | "interessados" | "equipe";
  /** Rótulo curto quando a barra tem mais de 5 abas (ex.: admin com "Equipe"), para não encavalar. */
  curto?: string;
  /** Prefixo que também deixa a aba ativa (ex.: /admin para a aba Equipe). */
  ativoEm?: string;
  /** Nome acessível mais completo que o rótulo (ex.: "Ganhos: pago direto na sua conta"). */
  descricao?: string;
}

export type PapelBarra = "morador" | "proprietario" | "parceiro";

/** Rótulo do papel ativo no cabeçalho (foto pequena + papel). */
export const ROTULO_PAPEL: Record<PapelBarra, string> = {
  morador: "Morador",
  proprietario: "Proprietário",
  parceiro: "Parceiro",
};

/** "Ganhos" do proprietário: o valor mensal vai direto do morador para o dono (a Viva não segura dinheiro). */
export const ROTULO_GANHOS_DONO = "pago direto na sua conta";

const INICIO: MobileTab = { href: "/dashboard", label: "Início", icon: House, authRequired: true, hrefSemLogin: "/" };
const MENSAGENS: MobileTab = { href: "/dashboard/mensagens", label: "Mensagens", icon: MessageSquare, authRequired: true, badge: "mensagens" };
const PERFIL: MobileTab = { href: "/dashboard/conta", label: "Perfil", icon: UserRound, authRequired: true };

export const MORADOR_TABS: MobileTab[] = [
  INICIO,
  { href: "/buscar", label: "Buscar", icon: Search },
  MENSAGENS,
  { href: "/dashboard/locacoes", label: "Estadias", icon: KeyRound, authRequired: true },
  PERFIL,
];

export const PROPRIETARIO_TABS: MobileTab[] = [
  INICIO,
  { href: "/dashboard/imoveis", label: "Anúncios", icon: Building2, authRequired: true },
  MENSAGENS,
  { href: "/dashboard/contratos", label: "Ganhos", icon: Wallet, authRequired: true, descricao: `Ganhos: ${ROTULO_GANHOS_DONO}` },
  PERFIL,
];

/** Parceiro aprovado: as três abas do meio são as seções do painel do parceiro (âncoras em /dashboard/parceiro). */
export const PARCEIRO_TABS: MobileTab[] = [
  INICIO,
  { href: "/dashboard/parceiro#pedidos", label: "Pedidos", icon: ClipboardList, authRequired: true, ativoEm: "/dashboard/servicos/pedidos" },
  { href: "/dashboard/parceiro#agenda", label: "Agenda", icon: CalendarDays, authRequired: true },
  { href: "/dashboard/parceiro#ganhos", label: "Ganhos", icon: Wallet, authRequired: true },
  PERFIL,
];

export const ABAS_POR_PAPEL: Record<PapelBarra, MobileTab[]> = {
  morador: MORADOR_TABS,
  proprietario: PROPRIETARIO_TABS,
  parceiro: PARCEIRO_TABS,
};

/**
 * Papel da barra: admin nas telas /admin → nenhum (sem barra); parceiro só com a parceria APROVADA e no contexto de
 * parceiro (o painel e os pedidos do parceiro); senão o papel do contexto (proprietário/morador, que a casca acerta ao
 * abrir uma tela de dono ou de morador). Prompt 43 (conta única): não há botão de troca — a antiga "preferência de
 * parceiro" do Perfil não vale mais (o parâmetro fica só por compatibilidade e é ignorado). D-V (print do Daniel, 22/10): o admin que usa o painel como proprietário ou morador tem a
 * barra do modo ativo, como qualquer conta; só as telas de admin ficam sem barra.
 */
export function papelDaBarra(p: {
  admin: boolean;
  modo: "owner" | "tenant";
  parceiroAprovado: boolean;
  preferenciaParceiro?: boolean;
  pathname?: string;
}): PapelBarra | null {
  if (p.admin && (!p.pathname || p.pathname === "/admin" || p.pathname.startsWith("/admin/"))) return null;
  const noPainelDoParceiro = !!p.pathname && (p.pathname === "/dashboard/parceiro" || p.pathname.startsWith("/dashboard/parceiro/"));
  if (p.parceiroAprovado && noPainelDoParceiro) return "parceiro";
  return p.modo === "owner" ? "proprietario" : "morador";
}

/** Abas do papel (admin: nenhuma). */
export function abasDoPapel(papel: PapelBarra | null): MobileTab[] {
  return papel ? ABAS_POR_PAPEL[papel] : [];
}

/** Títulos das telas no cabeçalho curto do app. */
const TITULOS_APP: [RegExp, string][] = [
  [/^\/dashboard\/?$/, "Painel"],
  [/^\/dashboard\/imoveis\/novo/, "Anunciar imóvel"],
  [/^\/dashboard\/imoveis\/[^/]+\/editar/, "Editar anúncio"],
  [/^\/dashboard\/imoveis/, "Imóveis"],
  [/^\/dashboard\/leads/, "Interessados"],
  [/^\/dashboard\/mensagens/, "Mensagens"],
  [/^\/(dashboard\/)?favoritos/, "Favoritos"],
  [/^\/dashboard\/comparar/, "Comparar"],
  [/^\/dashboard\/candidaturas/, "Candidaturas"],
  [/^\/dashboard\/visitas/, "Visitas por vídeo"],
  [/^\/dashboard\/pedidos-cidade/, "Pedidos na cidade"],
  [/^\/dashboard\/pedidos/, "Meus pedidos"],
  [/^\/dashboard\/conta\/perfil/, "Perfil"],
  [/^\/dashboard\/conta\/seguranca/, "Senha e segurança"],
  [/^\/dashboard\/conta\/notificacoes/, "Notificações"],
  [/^\/dashboard\/notificacoes/, "Notificações"],
  [/^\/dashboard\/conta\/ajuda/, "Ajuda e contato"],
  [/^\/dashboard\/conta\/excluir/, "Excluir conta"],
  [/^\/dashboard\/conta/, "Conta"],
  [/^\/dashboard\/verificacao/, "Verificação"],
  [/^\/dashboard\/ferramentas/, "Ferramentas"],
  [/^\/dashboard\/assinatura/, "Plano"],
  [/^\/dashboard\/indicacoes/, "Indicações"],
  [/^\/dashboard\/fechamento/, "Fechamento"],
  [/^\/dashboard\/contratos/, "Contratos"],
  [/^\/dashboard\/locacoes/, "Minha estadia"],
  [/^\/dashboard\/solicitacoes/, "Chamados"],
  [/^\/dashboard\/orcamentos/, "Orçamentos"],
  [/^\/admin\/documentos/, "Documentos"],
  [/^\/admin\/atendimento/, "Atendimento"],
  [/^\/admin\/socios/, "Caixa dos Sócios"],
  [/^\/admin\/parceiros/, "Parceiros"],
  [/^\/admin\/fotografos/, "Fotógrafos"],
  [/^\/admin\/financeiro/, "Financeiro"],
  [/^\/admin\/marketing/, "Marketing"],
  [/^\/admin\/pedidos/, "Moderar pedidos"],
  [/^\/admin\/?$/, "Admin"],
  [/^\/admin/, "Equipe"],
  [/^\/buscar/, "Buscar"],
  [/^\/imoveis\//, "Anúncio"],
  [/^\/pedidos\/novo/, "Novo pedido de moradia"],
  [/^\/termos/, "Termos de uso"],
  [/^\/privacidade/, "Privacidade"],
];

export function tituloDaTelaApp(pathname: string): string {
  for (const [re, t] of TITULOS_APP) if (re.test(pathname)) return t;
  return "Viva Nomads";
}

/** Abas principais do app (sem botão Voltar no cabeçalho); o painel /admin também é raiz. */
export function ehAbaRaizApp(pathname: string): boolean {
  return pathname === "/admin" || [...MORADOR_TABS, ...PROPRIETARIO_TABS, ...PARCEIRO_TABS].some((t) => t.href.split("#")[0] === pathname);
}

/** Telas /admin/* (exceto o painel): o Voltar do app leva sempre ao painel /admin, não ao histórico. */
export function voltaParaAdmin(pathname: string): boolean {
  return pathname.startsWith("/admin/");
}

/**
 * Telas de FLUXO escondem a barra inferior (seção 2.1): filtros, candidatar-se,
 * conversa, anunciar imóvel, qualificação e fechamento. Mostram cabeçalho de
 * fluxo (voltar + ação) em vez da barra.
 */
export function isFlowRoute(pathname: string): boolean {
  return (
    pathname.startsWith("/dashboard/imoveis/novo") ||
    /^\/dashboard\/imoveis\/[^/]+\/editar/.test(pathname) ||
    pathname.startsWith("/qualificar") ||
    pathname.startsWith("/dashboard/fechamento") ||
    /^\/imoveis\/[^/]+\/candidatar/.test(pathname)
  );
}
