# E742 — 400 em /api/proximidades no "Qualificar o imóvel" (achado L-104, Pista C)
**Causa:** ao abrir o editor de um anúncio do próprio dono que ainda não tem CEP (draft_data / cep_proximidades) nem ponto gravado (lat/lng) — o caso do imóvel da massa —, o navegador chama a API só com o `propertyId`; sem endereço para buscar, ela respondia 400 "CEP inválido" e o console registrava o erro.
**Correção (sem migração):** `enderecoDoAnuncio` distingue "não é o seu anúncio / inválido" (null → 400 como antes) de "é o seu, mas ainda sem endereço" (`sem_endereco` → 200 `{ itens: [], fonte: "sem_endereco" }`). O 400 continua para CEP inválido no corpo, anúncio de outra pessoa e ação "lugar" sem origem. A busca pelo ponto gravado (E593) não mudou.
**Para a Pista C:** o spec `t1418` tolera esse 400 só em "Qualificar o imóvel" (anotação L-104); com este PR mesclado, a tolerância pode sair.
Teste: `src/lib/proximidades/e742-sem-endereco.test.ts` (3) + ajuste da asserção do E593. Sem prova ao vivo.
