# E788 — avatar "Equipe" inerte e inicial inconsistente (cabeçalho do admin)
1. O selo "Equipe" (papel-ativo, área da equipe) mostrava um círculo de avatar que não abre nada. E474 (iii)/E479 decidiu que o selo não é link (a Conta tem um caminho só: "Minha conta →" na barra lateral). Mantive essa decisão e escolhi a saída "removido se não tem função": o selo agora é só texto.
2. Inicial "c" × "C": a função `iniciais()` já devolve maiúscula nos dois lugares; a 28 px a letra caía em ~11 px e a maiúscula parecia minúscula. O Avatar passa a desenhar a inicial com no mínimo 13 px (`TAMANHO_MINIMO_INICIAL`) e com `uppercase`.
Teste: `src/components/layout/e788-selo-equipe-sem-avatar.test.ts` (+ E474 e avatar). Sem prova ao vivo (QA).
Se o Daniel preferir o avatar funcional (link para a Conta), é reverter o E474 (iii): decisão dele.
