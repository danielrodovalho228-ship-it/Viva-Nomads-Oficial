# E768 — fotos do detalhe do anúncio carregavam com atraso visível

**Relato (Phoenix, RELATORIO-006, achado 6):** ube-001 abriu com as 5 fotos do mosaico em branco (placeholders pendentes) e só carregou na segunda leitura; ube-003 abriu com 3 pendentes. A varredura visual trata imagem pendente como defeito.

**O que não é:** tamanho do arquivo (as fotos `public/images/imoveis/ube/*.webp` têm 100–200 KB, 2176×1632) nem falta de cache HTTP.

**Causas (lidas no código, sem medição ao vivo):**
1. As 4 fotos pequenas do mosaico (1 de 4 colunas ≈ 25% da largura) usavam o `sizes` da foto grande (`50vw`). O otimizador do Next gerava versões de ~1080–1280 px (AVIF em produção) para um quadro de ~300 px. Com o cache frio, cada uma custa segundos de codificação, e as 5 fotos disputavam a CPU ao mesmo tempo — daí "carrega na segunda leitura" (cache quente).
2. As 4 fotos pequenas eram `eager` + prioridade alta de rede, mas o mosaico é `hidden md:block`: no celular elas baixavam escondidas e disputavam a rede com a capa visível do carrossel.

**Correção (sem migração):** `src/components/property-gallery.tsx`
- `SIZES_MOSAICO_PEQUENA` (`25vw`) nas fotos pequenas do mosaico de 5+; `SIZES_MOSAICO_COLUNA` (`34vw`) no layout de 2–4 fotos. A capa e o carrossel seguem com `SIZES_MINIATURA`; a galeria aberta continua reaproveitando a miniatura grande (E262).
- Só a capa tem prioridade alta (nos 3 layouts do mosaico e a 1ª do carrossel). As demais pedem quando visíveis: no computador estão na primeira pintura e carregam já; no celular, escondidas, deixam de ser baixadas.

**Teste:** `src/components/e768-galeria-carga.test.ts` (3); ajuste de contagem em `src/lib/anuncio/e262-previa-galeria.test.ts`. Escopados da galeria, lightbox, E454, E697 e estilo: 50 verdes.

**Não medido:** sem prova ao vivo e sem tempo de carga medido; o ganho esperado é menos bytes e menos disputa no 1º carregamento. Se a QA ainda vir pendente com cache frio, o próximo passo é medir `/_next/image` a frio (rede lenta no lab) e, se preciso, pré-gerar as versões das fotos de exemplo (por exemplo, WebP em 640 px) em vez de depender do otimizador.
