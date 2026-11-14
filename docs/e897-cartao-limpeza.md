# E897 — o cartão "Limpeza e manutenção" de /parceiros cobre as três categorias

**Prova (Lótus, RELATORIO-L-004, PROVADO):**
- O cartão fala de "Limpeza, lavanderia, reparos e manutenção".
- Os dois caminhos levavam só a Limpeza: "Quero atender" ia para `/parceiros?categoria=limpeza#quero-ser-parceiro` e "Procurar" para `/parceiros/buscar?categoria=limpeza`.
- As buscas de Manutenção e Lavanderia existem, mas não tinham link a partir do cartão.

**Correção:** `linksDoCartaoServicos()` em `src/lib/parceiros/cartao-servicos.ts`, no padrão do cartão vizinho "Montagem e mudança" (E301): um caminho por categoria, para atender e para procurar.
- "Atender limpeza", "Atender lavanderia" e "Atender manutenção" levam ao formulário com a categoria marcada.
- "Procurar limpeza", "Procurar lavanderia" e "Procurar manutenção" levam à busca da categoria.

**Teste:** `src/lib/parceiros/e897-cartao-limpeza.test.ts`, vermelho na main e verde na branch.
