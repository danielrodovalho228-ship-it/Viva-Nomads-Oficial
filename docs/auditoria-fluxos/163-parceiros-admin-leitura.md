# Achado 163 — admin de parcerias: falha de leitura do pedido virava "Pedido não encontrado"

**Fluxo:** admin conferindo, aprovando, recusando e reenviando a ativação de pedidos de parceria; decidindo o selo da nota (`src/lib/parceiros/admin-actions.ts`).
**Defeito:** as quatro leituras de `parceiro_solicitacoes` e a de `parceiros` não olhavam o `error`; com o banco falhando o atendimento lia "Pedido não encontrado." (ou "Só pedidos aprovados recebem um novo link.") e podia achar que o pedido tinha sumido.
**Correção:** cada leitura destrincha o erro e diz "Não foi possível ler o pedido/parceiro agora. Tente de novo." antes da frase de "não encontrado".
**Teste:** `src/lib/parceiros/achado163-admin-pedidos-leitura.test.ts`.
