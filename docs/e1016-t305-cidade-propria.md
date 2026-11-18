# E1016 — t305 caso 3: o bloco "nova avaliação" sumia porque outro spec apagava a tabela de preços

**Sintoma (corrida noturna de 17/11, run 44116733290):** `getByTestId('avaliacao-nova')` não encontrado na 1ª tentativa; passa na nova tentativa. Sozinho no lab, o t305 passa 6/6.

**Causa (provada no lab, 18/11):** t303, t305 e t344 apagam a tabela de preços de **"Uberlândia" inteira** (`vistoria_precos.delete().eq("cidade", "Uberlândia")`) no `beforeAll` e no `afterAll`. Na suíte, com workers em paralelo, o `afterAll`/`beforeAll` de um vizinho apaga os preços do t305 no meio do caso 3. Sem preço vigente, o bloco do dono (`src/components/vistoria/bloco-avaliacao-dono.tsx`) não mostra o texto da nova avaliação nem o botão "Pedir nova avaliação". O produto está certo: sem tabela de preço na cidade, não há como pedir avaliação.

**Prova vermelha na main (c6bb687 + #3977):** um "vizinho" que faz o mesmo `delete` a cada 300 ms enquanto o caso 3 roda:

```
node vizinho-precos.mjs 120 15 &   # espera 15 s (beforeAll), apaga por 120 s
npx playwright test t305-laudo-avaliacao-62b2.spec.ts -g "3. reprovado" --retries=0
→ 1 failed — t305:288 getByTestId('avaliacao-nova') element(s) not found  (o mesmo erro do CI)
```

**Correção (só no teste):** o t305 usa uma cidade só dele (`Uberlândia t305 <sufixo>`) nos imóveis, nos pedidos, no credenciamento e na tabela de preços, e só apaga essa. Nenhuma asserção mudou.

**Prova verde no PR, com o mesmo vizinho ligado o tempo todo:** `t305 completo --retries=0 → 6 passed (1.7m)`.

**Efeito colateral bom:** t303 e t344 deixam de ver os preços que o t305 gravava em Uberlândia (o t303 conta exatamente 1 linha `q1_2`). A colisão t303 × t344 entre si continua e não é deste item; fica anotada para o Gerente.

**Quarentena:** a entrada E1016 sai neste PR. A disposição "instável" no `disposicao-falhas.json` fica como registro da corrida de 16–17/11.
