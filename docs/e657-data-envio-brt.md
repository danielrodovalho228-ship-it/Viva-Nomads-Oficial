# E657 — data de envio da candidatura no calendário de Brasília

Fonte da data exibida: `leads.created_at` (timestamptz) → `createdAt` (leads-actions) → `Enviada em` em
`/dashboard/candidaturas`. A página tinha um `dataBR` próprio que **cortava o texto UTC** (`iso.slice(0, 10)`): a data era a
do calendário UTC, não a de Brasília (uma candidatura enviada à noite em Brasília aparece em outro dia). Agora usa
`dataBRT` (America/Sao_Paulo), a mesma de Cidades e dos laudos.

Mesma família corrigida: `admin/moderacao/ofensas` (data do registro) e as duas linhas "Este contrato foi gerado em /
Gerado em" do `closing-flow`. Datas puras (`date`, sem horário) não foram tocadas.

**Dúvida registrada:** o relato mostra 04/11 para um envio de 06/11 (dois dias). O corte em UTC explica no máximo um dia;
se o QA vir diferença de dois dias, a candidatura pode ter sido criada em 04/11 e reenviada/atualizada em 06/11 (a lista
mostra a criação, `created_at`) ou o dado de teste ter sido gravado com data retroativa. Sem acesso à linha, não alterei a
fonte (criação × atualização).

Teste: `src/lib/e657-data-envio-brt.test.ts` (visto vermelho antes). Escopo: 54/54 + o novo; `tsc` limpo.
