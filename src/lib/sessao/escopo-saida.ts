/**
 * E391 (1) — o escopo de cada saída da conta. O `signOut()` do Supabase, sem argumento, é GLOBAL: revoga a sessão em
 * TODOS os aparelhos. Por isso o "Sair" de um celular derrubava o computador (e a expiração de 24h de um aparelho
 * derrubava os outros). Regra:
 *  • "Sair" (menu da Conta, casca do painel) e a expiração de 24h → LOCAL: só este aparelho.
 *  • "Sair de todos os aparelhos" (Conta → Segurança) → GLOBAL, botão separado e com confirmação na página.
 *  • Excluir a conta → GLOBAL (a conta deixa de existir; nenhuma sessão deve sobrar).
 * A configuração do Supabase (tempo do token, sessões) NÃO muda aqui: isso é decisão do Daniel.
 */
export type EscopoSaida = "local" | "global";

export const ESCOPO_SAIR: EscopoSaida = "local";
export const ESCOPO_EXPIRACAO_24H: EscopoSaida = "local";
export const ESCOPO_SAIR_DE_TODOS: EscopoSaida = "global";
export const ESCOPO_EXCLUIR_CONTA: EscopoSaida = "global";

export const TEXTO_SAIR_DE_TODOS = {
  titulo: "Sair de todos os aparelhos",
  explicacao:
    "Encerra a sua sessão em todos os celulares e computadores, inclusive neste. Use se perdeu um aparelho ou entrou num computador que não é seu. Os outros aparelhos voltam a pedir o login.",
  aviso: "Sair da conta em todos os aparelhos, inclusive neste?",
  confirmar: "Sair de todos",
  erro: "Não foi possível sair dos outros aparelhos agora. Tente de novo em instantes.",
} as const;
