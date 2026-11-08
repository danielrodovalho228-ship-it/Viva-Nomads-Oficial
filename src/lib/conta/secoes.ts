/*
  A1 (sequência-mestre CONTA-A, mockups perfil-01..08 aprovados em 23/10): a Conta em OITO telas, uma por seção, com o
  menu lateral "Conta" no computador e "‹ Conta" no celular. Fonte única das seções (ordem do desenho aprovado) e de
  qual está ativa pela rota. Puro (node --test).
*/

/** E75: a linha institucional que fecha toda tela da Conta e o menu. */
export const LINHA_FECHAMENTO_CONTA = "Viva Nomads · Uberlândia, MG";

export type SecaoConta = "perfil" | "avaliacoes" | "papeis" | "dados" | "privacidade" | "seguranca" | "notificacoes" | "pagamentos" | "ajuda";

export interface ItemSecao {
  id: SecaoConta;
  rotulo: string;
  href: string;
  /** Nome do ícone (lucide), resolvido na tela. */
  icone: "UserRound" | "Star" | "Users" | "FileText" | "Shield" | "ShieldCheck" | "Bell" | "CreditCard" | "CircleHelp";
  /** Linha curta do menu do celular. */
  descricao: string;
  /** NAV-A: o nome no menu, quando difere do título da tela. E490: nenhuma seção usa mais (o menu e o título são o mesmo nome). */
  rotuloMenu?: string;
  /**
   * E493: a seção existe (rota, título, casca) mas NÃO entra na lista de seções — a porta dela é outra. Hoje só a Ajuda,
   * cuja porta é o "Ajuda" do menu da Conta (avatar, D2/E185); antes ela aparecia ali e de novo na lista da Conta.
   */
  foraDoMenu?: true;
}

export const SECOES_CONTA: readonly ItemSecao[] = [
  { id: "perfil", rotulo: "Perfil", href: "/dashboard/conta/perfil", icone: "UserRound", descricao: "Foto, nome, sobre você e o que o proprietário vê." },
  // NAV-A (24/10): a ordem da Conta é Perfil, Como você usa a Viva, Avaliações, Dados, Privacidade, Notificações,
  // Pagamentos, Ajuda (e Sair, no menu do celular).
  { id: "papeis", rotulo: "Como você usa a Viva", href: "/dashboard/conta/papeis", icone: "Users", descricao: "O que você quer fazer na Viva." },
  { id: "avaliacoes", rotulo: "Avaliações", href: "/dashboard/avaliacoes", icone: "Star", descricao: "O que disseram de você depois de cada estadia." },
  { id: "dados", rotulo: "Dados", href: "/dashboard/conta/dados", icone: "FileText", descricao: "Nome, contato e documento. Só a Viva vê." },
  { id: "privacidade", rotulo: "Privacidade", href: "/dashboard/conta/privacidade", icone: "Shield", descricao: "O que os outros veem, baixar ou excluir seus dados." },
  // E176 (parte 2): "Segurança e verificações" ganha item próprio na Conta (antes, uma subtela de Privacidade).
  { id: "seguranca", rotulo: "Segurança e verificações", href: "/dashboard/conta/seguranca", icone: "ShieldCheck", descricao: "Senha, duas etapas e as verificações da conta." },
  // E176 (parte 2): "Notificações" é UMA página só — a do sino (/dashboard/notificacoes), na casca da Conta, com as
  // preferências (mockup perfil-06) e os avisos. /dashboard/conta/notificacoes redireciona para ela.
  { id: "notificacoes", rotulo: "Notificações", href: "/dashboard/notificacoes", icone: "Bell", descricao: "Seus avisos e como a Viva avisa você." },
  { id: "pagamentos", rotulo: "Pagamentos", href: "/dashboard/conta/pagamentos", icone: "CreditCard", descricao: "Para onde vai o valor mensal." },
  { id: "ajuda", rotulo: "Ajuda", href: "/dashboard/conta/ajuda", icone: "CircleHelp", descricao: "Central de ajuda, termos e privacidade.", foraDoMenu: true },
] as const;

/** E493: as seções que aparecem na lista da Conta (lateral no computador, lista no celular) — sem a Ajuda. */
export const SECOES_MENU_CONTA: readonly ItemSecao[] = SECOES_CONTA.filter((s) => !s.foraDoMenu);

/** Endereços antigos das subtelas que agora caem numa seção nova (links salvos, e-mails, app). */
export const ALIAS_SECAO: Readonly<Record<string, SecaoConta>> = {
  // /dashboard/conta/excluir (Sair da Viva) é subtela de Privacidade, aberta por "Excluir minha conta" (perfil-05).
  excluir: "privacidade",
  // E224: Conta › Plano (a elegibilidade do Plano Gestor) mora no cartão de Pagamentos (#plano).
  plano: "pagamentos",
};

/** A seção da rota: /dashboard/conta → perfil; /dashboard/conta/<id ou alias> → a seção; outra coisa → null. */
export function secaoDaRota(pathname: string): SecaoConta | null {
  const p = pathname.split(/[?#]/)[0].replace(/\/$/, "");
  if (p === "/dashboard/conta") return "perfil";
  if (p === "/dashboard/notificacoes") return "notificacoes";
  const m = p.match(/^\/dashboard\/conta\/([^/]+)$/);
  if (!m) return null;
  const s = ALIAS_SECAO[m[1]] ?? m[1];
  return SECOES_CONTA.some((x) => x.id === s) ? (s as SecaoConta) : null;
}

/**
 * Âncoras da antiga página longa (/dashboard/conta#…) que chegam de links salvos, e-mails e telas antigas: cada uma
 * tem agora a sua tela. Devolve o destino (com a âncora que ainda existe lá) ou null quando não há o que trocar.
 */
const ANCORA_SECAO: Readonly<Record<string, string>> = {
  confianca: "/dashboard/conta/seguranca",
  seguranca: "/dashboard/conta/seguranca",
  documento: "/dashboard/conta/dados#documento",
  celular: "/dashboard/conta/dados#celular",
  dados: "/dashboard/conta/dados",
  "local-trabalho": "/dashboard/conta/dados",
  avaliacoes: "/dashboard/avaliacoes",
  papeis: "/dashboard/conta/papeis",
  notificacoes: "/dashboard/notificacoes",
  pagamentos: "/dashboard/conta/pagamentos",
  "sair-da-viva": "/dashboard/conta/excluir",
  "perfil-publico": "/dashboard/conta/perfil",
  pets: "/dashboard/conta/perfil",
};

export function destinoDaAncora(hash: string, search = ""): string | null {
  const destino = ANCORA_SECAO[hash.replace(/^#/, "")];
  if (!destino) return null;
  const [rota, ancora] = destino.split("#");
  return `${rota}${search && search !== "?" ? search : ""}${ancora ? `#${ancora}` : ""}`;
}

/**
 * E492 (+E552): no computador a Conta tem UM endereço para o Perfil — /dashboard/conta leva a /dashboard/conta/perfil.
 * Uma âncora antiga (destinoDaAncora) vence. No celular, /dashboard/conta continua sendo o menu.
 */
export function destinoDaContaNoComputador(destinoAncora: string | null): string {
  return destinoAncora ?? "/dashboard/conta/perfil";
}

export const itemDaSecao = (id: SecaoConta): ItemSecao => SECOES_CONTA.find((s) => s.id === id)!;
