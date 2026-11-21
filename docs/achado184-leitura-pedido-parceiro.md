# Achado 184 — pedidos a parceiros: leitura que falha não vira "não encontrado"

Em `src/lib/parceiros/pedido-actions.ts`:
- `carregar` (usada por todas as ações sobre um pedido) lia `parceiro_pedidos` sem olhar o `error`: a falha virava
  "Pedido não encontrado." para quem é parte do pedido.
- `solicitarOrcamento` lia `parceiros` sem olhar o `error`: a falha virava "Este parceiro não está recebendo pedidos agora."
- `solicitarOrcamento` lia `parceiro_servicos` sem olhar o `error`: a falha virava "Escolha um serviço da lista do parceiro."

Agora cada leitura com erro responde "Não foi possível ler … agora. Tente de novo." antes de qualquer "não encontrado".

Teste: `src/lib/parceiros/achado184-leitura-pedido-parceiro.test.ts` (escrito antes, visto vermelho). Sem migração, sem chave,
sem prova ao vivo.
