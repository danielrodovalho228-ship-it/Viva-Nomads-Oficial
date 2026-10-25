import { papelAtivo } from "./papel/papel-ativo.ts";
import {
  Search,
  MessageSquare,
  House,
  Building2,
  KeyRound,
  Wallet,
  ClipboardList,
  CalendarDays,
  Users,
  FileSignature,
} from "lucide-react";
import { abasDoPapelPainel, type AbaPainel, type ContextoAbas, type IconeAba } from "../config/abas-painel.ts";

/**
 * Abas da BARRA INFERIOR. MENUS-5: saem da MESMA lista das abas do topo do computador (config/abas-painel.ts) —
 * rótulos e hrefs idênticos nos dois. No máximo 5 por papel; a aba "Perfil" saiu (a Conta abre no avatar do topo).
 *  - morador:      Início · Buscar · Pedidos · Mensagens · Minha estadia (só com contrato)
 *  - proprietário: Início · Anúncios · Interessados · Contratos · Mensagens
 *  - parceiro:     Início · Pedidos · Agenda · Ganhos · Mensagens
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
  /** Prefixos que também deixam a aba ativa (ex.: as subabas). */
  ativoEm?: readonly string[];
  /** Nome acessível mais completo que o rótulo. */
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

const ICONES: Record<IconeAba, MobileTab["icon"]> = {
  inicio: House,
  buscar: Search,
  pedidos: ClipboardList,
  mensagens: MessageSquare,
  estadia: KeyRound,
  anuncios: Building2,
  interessados: Users,
  contratos: FileSignature,
  agenda: CalendarDays,
  ganhos: Wallet,
};

/** Aba do topo → aba da barra de baixo (mesmo rótulo e href; as subabas também acendem a aba). */
function paraBarra(a: AbaPainel): MobileTab {
  return {
    href: a.href,
    label: a.rotulo,
    icon: ICONES[a.icone],
    authRequired: a.authRequired,
    hrefSemLogin: a.hrefSemLogin,
    badge: a.badge,
    descricao: a.descricao,
    ativoEm: [...(a.ativoEm ?? []), ...(a.subabas ?? []).flatMap((s) => [s.href, ...(s.ativoEm ?? [])])].filter((h) => h !== a.href),
  };
}

/** As abas da barra do papel (com contrato, o morador ganha "Minha estadia"). */
export function abasDaBarra(papel: PapelBarra, ctx?: ContextoAbas): MobileTab[] {
  return abasDoPapelPainel(papel, ctx).map(paraBarra);
}

export const MORADOR_TABS: MobileTab[] = abasDaBarra("morador", { comContrato: true });
export const PROPRIETARIO_TABS: MobileTab[] = abasDaBarra("proprietario");
export const PARCEIRO_TABS: MobileTab[] = abasDaBarra("parceiro");

export const ABAS_POR_PAPEL: Record<PapelBarra, MobileTab[]> = {
  morador: MORADOR_TABS,
  proprietario: PROPRIETARIO_TABS,
  parceiro: PARCEIRO_TABS,
};

/**
 * Papel da barra = o papel ATIVO (PAPEL-B, fonte única em lib/papel/papel-ativo.ts): admin nas telas /admin → nenhum
 * (Equipe, sem barra); a área da página aberta (proprietário, morador ou parceiro aprovado); a escolha de parceiro (selo
 * do topo ou Conta, gravada no perfil); senão o modo. `preferenciaParceiro` = parceiro escolhido como papel ativo.
 */
export function papelDaBarra(p: {
  admin: boolean;
  modo: "owner" | "tenant";
  parceiroAprovado: boolean;
  preferenciaParceiro?: boolean;
  pathname?: string;
}): PapelBarra | null {
  return papelAtivo({ admin: p.admin, modo: p.modo, parceiroEscolhido: !!p.preferenciaParceiro, parceiroAprovado: p.parceiroAprovado, pathname: p.pathname });
}

/** Abas do papel (admin: nenhuma). */
export function abasDoPapel(papel: PapelBarra | null, ctx?: ContextoAbas): MobileTab[] {
  return papel ? abasDaBarra(papel, ctx) : [];
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
