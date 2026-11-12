# E791: prazo de resposta em /parceiros

**Achado:** /parceiros não dizia em quanto tempo a Viva responde ao pedido de parceria. Já /empresas promete 7 dias (E770), e as duas páginas pareciam divergir.

## O que o código já dizia
O prazo válido do pedido de **parceria** é **1 dia útil**, nos três lugares abaixo:
- o formulário depois de enviar ("Aguardando aprovação da Viva. Resposta em até 1 dia útil, por e-mail.");
- o onboarding ("Em análise. Resposta em até 1 dia útil.");
- o alerta à equipe (`parceiroSemResposta`: 24 h úteis sem decisão gera o e-mail "Solicitação de parceria sem resposta há 1 dia útil").

Os 7 dias de /empresas valem para outro pedido: a empresa que pede imóveis para a sua equipe. Não são o prazo da parceria.

## Correção
- **Fonte única:** `PRAZO_RESPOSTA_PARCERIA = "1 dia útil"` e `TEXTO_PRAZO_PARCERIA` em `src/lib/parceiros/regras.ts`.
- **/parceiros:**
  - o passo "A Viva confere" diz "A Viva responde por e-mail em até 1 dia útil.";
  - o bloco "Seja parceiro" repete a frase em destaque (`parceiros-prazo-resposta`).
- **Formulário e onboarding:** passam a ler a mesma constante, sem o texto escrito à mão.

## Testes
- `src/lib/parceiros/e791-prazo-resposta.test.ts` (3). Na main, falha porque a constante não existe.
- `tests/e2e/specs/t1602-e791-parceiros-prazo.spec.ts`: visitante, 390 e 1280.
