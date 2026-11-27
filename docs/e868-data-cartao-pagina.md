# E868 — data de disponibilidade: cartão 1 dia depois da página (15/15)

**Achado.** RELATORIO-020 (A-89): o cartão da busca mostrava a data 1 dia depois da página do mesmo anúncio em todos os
15 exemplos (ube-001: 24/11 no cartão × 23/11 na página; ube-002: 28/11 × 27/11; ube-003: 02/12 × 01/12). O estado
vazio da busca usava a data do cartão.

**Causa.** Cartão, página e estado vazio já liam o mesmo campo, `availableFrom`, mas o valor era calculado uma vez só,
quando o módulo `src/lib/properties.ts` carregava (`emDias(n)`, num `const`), e pelo dia UTC. A busca (`/buscar`) e a
página (`/imoveis/[id]`) rodam em instâncias da Vercel que carregam o módulo em momentos diferentes. Perto da virada do
dia UTC (21h em Brasília; o relatório saiu às 02h07 UTC de 13/11), uma instância ficava com o dia 13 e a outra com o
dia 12. O +1 em todos os anúncios é a assinatura disso.

**Correção (fonte única).**
- Cada exemplo guarda só o deslocamento em dias. `availableFrom` virou um getter, lido a cada acesso e contado a partir
  de hoje em Brasília. Se alguém fixar a data, vale a fixada.
- `disponivelAPartirDe` (o rótulo do cartão) compara com o dia de Brasília, e não mais com o dia UTC.
- Cartão (`rotuloPreco` com `property.availableFrom`), página (`PriceCard`, com `disponivelDesde ?? property.availableFrom`)
  e estado vazio (`proximaDisponibilidade`) leem o mesmo valor.

**Teste.** `src/lib/e868-data-exemplos.test.ts`, com relógio simulado:
1. O módulo carrega 2 dias antes e o valor acompanha o relógio. Às 21h30 de 12/11 em Brasília, ube-001 = 23/11; um dia
   depois, 24/11.
2. Cartão × página (objeto serializado, como chega ao navegador) dão a mesma data nos 15 exemplos; o estado vazio usa a
   mesma data. ube-001/002/003 = 23/11, 27/11 e 01/12, as datas que a página mostrava.
3. O rótulo usa o dia de Brasília.

Na main falha (3 de 3); na branch passa.

**Limite do lab.** O defeito precisa de duas instâncias carregadas em dias diferentes, então um E2E num servidor só não
o reproduz. A prova é o teste de unidade com o relógio simulado.
