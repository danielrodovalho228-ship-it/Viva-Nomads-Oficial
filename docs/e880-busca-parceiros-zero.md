# E880 — estado zero da busca de parceiros: login obrigatório e indicação sem destino

**Achado:** "Quero ser avisado" exige conta (vai a `/auth?redirect=…`), o que é atrito para o dono que só queria um parceiro. "Enviar o link para indicar" não navega: só copia ou compartilha um link cujo destino ficava NÃO CONFIRMADO.

## Diagnóstico no código
- O aviso (`AvisoFotografo`, também usado nas outras categorias) grava o pedido de aviso com o contato do perfil. Por isso pede conta: `linkEntrarParaAvisar` volta para a mesma busca com `?avisar=1`. Mudar isso exigiria guardar e-mail de anônimo (migração e consentimento): fora do escopo.
- A indicação (`IndicarProfissional`) compartilha ou copia `caminhoIndicacao(categoria)` = `/parceiros?categoria=<c>#quero-ser-parceiro`, o formulário "Seja parceiro" já na categoria.

## Correção
- `caminhosSemConta({ categoria, cidade })` (`src/lib/parceiros/indicacao.ts`): só para quem não está logado, o estado zero mostra "Sem conta, dá para: **Ver em todas as cidades** (a mesma categoria, sem o filtro de cidade) · **Falar com a Viva** (`/ajuda/fale-com-a-viva`). O aviso abaixo pede a conta porque guarda para quem avisar."
- A indicação mostra o destino: "O link abre o pedido de parceria da Viva, já nesta categoria: a pessoa faz o pedido com a conta dela." Ao lado, o link navegável **"Ver a página do pedido"**, com o mesmo `caminhoIndicacao`.

## Testes
- `node --test src/lib/parceiros/e880-zero-sem-login.test.ts`: main pass 0 / fail 1; branch pass 3 / fail 0.
- Escopados (`src/lib/parceiros`, fotógrafos, estilo): 241 / 0. tsc limpo; consistência OK.
- Lab (build da branch): o HTML de `/parceiros/buscar?categoria=limpeza&cidade=Uberlândia&uf=MG` traz o bloco sem conta e o link do destino.
  - t735 + t737 + t760 → 6 passed, 1 failed, 3 não rodaram (serial).
  - A falha (t735, repetida 1 vez) é o cartão de um parceiro semeado como **pessoa física** (`tipo_pessoa: "pf"`), que a busca não mostra desde o E648 (só CNPJ). Isso está fora deste PR.

## Dúvidas
- "Quero ser avisado" sem conta só com uma decisão de produto (guardar e-mail de anônimo, com consentimento e migração).
- O t735 precisa semear o parceiro como PJ (CNPJ) desde o E648. Não mexi, por ser spec de outro item.
