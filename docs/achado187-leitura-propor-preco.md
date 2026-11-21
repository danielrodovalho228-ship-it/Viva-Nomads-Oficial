# Achado 187 — vistoria: proporPrecoEPrazo, leitura que falha não vira outra resposta

Em `src/lib/vistoria/actions.ts`, `proporPrecoEPrazo` (o avaliador escolhido aceita propondo o próprio valor e prazo):
- lia o pedido (`vistoria_pedidos`) sem olhar o `error`: a falha virava "A proposta deste pedido já foi enviada.";
- gravava a aceitação em `vistoria_designacoes` sem olhar o `error`: a falha virava "O prazo de 24 horas para responder já
  passou." (e o avaliador achava que tinha perdido o pedido).

Agora cada uma responde "Não foi possível conferir o imóvel agora. Tente de novo em instantes." (a mensagem que o arquivo já
usa para as outras leituras) antes de qualquer outra resposta.

Teste: `src/lib/vistoria/achado187-leitura-propor-preco.test.ts` (escrito antes, visto vermelho). Sem migração, sem chave,
sem prova ao vivo. A chave `VISTORIA_ATIVA` não é tocada.
