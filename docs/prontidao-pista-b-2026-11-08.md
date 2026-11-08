# Prontidão dos PRs da Pista B para o merge dirigido (08/11/2026)

## Atualização de 08/11 (manhã): PRs #3375 a #3415 e o que já entrou na `main`

**Já mesclados na `main` desde a primeira versão deste resumo:** #3292 (E687, 0326), #3296 (E691), #3329 (E689, 0327), #3268 (E682, 72 h). A 0326 e a 0327 já foram aplicadas em produção. A última migração aplicada é a **0327**.
**Ainda abertos da primeira versão:** #3297 (E707, atrás de `CAUCAO_PRAZOS_ATIVA` desligada, aguarda o parecer da Dra. Beatriz), #3330 (E690, só doc; a ativação do UDI-002 é do admin com duas etapas), #3326, #3344, #3354 (rodadas 4 a 6).

**PRs novos da Pista B (todos em rascunho, `verify`, `lab-critico` e `e2e` verdes, sem conflito com a `main` de agora, testado por merge local):**

| PR | Item | O que entrega | Migração | Risco | Prova de QA depois do merge |
|---|---|---|---|---|---|
| [#3375](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3375) | Erros/vazios r7 | Abrir chamado: falha ao conferir o contexto não o descarta (a ordem URGENTE de "não consegui entrar" não some em silêncio) | não | Baixo | — |
| [#3376](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3376) | Erros/vazios r8 | Manutenção: falha ao ler a ordem não vira "não encontrada" nem "só o proprietário" | não | Baixo | — |
| [#3378](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3378) | Erros/vazios r9 | Contador de imóveis do pedido: falha de leitura não vira "0 combinam" | não | Baixo | — |
| [#3383](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3383) | Erros/vazios r10 | Propostas: falha de leitura não vira 404 nem "não encontrada" nem "candidatura encerrada" | não | Baixo (a página cai no `error.tsx` em falha) | — |
| [#3384](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3384) | Erros/vazios r11 | Visitas: falha de leitura não vira "imóvel indisponível" nem "pedido não encontrado" | não | Baixo | — |
| [#3393](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3393) | E293 retenção | Inventário descreve as colunas das migrações 0317, 0320, 0323 e 0325 (só texto) | não | Nenhum | — |
| [#3398](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3398) | E719 | Cartão do contrato lê o estado real da avaliação; publicada tira o "Aguardando a outra parte" | não | Baixo (UI) | Contrato com as duas avaliações publicadas (a0268a00) |
| [#3401](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3401) | E689 | **0328**: reposiciona os blocos das estadias-semente (o app lê o último dia do bloco como a saída) | 0328 | Baixo (só dados de teste) | Jornada de e-mails no dia ALVO; a Action recalcula ALVO ao aplicar |
| [#3402](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3402) | E687 | **0329**: parceiro de Mudança aprovado em conta de teste (`inquilino2`) para o ramo positivo | 0329 | Baixo (só dados de teste) | Painel do parceiro mostra a própria empresa e o veículo |
| [#3406](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3406) | E699 (a)/(c) | **0330**: CPF de teste na dona `proprietario-qa` (sem laudo = identidade pendente) | 0330 | Baixo (só dados de teste) | "Falta para publicar" com identidade; link "Resolver" da trava |
| [#3407](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3407) | E660 (resíduo) | Ficha "o que tem dentro" na edição do anúncio publicado (mesma fonte do assistente) | não | Médio-baixo (UI de edição; só grava depois que o dono mexe) | Editar anúncio publicado, abrir "O que tem dentro", salvar |
| [#3415](https://github.com/danielrodovalho228-ship-it/Viva-Nomads-Oficial/pull/3415) | E719 | Só doc: comparação dos duplicados #3397 × #3398 | não | Nenhum | — |

**Ordem das migrações:** 0328 (#3401), 0329 (#3402) e 0330 (#3406) são independentes e idempotentes; a Action aplica o que ainda não está registrado, em qualquer ordem. Nenhuma depende de código (são todas só dado de teste).

**Duplicidade E719:** #3397 (Pista A) e #3398 (Pista B) resolvem o mesmo defeito. Comparação em `docs/e719-comparacao-3397-3398.md` (#3415): o **#3398** atende o critério do relato; no #3397 o cabeçalho "Avaliação · Aguardando a outra parte" continua na tela. Recomendação: mesclar o #3398 e não mesclar o #3397 (nenhum foi fechado; quem decide é o chat principal).

**E477 (Pendências, Fotos de perfil e Imóveis):** já está na `main` (commit `ad10d5900`, de 07/11 06:45 UTC, depois da re-prova de 06/11 23:32). As ações do servidor recusam a observadora e os controles saem de toda linha com o aviso "Só leitura". O detalhe do pedido de parceiro (`/admin/parceiros/pedidos/[id]`) não tem controle de escrita, então não precisa do aviso. Os 29 testes `e477-*` e `observador*` passam. Falta só a re-prova da QA na tela publicada.

**Guardas intocadas:** `AUTOMACOES_ATIVO` ("1"), `CAUCAO_PRAZOS_ATIVA` e `VISTORIA_ATIVA` (desligadas), contrato-semente VN-CT-D5D50247, 2FA e variáveis da Vercel.

---

## Versão anterior (08/11, 02:50 UTC)

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
