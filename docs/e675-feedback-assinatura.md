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
