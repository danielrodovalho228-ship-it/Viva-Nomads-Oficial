# E877 — cartões de serviço de /parceiros prometiam "Página própria"

**Achado (RELATORIO-022, A-118):** "Limpeza e manutenção" e "Montagem e mudança" diziam "Página própria com serviços e cidades", mas "Procurar" leva a `/parceiros/buscar?categoria=…`. Entre os serviços, só Fotografia tem página própria (`/parceiros/fotografos`).

## Decisão (precedente do E187: promessa e destino dizem a mesma coisa)
A promessa muda para o que a busca entrega de fato: **"Busca de profissionais por serviço e cidade (ou CEP), com o perfil de cada um."** A busca filtra por categoria e cidade, UF ou CEP (`buscarParceiros`), e cada resultado abre o perfil do parceiro (`/parceiros/<slug>`). Os destinos não mudam.

## Testes
- `node --test src/lib/parceiros/e877-promessa-destino.test.ts`: main pass 1 / fail 2; branch pass 3 / fail 0.
- Escopados (`src/lib/parceiros` + os testes que leem /parceiros): 0 falhas. tsc limpo; consistência OK.

## Dúvidas
- Não acho que alguma página deva nascer agora: a busca já entrega serviço + cidade + perfil, e as rotas naturais (`/parceiros/limpeza` etc.) caem nela pelo E187. Uma página própria por categoria (como `/parceiros/fotografos`) só faria sentido com conteúdo próprio da categoria (portfólio, critérios); fica para decisão.
