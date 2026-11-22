# E825 — título "ao lado do Hospital de Clínicas" × "HC-UFU a 1,7 km"

**Achado** (RELATORIO-013). O título do ube-004, "Studio ao lado do Hospital de Clínicas (UFU)", contradizia a própria
página, que informa o HC-UFU a 1,7 km. No mesmo anúncio, o campus Umuarama da UFU fica a 480 m.

**Régua** (`src/lib/anuncio/titulo-proximidade.ts`, pura). Toda afirmação de proximidade do título tem de bater com os
lugares que o próprio anúncio informa ("O que tem por perto" e espaços de trabalho):
- **"ao lado de", "em frente a" e "colado a":** até 300 m;
- **"próximo a" e "perto de":** até 1.000 m;
- **distância explícita** ("a 1,7 km do …"): tem de bater com a do corpo, com folga de ±15% ou ±100 m;
- **lugar do título sem lugar correspondente no corpo:** a afirmação fica sem lastro e também conta como divergência.

O lugar citado no título é casado com o lugar do corpo que tem mais palavras em comum com ele.

**Correção.**
- **ube-004:** o título passa a "Studio perto do campus Umuarama (UFU), a 1,7 km do Hospital de Clínicas".
- **Varredura dos 15 exemplos:** o único outro título com afirmação é o ube-011, "próximo à UFU", e ele confere
  (Biblioteca UFU a 700 m).

**Teste.** `src/lib/anuncio/e825-titulo-proximidade.test.ts` (3): falha na main (o módulo não existe) e passa na branch.
- O título antigo é pego pela régua (1.680 m > 300 m).
- A varredura não acha nenhum título divergente.
- A régua nos casos: ao lado, perto, distância explícita, sem lastro.
