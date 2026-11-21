# E886 — mesmo prazo de resposta em /parceiros e /parceiros/avaliadores

**Defeito:** `/parceiros` promete "A Viva responde por e-mail em até 7 dias." (`TEXTO_PRAZO_PARCERIA`), e a página de recrutamento de avaliadores não prometia prazo nenhum — embora o credenciamento use o mesmo formulário de pedido (que, depois de enviado, também diz "Resposta em até 7 dias").

**Correção:** a caixa "Um só pedido" de `/parceiros/avaliadores` mostra `{TEXTO_PRAZO_PARCERIA}` (`data-testid="avaliadores-prazo-resposta"`), a mesma constante de `src/lib/parceiros/regras.ts` usada em `/parceiros`. Mudar o prazo é mudar `DIAS_RESPOSTA_PARCERIA` num lugar só.

**Teste:** `src/lib/parceiros/e886-avaliadores-prazo.test.ts`; vermelho na main, verde na branch.
