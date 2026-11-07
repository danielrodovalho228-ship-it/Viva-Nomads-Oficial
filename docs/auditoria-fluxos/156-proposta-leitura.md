# Achado 156 — Proposta: leitura que falha virava 404

Fluxo: morador/dono › `/dashboard/propostas/[id]`. `lerProposta` ignorava o `error` da leitura em `propostas` e devolvia null; a
página chamava `notFound()` ("não encontrada"). Agora a falha lança e o `error.tsx` mostra "Tentar de novo".
Teste: `src/lib/data/achado156-proposta-leitura.test.ts` (visto vermelho antes). Escopo propostas: 39/39; `tsc` limpo.
