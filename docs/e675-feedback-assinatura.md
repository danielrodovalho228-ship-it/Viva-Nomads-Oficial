# E675 — o feedback da assinatura é confiável

**Relato (07/11, retomada do E652):** o 1º clique em "Assinar contrato" mostrava erro embora a assinatura estivesse
registrada; a confirmação inline era inconsistente.

**Causas no código (sem prova ao vivo):**
1. Um 2º envio (toque duplo, reenvio depois de a resposta demorar) recebia "Você já assinou este contrato." como ERRO,
   embora a assinatura tivesse sido gravada pelo 1º.
2. A tela não tratava exceção da ação depois do registro (rede, versão nova no ar), não impedia o 2º envio enquanto o 1º
   corria e não relia o contrato para mostrar o estado real.

**Correção (sem migração):**
- Servidor: quem já assinou e envia de novo recebe SUCESSO (com o aviso e `ambos`), sem consumir código nem gravar de novo.
- Tela: um envio por vez; resposta de erro e exceção releem o contrato (`router.refresh()`) — se a assinatura entrou, o
  formulário some; a exceção mostra "Não conseguimos confirmar a resposta agora. Atualize a página…".

**Teste:** `src/lib/data/e675-feedback-assinatura.test.ts` (escrito antes, visto vermelho).

**Dúvida:** não reproduzi o primeiro clique; as duas causas são as que o código mostra. Se a QA ainda vir o erro, preciso
do texto exato da mensagem e do horário (o log da ação mostra qual ramo respondeu).

## Complemento (07/11, relato com texto exato)
O 1º clique do Paulo mostrou "Peça o código por e-mail e digite os 6 números para assinar." Esse texto sai de
`conferirCodigo` quando NÃO há linha de código. `assinarContrato` lia `contrato_assinatura_codigos` sem olhar o `error`:
uma leitura que falha virava "sem linha" e, portanto, "peça o código", mesmo com o código pedido. Agora a leitura com
erro responde "Não foi possível conferir o código agora. Tente de novo." antes de conferir (teste novo em
`e675-feedback-assinatura.test.ts`, visto vermelho).

Sobre a confirmação "Enviamos 6 números…" aparecer na página do Lucas e não na do Paulo: o aviso é estado local da
página de quem clicou em "Enviar código", e o código fica preso à pessoa e ao contrato (hash por usuário). Os dois
sintomas combinam com a troca de conta do E674 (#3166): a aba do Paulo agindo com a sessão do Lucas. Sem prova ao vivo.
