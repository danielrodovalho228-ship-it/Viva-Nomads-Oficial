# E826 — o mínimo de estadia varia por anúncio sem aviso antes do anúncio

**Achado** (RELATORIO-013). O ube-003 exige "De 60 a 180 dias", sob a promessa geral de 30 a 180 dias. A home não
avisava que o mínimo varia, e o morador só descobria dentro do anúncio.

**O que já existia.** O filtro de estadia da busca já respeita o mínimo de cada anúncio (`cabeNaEstadia`: buscando 30
dias, o ube-003 sai).

**Correção.**
1. **Cartão da busca:** a linha-síntese ganha "mínimo de N dias" quando o anúncio pede mais que os 30 da promessa
   geral. O mínimo vem de `textoMinimoDoAnuncio` e da constante `MIN_DIAS_PROMESSA = 1 mês × 30 dias`, ambos de
   `REGRAS_CONTRATO`. O ube-003 mostra "mínimo de 60 dias"; quem segue os 30 dias não mostra nada.
2. **Promessa geral com ressalva:** a frase única `PROMESSA_ESTADIA` (`src/config/textos-regulados.ts`) diz "Estadias
   de 30 a 180 dias (alguns imóveis pedem mínimo maior)". Ela aparece no topo da home e no rodapé de todas as páginas
   públicas.

**Teste.** `src/lib/e826-minimo-estadia.test.ts` (3): falha na main (os exports não existem) e passa na branch.
- Mínimo no cartão só para quem pede mais que 30 dias.
- O filtro respeita o mínimo.
- Home e rodapé usam a frase com a ressalva.
