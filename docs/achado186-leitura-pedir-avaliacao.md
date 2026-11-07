# Achado 186 — vistoria: pedirAvaliacao, leitura que falha não vira outra resposta

Em `src/lib/vistoria/actions.ts`, `pedirAvaliacao` (o dono pede a avaliação do imóvel) lia três coisas sem olhar o `error`:
- o imóvel: a falha virava "sem acesso" (o dono achava que o imóvel não era dele);
- a tabela de preços (`vistoria_precos`): a falha virava "ainda não há preço para a cidade";
- os bloqueios (`vistoria_bloqueios`): a falha virava "anúncio não publicado" (e escondia o caminho de nova avaliação do
  anúncio retirado da busca).

Agora cada leitura com erro responde "Não foi possível conferir o imóvel agora. Tente de novo em instantes." (a mensagem que a
própria função já usa para as outras leituras) e não abre o pedido.

Teste: `src/lib/vistoria/achado186-leitura-pedir-avaliacao.test.ts` (escrito antes, visto vermelho). Sem migração, sem chave,
sem prova ao vivo. A chave `VISTORIA_ATIVA` não é tocada.
