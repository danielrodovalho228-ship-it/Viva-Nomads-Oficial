# E742 — 400 em /api/proximidades no "Qualificar o imóvel" (achado L-104, Pista C)
**Causa:** ao abrir o editor de um anúncio do próprio dono que ainda não tem CEP (draft_data / cep_proximidades) nem ponto gravado (lat/lng) — o caso do imóvel da massa —, o navegador chama a API só com o `propertyId`; sem endereço para buscar, ela respondia 400 "CEP inválido" e o console registrava o erro.
**Correção (sem migração):** `enderecoDoAnuncio` distingue "não é o seu anúncio / inválido" (null → 400 como antes) de "é o seu, mas ainda sem endereço" (`sem_endereco` → 200 `{ itens: [], fonte: "sem_endereco" }`). O 400 continua para CEP inválido no corpo, anúncio de outra pessoa e ação "lugar" sem origem. A busca pelo ponto gravado (E593) não mudou.
**Para a Pista C:** o spec `t1418` tolera esse 400 só em "Qualificar o imóvel" (anotação L-104); com este PR mesclado, a tolerância pode sair.
Teste: `src/lib/proximidades/e742-sem-endereco.test.ts` (3) + ajuste da asserção do E593. Sem prova ao vivo.

## Conferência dos chamadores (09/11) — o fix cobre todo caminho do "Qualificar o imóvel"
Todos os `fetch("/api/proximidades")` do produto estão em `imoveis/novo/page.tsx`:
- `buscarPerto({ propertyId })` (linha ~1473, anúncio já salvo, sem CEP nem ponto): **era o 400**; agora 200 `sem_endereco` com lista vazia.
- `buscarPerto({ cep: c, … })` (linha ~1464): `c` já passa por `cepValido` antes do envio, então o servidor não recebe CEP malformado por aqui.
- `medirLugar` (`acao: "lugar"`): só envia `propertyId` quando há `editingId` e a pessoa digitou o endereço do lugar; o 400 "Informe o endereço do lugar." continua para endereço vazio, de propósito.
Os três 400 que restam na rota (CEP inválido no corpo, lugar sem endereço, anúncio de outra pessoa) são entrada inválida ou tentativa indevida, não o fluxo normal do dono. Testes: `src/lib/proximidades/*.test.ts`, 22 verdes.
