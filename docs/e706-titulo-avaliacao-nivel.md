# E706 — "·" solto no título do cartão de avaliação do /nivel

## Causa
Não é a chave desligada nem conta de teste: o título é uma **string fixa** (`ROTAS_NIVEL`, `src/lib/vistoria/telas-exibicao.ts`) que citava o selo **com o separador dentro das aspas**: `Avaliação: “· vistoriado” por 12 meses`. O "·" é do título do nível ("Nível Conforto · vistoriado"), não parte do nome do selo; citado sozinho na frente da palavra, lia como um selo quebrado.

## O que mudou
- Título: **`Avaliação: selo “vistoriado” por 12 meses`**.
- As mesmas citações com o separador órfão em texto de tela foram trocadas por "o selo “vistoriado”": `TEXTO_NOVA_AVALIACAO` (pedido de nova avaliação), a frase do laudo aprovado e a do laudo sem o selo, e a mensagem do primeiro strike.
- O título do nível com selo segue **`Nível X · vistoriado`** (o separador é do título).
- Guarda em teste: nenhum texto de tela (título, constante ou valor devolvido) cita `“· vistoriado”`.

## Conferência
- O cartão ("Avaliação" do `BlocoAvaliacaoDono`) só aparece com `VISTORIA_ATIVA` ligada; no demo local a chave está desligada, então não o vi renderizado aqui. O texto vem da constante única, igual com a chave ligada ou desligada. Fica para o `lab-critico` / QA com a chave ligada.
