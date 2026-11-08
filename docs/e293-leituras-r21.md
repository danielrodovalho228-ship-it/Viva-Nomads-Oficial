# Erros/estados vazios (r21) — falha de leitura não vira "não" falso

Mesma regra das rodadas r17–r20 (detalhe da retenção E293 em `docs/e293-auditoria-retencao.md`): uma leitura que FALHOU não pode ser contada como "não há nada" / "sem permissão". Os três piores desta rodada (ações logadas, sem migração):

1. **Respostas aos pedidos de moradia** (`getRespostasRecebidas`): a falha virava "nenhuma resposta ainda". A tela de Pedidos usa `exigir: true` (como a lista de pedidos ao lado) e mostra o erro em vez da lista vazia.
2. **Detecção de fotos do anúncio** (`montar`/`galeria` em `deteccao-actions`): a falha de leitura da galeria, das sugestões, dos itens de nível ou das fotos "com pessoa" virava "sem sugestões" e escondia o aviso de foto com pessoa. Agora lança; a tela já trata o erro (o bloco some e o passo segue, sem mostrar um estado errado).
3. **Provas do nível e medição de internet** (`donoDoItem`/`donoDoImovel` em `prova-actions`): a falha ao conferir o dono virava "Sem permissão." para o próprio dono. Agora devolve "Não foi possível conferir o anúncio agora. Tente de novo em instantes." (as leituras de acompanhamento seguem devolvendo vazio, como antes).

Teste: `src/lib/data/e293-leituras-r21.test.ts`.
