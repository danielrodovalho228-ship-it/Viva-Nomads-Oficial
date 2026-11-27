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

## Alerta à equipe alinhado ao prazo público (vigia, 12/11)
- **Fonte única:** `DIAS_RESPOSTA_PARCERIA = 7` em `src/lib/parceiros/regras.ts`. Dele saem `PRAZO_RESPOSTA_PARCERIA` ("7 dias") e o texto público.
- **Regra do alerta (`parceiroSemResposta`, em `src/lib/lembretes/regras.ts`):** dispara quando o pedido passa de **7 dias corridos sem decisão**, o mesmo prazo prometido. Antes disparava em 24 h úteis (1 dia útil), um prazo que nenhuma tela dizia.
- **Usam o mesmo prazo:**
  - o aviso do cron à equipe: "Solicitação de parceria sem resposta há mais de 7 dias.";
  - o e-mail (`parceiro_sem_resposta`), com assunto "Solicitação de parceria sem resposta há 7 dias";
  - a linha da fila de decisões do admin ("N sem resposta há mais de 7 dias");
  - os comentários do cron e da fila.
- **Teste:** `e791-prazo-resposta.test.ts`, teste 2. Contra a versão anterior do PR (alerta em 1 dia útil), ele reprova; agora passa.
- **Asserções alteradas:**
  - `lembretes/regras.test.ts`: limite de 1 dia útil → 7 dias corridos;
  - `admin/decisoes-admin.test.ts`: "há mais de 1 dia útil" → "há mais de 7 dias";
  - specs `t236` (texto do formulário) e `t546` (linha do admin; o pedido de teste passou a ter 7 dias + 1 h).
