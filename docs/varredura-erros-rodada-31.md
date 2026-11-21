# Varredura de erros — rodada 31 (achados 144 a 148)

**Padrão:** leitura de registro que falha (banco fora, rede) e vira "não encontrado". Nas ações de DECISÃO do admin isso é pior
que numa lista: o admin acha que o registro sumiu e desiste, ou decide no escuro. Esta rodada pegou o padrão em arquivos que os
drafts das rodadas 25 a 30 não tocam (busca por `const { data } = await …maybeSingle()` seguido de `if (!x) … não encontrad…`:
20 pontos em 10 arquivos).

**Corrigidos (6 pontos, 3 arquivos):** a leitura destrutura o `error` e a falha diz "Não foi possível ler … agora. Tente de novo."
ANTES do "não encontrado". O "não encontrado" fica só para o registro de fato inexistente.
| Achado | Onde | Leitura |
|---|---|---|
| 144 | Parceiros › conferir / aprovar / recusar pedido (`parceiros/admin-actions.ts`) | `parceiro_solicitacoes` (3 leituras) |
| 145 | Parceiros › tirar o selo de nota fiscal (`parceiros/admin-actions.ts`) | `chamados` e `parceiros` |
| 146 | Documentos › reenviar e-mail (`data/emitidos-actions.ts`) | `documentos_registro` |
| 147 | Documentos › falha de emissão (`data/documentos-falhas-actions.ts`) | `documentos_falhas` |

**Ficaram de fora (de propósito, para as próximas rodadas):** `estadia-actions` (2), `servicos-morador-actions` (2),
`agentes-actions` (2), `manutencao-actions` (2), `vistoria/actions` (2), `vistoria/laudo-actions` (1), `painel-actions` (1)
e o segundo ponto de `emitidos-actions`. Não mexi neles aqui para o PR ficar de um tema só (decisão do admin sobre registro).

**Teste permanente:** `src/lib/data/achado144-148-admin-leitura.test.ts` (7, um por leitura; escrito antes, 7 vermelhos).
Escopo: `node --test` do teste + `src/lib/parceiros` 165/165; `tsc` limpo. Sem migração, sem chave.
