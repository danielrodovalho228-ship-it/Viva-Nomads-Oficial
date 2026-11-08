# Prontidão dos PRs da Pista B para o merge dirigido (08/11/2026)

Todos em draft, sem conflito com a `main` de 08/11 (branches atualizadas por merge, sem reescrever histórico). Nenhum mexe em `AUTOMACOES_ATIVO`, `CAUCAO_PRAZOS_ATIVA` (continua desligada), `VISTORIA_ATIVA` (continua desligada), 2FA nem variáveis da Vercel. Nenhum tem prova ao vivo: as provas são dos trabalhadores de QA.

**Ordem sugerida de merge:** #3292 (0326) antes de #3329 (0327); o resto é independente. A última migração na `main` é a 0325.

| PR | Item | O que prova / entrega | Testes | Risco | Prova de QA depois do merge |
|---|---|---|---|---|---|
| [#3292](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3292) | E687 | Mudança/frete chega ao parceiro aprovado com empresa e veículo (`parceiros.dados_categoria`, 0326) | `e687-dados-da-categoria.test.ts`, `tests/migracoes`, estilo | Migração aditiva (coluna com default `{}`); empresa/veículo não vão à página pública (decisão conservadora) | Ativar parceiro de Mudança de teste → "Empresa de mudança" e "Veículo" no painel |
| [#3296](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3296) | E691 | Selo da assinatura do laudo (número, versão, data, hash) no painel do avaliador e no bloco do dono | `e691-selo-assinatura.test.ts`, estilo | Só UI, atrás de `VISTORIA_ATIVA` (desligada) | Só com a chave ligada em teste: laudo emitido → selo visível às duas partes |
| [#3297](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3297) | E707 | Devolução da caução devida de imediato (OK do dono/silêncio no 7º dia), 30 dias só como teto, parte indiscutível exposta | `e707-composicao-prazos.test.ts`, `e707-simulador-reembolso.test.ts`, caução, estilo, calendário | Atrás de `CAUCAO_PRAZOS_ATIVA` (desligada); marco "check-out confirmado" = último dia do último bloco; aviso aos dois e livro aguardam parecer da Dra. Beatriz | Só com a chave ligada em teste |
| [#3329](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3329) | E689 | 3 estadias-semente `[TESTE QA]` com chegada, meio e semana da saída no dia ALVO + 2 pedidos de limpeza (0327) | `massa-estadia-semente-e689.test.ts`, `tests/migracoes`, estilo | Só contas `is_teste`; dia exato do cron: se a Action aplicar depois da rodada de ALVO, os e-mails da jornada não saem (0328 reposiciona, se preciso) | Rodada do cron no dia ALVO: e-mails E663, botão E664, pedidos de limpeza |
| [#3330](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3330) | E690 | Levantamento: UDI-002 já tem a avaliação de teste registrada; falta só a ativação pelo admin (duas etapas) | (só doc) | Nenhum (sem código) | Admin observador ativa o UDI-002 e confere o passo 5 em `/dashboard/parceiro/avaliacao` |
| [#3326](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3326) | Erros/vazios r4 | Pedir código de assinatura: falha de leitura não vira "Contrato não encontrado" | `e293-leitura-contrato-codigo.test.ts` | Baixo (só mensagem de erro) | — |
| [#3344](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3344) | Erros/vazios r5 | Aditivo da estadia: falha de leitura não vira "Proposta não encontrada" nem "ainda não assinou" | `e293-leituras-aditivo.test.ts` | Baixo | — |
| [#3354](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3354) | Erros/vazios r6 | Conferência: falha de leitura não vira "aberta" nem "sem laudo para trocar" | `e293-leituras-conferencia.test.ts` | Baixo | — |

## Código que ainda falta nos itens
Nenhum. O que resta depende de terceiros: spec `fluxo-parceiros-completo` §2 (E687), parecer da Dra. Beatriz para o aviso e o livro (E707), ativação do UDI-002 pelo admin ou decisão sobre a migração de 3 linhas (E690), hash do PDF no selo se quiserem (E691).

## Conferência de CI e conflito (08/11/2026, depois das 02:50 UTC)
Cada PR foi lido no GitHub e teve o merge da `main` testado localmente. Todos seguem em draft, sem merge meu.

| PR | Head conferido | `verify` | `lab-critico` | `e2e` | Conflito com a `main` |
|---|---|---|---|---|---|
| #3292 (E687) | `02307c1` | verde | verde | verde | não |
| #3329 (E689) | `186e6d2` | verde | verde | verde | não |
| #3330 (E690) | `f843d91` | verde | verde | verde | não |
| #3296 (E691) | `e9436d0` | verde | verde | verde | não |
| #3297 (E707) | `b35a3d4` | verde | verde | verde | não |
| #3326 (rodada 4) | `a3750cc` | verde | verde | verde | não |
| #3344 (rodada 5) | `77a30f7` | verde | verde | verde | não |
| #3354 (rodada 6) | `e00f2b5` | verde | verde | verde | não |

As rodadas 4 a 6 (#3326, #3344, #3354) rodaram o CI sobre uma `main` anterior; o merge da `main` de agora entra limpo nas três e os heads não mudaram. Se o chat principal quiser o CI sobre a `main` atual antes do merge, basta atualizar a branch (merge, sem reescrever histórico).

Observação do #3330: o primeiro `verify` travou no passo `Build` (runner sem resposta, typecheck e testes já verdes). Foi cancelado e refeito num head novo, com uma melhoria real no doc do E690.
