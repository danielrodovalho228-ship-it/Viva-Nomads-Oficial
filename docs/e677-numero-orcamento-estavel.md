# E677 — o número de orçamento não muda; a ordem da lista mudava

**Relato (07/11, retomada do E652):** na lista de Orçamentos do inquilino1, a mesma proposta lia ORC-2026-0007 às 02:46 e
ORC-2026-0013 às 02:57, com a contagem inalterada (5).

**Evidência (somente leitura da produção):** `propostas.numero` é único (`unique`) e igual ao número do registro único
(`documentos_registro`) de cada proposta — ex.: ORC-2026-0007 (recusada, 30/10) e ORC-2026-0013 (vista, 07/11) são
propostas distintas. Nenhum número foi reescrito. O número exibido na lista é o `numero` da própria linha.

**Causa:** a lista ordenava por `atualizada_em`. Abrir uma proposta a marca como "vista" e a sobe para o topo; responder
ou expirar também. As propostas de teste do mesmo imóvel têm o mesmo título e só se distinguem pelo número, então a
linha de uma posição passava a ser OUTRA proposta sem nenhuma ação da pessoa, e a contagem não muda.

**Correção (sem migração):** `listarPropostas` ordena pelo envio (`criada_em` desc, desempate por `numero` desc). A ordem só
muda quando nasce uma proposta nova.

**Teste:** `src/lib/data/e677-ordem-estavel-propostas.test.ts` (escrito antes, visto vermelho).

**Dúvida:** não mexi na numeração (`next_document_number`), que está estável. Se a QA quiser a lista com "a mais recentemente
movida primeiro" (como era), é voltar a ordem para `atualizada_em`, ao custo desse reembaralhamento.

## Evidência adicional (relato de 07/11: "[TESTE QA] Resumo semanal 0276 B", v1, R$ 4.802)
Leitura somente-leitura da produção: esse imóvel tem **uma única proposta**, `ORC-2026-0013` (R$ 4.801,67, v1, "vista", criada
em 06/11 01:59 UTC, atualizada em 07/11 00:55 UTC), e o registro único (`documentos_registro`) tem o mesmo número. O
`ORC-2026-0007` é de **outro imóvel** ("Casa mobiliada 2 quartos", recusada em 30/10). Ou seja, não há dois números para a
mesma proposta: o que a QA viu foram **duas propostas diferentes na mesma posição da lista**. Com a ordem por
`atualizada_em`, uma proposta que muda de estado (vista, recusada, expirada) troca de lugar com as vizinhas, e as linhas
dos imóveis de teste só se distinguem pelo número. A ordem por envio (`criada_em`) deste PR evita o reembaralhamento.
