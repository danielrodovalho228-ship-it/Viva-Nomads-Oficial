# E786 — faixa do anúncio de teste fora da especificação (julgamento de 11/11: PARCIAL)

## Causas
1. **Texto da equipe.** O dono, o admin e as contas de teste (quem faz a prova ao vivo) viam `FAIXA_TESTE_EQUIPE` = "Anúncio de teste: fora da busca e das listagens", numa pílula cinza. O texto especificado ("Anúncio de teste da equipe Viva — não é um imóvel disponível") só aparecia para o visitante.
2. **VN-4A693A sem faixa.** O título é "TESTE QA - Casa mobiliada 2 quartos no Centro", **sem colchetes**, e a marca exige `[TESTE…]`. O dono é conta de teste (`is_teste`, conferido em produção). A regra do E131, já usada na vitrine e no ranking, trata isso como anúncio de teste, mas a página do imóvel não aplicava essa regra.

## Correção
- **Uma faixa só:** `FAIXA_TESTE` com o texto especificado e o mesmo desenho (destaque âmbar, `break-words`) para equipe e visitante. A diferença entre os dois continua só no "Solicitar" (E93).
- **Detecção:** `modoAnuncioTeste(titulo, quem, donoTeste)` considera também "dono é conta de teste". O valor é lido no servidor (`donoEhContaTeste`, cliente de serviço) e passado ao `PropertyDetail`.

## Provas
- **Teste de unidade** `src/lib/data/e786-faixa-teste-especificada.test.ts`: falha antes (export inexistente) e passa depois. Junto com `src/lib/data`, `src/components/property` e os testes do imóvel: 398 aprovados e 0 falhas.
- **E2E no lab:**
  - t1605 (novo): conta de teste sem a marca; visitante a 390 e 1280 px; equipe com o mesmo texto e desenho; sem estouro horizontal;
  - t398 inteiro (E93): visitante, conta real e conta de teste;
  - resultado: 7/7.
- **t693:** falha no passo "publicou", que **já está vermelho na main** (o mesmo `publicou × esperando` nas três últimas rodadas do CI, 12/11 01:11–03:13). Não é deste PR, porque o fluxo de publicação não foi tocado.

## Asserções alteradas (decisão: E786, julgamento de 11/11)
- `src/lib/data/anuncio-teste.test.ts`: `FAIXA_TESTE_EQUIPE` ("fora da busca e das listagens") virou `FAIXA_TESTE` (texto especificado).
- `tests/e2e/specs/t398-local-pessoal-teste.spec.ts` nº 3 e nº 4: a equipe vê o texto especificado.
- `src/components/property/e786-selo-teste-sem-transbordo.test.ts`: a contagem aceita `FAIXA_TESTE` e `FAIXA_TESTE_VISITANTE`, que têm o mesmo texto, e continua exigindo 3 usos.

## Dúvidas
- Os metadados (`noindex`) e a vitrine já seguem o título; a vitrine também segue a conta de teste (E131). O `noindex` da página continua só pelo título. O anúncio de conta de teste sem marca já fica fora das listagens (E131), mas pelo link pode ser indexado. Ampliar o `noindex` com a mesma regra é uma linha; deixei de fora para não alargar o escopo.
