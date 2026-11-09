# E654 — código de assinatura: nunca "gira e volta" sem resposta

Relato (prova do E652, 06/11): na página do contrato 67329884… "Enviar código por e-mail" gira e volta sem confirmação.

**Evidência (leitura somente-leitura):** não existe linha em `contrato_assinatura_codigos` para o contrato (nenhuma tentativa chegou ao
`upsert`), e os outros e-mails da caixa de teste chegam (contract_status às 00:26 UTC de 07/11). O contrato está `ativo`, sem
assinaturas, com as instruções de check-in preenchidas às 00:32. Sem exceção agrupada nos logs de runtime das últimas 24 h.

**Correção (defesa e diagnóstico):** a tela só tratava o retorno `{ok:false}`; uma exceção da ação — ou a chamada ao servidor
falhar (rede, versão nova no ar) — saía sem mensagem. Agora a ação `pedirCodigoAssinatura` nunca lança (captura, registra a causa
com `console.error("[assinatura] pedir código falhou:")` e devolve erro visível) e a tela mostra o erro OU a confirmação
("Enviamos 6 números…", `assinar-codigo-enviado`).

**Dúvida:** a causa-raiz exata não é provável sem o log da tentativa. Na próxima tentativa, o log `[assinatura] pedir código
falhou:` traz a causa. Teste: `src/lib/data/e654-codigo-assinatura-visivel.test.ts`.

## Evidência depois do fix (09/11/2026, só leitura)
- `emails_teste`: 13 e-mails `contract_signature_code`, o último às **08:54 UTC de 07/11**, ou seja, **depois** do merge do fix (#3060, 01:47 UTC de 07/11). O envio de `contract_status` também segue (8, último 08:46 UTC).
- Logs de runtime da Vercel (projeto viva-nomads-oficial), 07/11 09:24 → 09/11 09:24 UTC, busca por `[assinatura] pedir código falhou`: **nenhuma ocorrência**.
- Leitura: a falha do relato (06/11) não se repetiu depois do deploy do fix, e a ação nunca lançou desde então. A hipótese mais provável segue sendo a versão nova no ar durante a prova, mas não está confirmada. Se o QA repetir "Enviar código por e-mail" e falhar, o log acima traz a causa exata.
- Sem mudança de código nesta rodada; a lacuna restante é a **repetição da prova pelo QA** (não é da pista de código).
