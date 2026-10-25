/** Ações da "Nova jornada de teste" no log de admin (moderacao_log) — adendo ao prompt 28. */
export const ACOES_JORNADA = { criada: "jornada_teste_criada", reaproveitada: "jornada_teste_reaproveitada", erro: "jornada_teste_erro" } as const;
/** Tipo do alvo gravado no log: a candidatura (tabela leads) quando deu certo; o anúncio quando deu erro. */
export const ALVOS_JORNADA = { candidatura: "lead", anuncio: "property" } as const;

/**
 * As outras ações de /admin › Dados de teste no mesmo log de admin (Prompt 29, item 2): cada botão pede confirmação
 * na página e grava aqui. Separadas das jornadas para a lista "Últimas jornadas de teste" continuar só com elas.
 */
export const ACOES_DADOS_TESTE = {
  jornadasEncerradas: "jornadas_teste_encerradas",
  carteiraSemeada: "carteira_teste_semeada",
  carteiraLimpa: "carteira_teste_limpa",
} as const;

export const ROTULO_ACAO_DADOS_TESTE: Record<string, string> = {
  [ACOES_DADOS_TESTE.jornadasEncerradas]: "Jornadas de teste encerradas",
  [ACOES_DADOS_TESTE.carteiraSemeada]: "Carteira de teste semeada",
  [ACOES_DADOS_TESTE.carteiraLimpa]: "Carteira de teste limpa",
};
