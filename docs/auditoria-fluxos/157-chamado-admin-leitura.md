# Achado 157 — Admin › chamado: leitura que falha virava 404

Fluxo: admin › Atendimento › `/admin/atendimento/[id]`. `chamadoAdmin` ignorava o `error` da leitura em `chamados` e devolvia null; a
página chamava `notFound()`. Agora a falha lança e o `error.tsx` do admin mostra "Tentar de novo".
Teste: `src/lib/data/achado157-chamado-admin-leitura.test.ts` (visto vermelho antes). Escopo `src/lib/data`: 314/314; `tsc` limpo.
