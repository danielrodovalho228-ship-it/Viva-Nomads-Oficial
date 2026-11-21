# Erros/estados vazios — rodada 12 (pedidos de moradia)
Mesmo padrão das rodadas 9–11: leitura que falha não vira "vazio" nem "não encontrado".
- `getRespostasRecebidas`: erro de leitura lança uma mensagem clara (antes: lista vazia = "nenhuma resposta ainda").
- `responderPedido`: erro ao ler o pedido ou o imóvel devolve "Não foi possível ler… Tente de novo" (antes: "Pedido não está mais disponível" / "Selecione um imóvel seu").
Teste: `src/lib/data/e293-leituras-pedidos.test.ts`. Sem migração, sem prova ao vivo. `AUTOMACOES_ATIVO` intocado.
