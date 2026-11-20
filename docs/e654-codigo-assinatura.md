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
