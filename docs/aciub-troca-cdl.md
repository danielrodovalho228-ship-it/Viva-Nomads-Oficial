# Troca CDL → ACIUB (ordem do Daniel, 08/11/2026)
A entidade parceira de Uberlândia no material da Viva é a ACIUB (Associação Comercial e Industrial de Uberlândia), não a CDL.
Busca em todo o repo (sem diferenciar maiúsculas, fora `node_modules`/binários): só estas ocorrências, todas trocadas `CDL` → `ACIUB`.

| Arquivo | Contexto |
|---|---|
| `src/config/premissas-financeiras.ts:169` | rótulo do opcional não somado: "Associação à ACIUB Uberlândia" |
| `src/config/premissas-financeiras.ts:172` | observação do mesmo item: "Associação à ACIUB Uberlândia, ~R$ 100/mês, sugestão da Dra. Beatriz, decisão pendente" |
| `src/lib/financeiro/custos-v3.test.ts:73,75,81` | título do teste, filtro `/ACIUB/` e texto esperado da observação |
| `src/lib/financeiro/projecao.test.ts:110` | título do teste: "(sem a ACIUB)" |
| `tests/e2e/specs/t1191-e592-simulacao-premissas.spec.ts:61,62` | comentário e texto esperado na tela |

O texto não usa o nome por extenso, então não há "Associação Comercial e Industrial de Uberlândia" a inserir.
**Fora desta troca, intocados até decisão do Daniel:** a atribuição "sugestão da Dra. Beatriz" e o valor "~R$ 100/mês" (era da CDL e não foi verificado para a ACIUB).
Teste: `node --test src/lib/financeiro/*.test.ts` (65 verdes).
