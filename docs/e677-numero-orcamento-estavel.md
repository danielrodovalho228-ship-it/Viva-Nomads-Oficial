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
