# E791: prazo de resposta em /parceiros

**Achado:** /parceiros não dizia em quanto tempo a Viva responde ao pedido de parceria. Já /empresas promete 7 dias (E770, provado), e as duas páginas divergiam.

**Decisão (vigia, 12/11/2026):** /parceiros exibe o **mesmo prazo de 7 dias** de /empresas.

## Correção
- **Fonte única:** `PRAZO_RESPOSTA_PARCERIA = "7 dias"` e `TEXTO_PRAZO_PARCERIA` ("A Viva responde por e-mail em até 7 dias.") em `src/lib/parceiros/regras.ts`.
- **/parceiros:** mostra o prazo no passo "A Viva confere" e em destaque no bloco "Seja parceiro" (`parceiros-prazo-resposta`).
- **Formulário (pedido enviado) e onboarding:** leem a mesma constante. Antes diziam "1 dia útil" escrito à mão; agora dizem "7 dias".
- **Alerta interno à equipe:** `parceiroSemResposta`, 1 dia útil, continua como estava. É um aviso interno, bem antes do prazo público.

## Testes
- `src/lib/parceiros/e791-prazo-resposta.test.ts` (3):
  - na main, não roda, porque a constante não existe;
  - contra a 1ª versão deste PR ("1 dia útil"), o teste do prazo de 7 dias falha.
- `tests/e2e/specs/t1602-e791-parceiros-prazo.spec.ts`: visitante, 390 e 1280.
- Asserção alterada: `src/lib/onboarding/ativacao.test.ts` ("Resposta em até 1 dia útil" → "Resposta em até 7 dias"), pela decisão de 12/11.
