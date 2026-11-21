# Achado 179 — responderPedido: leitura que falha não vira "o pedido sumiu"

`responderPedido` (dono responde a um pedido de moradia) lia `pedidos_publicos` e `properties` sem olhar o `error`.
Uma leitura falha virava "Pedido não está mais disponível." ou "Selecione um imóvel seu.", e o dono achava que tinha
perdido o pedido. Agora cada leitura com erro responde "Não foi possível ler o pedido/imóvel agora. Tente de novo."
antes de qualquer "não encontrado".

Teste: `src/lib/data/achado179-leitura-responder-pedido.test.ts` (escrito antes, visto vermelho). Sem migração, sem chave,
sem prova ao vivo.
