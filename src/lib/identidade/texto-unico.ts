/*
  E757 — UM estado, dito do MESMO jeito em toda tela, até a Certta entrar: a verificação AUTOMÁTICA de identidade ainda
  não abriu; HOJE a equipe da Viva confere o documento. Nenhuma tela promete data nem "em breve" e nenhuma apresenta
  como em andamento uma checagem que não abriu. Quando a Certta entrar, é aqui (e em estado.ts) que o texto muda.
  Módulo PURO (sem imports) para valer em servidor, cliente e testes.
*/
export const IDENTIDADE_NAO_ABRIU = "A verificação automática de identidade ainda não abriu";
export const IDENTIDADE_HOJE = "A equipe da Viva confere o documento";
/** A frase completa, para parágrafos. */
export const IDENTIDADE_ESTADO_FRASE = `${IDENTIDADE_NAO_ABRIU}. Por ora, ${IDENTIDADE_HOJE[0].toLowerCase()}${IDENTIDADE_HOJE.slice(1)}.`;
/** Versão de uma linha, para complementos de passo e listas. */
export const IDENTIDADE_ESTADO_CURTO = "verificação automática ainda não abriu · a equipe da Viva confere o documento";
