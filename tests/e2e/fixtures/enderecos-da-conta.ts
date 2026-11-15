/*
  E744 (passo 9) — a matriz dos endereços da Conta que o t1660 percorre a 390 e a 1280 px: para onde cada um leva, o
  título da tela e o item ativo do menu lateral. Dado puro (sem Playwright): a guarda
  tests/laboratorio/e744-enderecos-da-conta.test.ts confere no `npm test` que nenhuma seção, apelido ou âncora antiga
  do produto ficou sem linha aqui.
  Cada linha cita a decisão registrada que ela cobra. /dashboard/conta (o menu no celular, o Perfil no computador) é do
  t1611 (E798) e das varreduras; aqui ele só entra nos casos que o t1611 não tem (1ª visita e largura desatualizada).
*/
import type { SecaoConta } from "../../../src/lib/conta/secoes.ts";

export interface EnderecoDaConta {
  rota: string;
  /** Caminho + consulta em que a tela assenta (igual à rota quando a tela é dela mesma). */
  destino: string;
  /** O H1 visível. */
  h1: string;
  /** Item marcado no menu lateral (≥ 1024 px); null = nenhum (E493: a Ajuda não está na lista da Conta). */
  menu: SecaoConta | null;
  decisao: string;
}

export const ENDERECOS_DA_CONTA: readonly EnderecoDaConta[] = [
  { rota: "/dashboard/conta/perfil", destino: "/dashboard/conta/perfil", h1: "Perfil", menu: "perfil", decisao: "A1 (CONTA-A): uma tela por seção" },
  { rota: "/dashboard/conta/perfil-publico", destino: "/dashboard/conta/perfil-publico", h1: "Seu perfil público", menu: "perfil", decisao: "E898: subtela do Perfil, dentro da casca" },
  { rota: "/dashboard/conta/papeis", destino: "/dashboard/conta/papeis", h1: "Como você usa a Viva", menu: "papeis", decisao: "A1 / NAV-A" },
  { rota: "/dashboard/conta/avaliacoes", destino: "/dashboard/avaliacoes?aba=recebidas", h1: "Avaliações", menu: "avaliacoes", decisao: "E679 (E85) + E798: vai para Avaliações, aba Recebidas, pelo servidor" },
  { rota: "/dashboard/conta/dados", destino: "/dashboard/conta/dados", h1: "Meus dados", menu: "dados", decisao: "A1 (mockup perfil-04)" },
  { rota: "/dashboard/conta/privacidade", destino: "/dashboard/conta/privacidade", h1: "Privacidade", menu: "privacidade", decisao: "A1 (mockup perfil-05)" },
  { rota: "/dashboard/conta/seguranca", destino: "/dashboard/conta/seguranca", h1: "Segurança e verificações", menu: "seguranca", decisao: "E176 (parte 2): item próprio da Conta" },
  { rota: "/dashboard/conta/notificacoes", destino: "/dashboard/notificacoes", h1: "Notificações", menu: "notificacoes", decisao: "E176 (parte 2): Notificações é uma página só" },
  { rota: "/dashboard/conta/pagamentos", destino: "/dashboard/conta/pagamentos", h1: "Pagamentos", menu: "pagamentos", decisao: "A1" },
  { rota: "/dashboard/conta/ajuda", destino: "/dashboard/conta/ajuda", h1: "Ajuda", menu: null, decisao: "E493: a Ajuda tem tela, mas não entra na lista da Conta" },
  { rota: "/dashboard/conta/excluir", destino: "/dashboard/conta/excluir", h1: "Sair da Viva", menu: "privacidade", decisao: "A8: subtela de Privacidade, no endereço de antes" },
  { rota: "/dashboard/conta/plano", destino: "/dashboard/conta/plano", h1: "Pagamentos", menu: "pagamentos", decisao: "E224: Conta › Plano mora em Pagamentos" },
];

/** Endereço que não é seção nem apelido: a tela de "Página não encontrada" do painel. */
export const SECAO_INEXISTENTE = "/dashboard/conta/secao-que-nao-existe";

export interface AncoraAntiga {
  /** /dashboard/conta#<ancora>: link da antiga página longa (salvo, de e-mail ou de tela antiga). */
  ancora: string;
  /** Tela nova; traz a âncora quando ela ainda existe lá. */
  destino: string;
  h1: string;
  menu: SecaoConta;
}

export const ANCORAS_ANTIGAS: readonly AncoraAntiga[] = [
  { ancora: "confianca", destino: "/dashboard/conta/seguranca", h1: "Segurança e verificações", menu: "seguranca" },
  { ancora: "seguranca", destino: "/dashboard/conta/seguranca", h1: "Segurança e verificações", menu: "seguranca" },
  { ancora: "documento", destino: "/dashboard/conta/dados#documento", h1: "Meus dados", menu: "dados" },
  { ancora: "celular", destino: "/dashboard/conta/dados#celular", h1: "Meus dados", menu: "dados" },
  { ancora: "dados", destino: "/dashboard/conta/dados", h1: "Meus dados", menu: "dados" },
  { ancora: "local-trabalho", destino: "/dashboard/conta/dados", h1: "Meus dados", menu: "dados" },
  { ancora: "avaliacoes", destino: "/dashboard/avaliacoes", h1: "Avaliações", menu: "avaliacoes" },
  { ancora: "papeis", destino: "/dashboard/conta/papeis", h1: "Como você usa a Viva", menu: "papeis" },
  { ancora: "notificacoes", destino: "/dashboard/notificacoes", h1: "Notificações", menu: "notificacoes" },
  { ancora: "pagamentos", destino: "/dashboard/conta/pagamentos", h1: "Pagamentos", menu: "pagamentos" },
  { ancora: "sair-da-viva", destino: "/dashboard/conta/excluir", h1: "Sair da Viva", menu: "privacidade" },
  { ancora: "perfil-publico", destino: "/dashboard/conta/perfil", h1: "Perfil", menu: "perfil" },
  { ancora: "pets", destino: "/dashboard/conta/perfil", h1: "Perfil", menu: "perfil" },
];
