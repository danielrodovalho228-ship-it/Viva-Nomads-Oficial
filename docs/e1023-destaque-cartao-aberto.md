# E1023 — o card da lista mantém o destaque com o cartão do imóvel aberto no mapa

Decisão de produto do Gerente (DUET-1349): o card da lista MANTÉM o destaque enquanto o cartão do imóvel dele está aberto no
mapa; perder o destaque com o cartão aberto é o defeito.

## Causa
`abertoId = selectedId ?? previa.id` vivia só dentro do mapa (`src/components/search-map.tsx`). A lista
(`src/app/(public)/buscar/search-client.tsx`) destacava por `activeId` (hover do pin) ou `selecionadoId` (clique). O cartão
aberto pela prévia do hover (E442) não chegava à lista: quando o mouse saía do preço e entrava no cartão, o pin dava
`mouseleave` → `onHover(null)` e o card perdia o destaque com o cartão ainda aberto.

## Correção
- `SearchMap` ganha `onAberto(id | null)`; os dois motores (Mapbox e Leaflet) avisam o imóvel com o cartão aberto
  (`useAvisarAberto`, também `null` ao desmontar).
- A lista guarda `abertoMapaId` e destaca por `activeId || selecionadoId || abertoMapaId`.

## Trava — t70 caso 2
Passo novo no fim do caso: o mouse passa do pin para o cartão aberto; o card da lista tem de seguir com
`data-destaque="1"`. O passo e a correção entram juntos (nunca separar — DUET-1505).

| Onde | Resultado |
|---|---|
| main a170b8995, lab, `--repeat-each=3`, sem retry | 3 de 3 vermelhos na asserção "E1023: card da lista destacado com o cartão aberto" |
| ramo com a correção, lab, t70 completo `--repeat-each=5`, sem retry | 30 passed (6 casos × 5) |
| npm test (ramo sobre 38836c335) | 7790 pass, 0 fail; tsc OK |

## Quarentena
A entrada do t70 caso 2 (E1023, até 01/12) chega à main pelo #3964 (Fable). Este PR tira essa entrada no mesmo ato da
correção, assim que o #3964 estiver na main (refresh deste ramo sobre ela + commit que remove a entrada).
