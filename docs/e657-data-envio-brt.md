# E657 — data de envio da candidatura no calendário de Brasília

Fonte da data exibida: `leads.created_at` (timestamptz) → `createdAt` (leads-actions) → `Enviada em` em
`/dashboard/candidaturas`. A página tinha um `dataBR` próprio que **cortava o texto UTC** (`iso.slice(0, 10)`): a data era a
do calendário UTC, não a de Brasília (uma candidatura enviada à noite em Brasília aparece em outro dia). Agora usa
`dataBRT` (America/Sao_Paulo), a mesma de Cidades e dos laudos.

Mesma família corrigida: `admin/moderacao/ofensas` (data do registro) e as duas linhas "Este contrato foi gerado em /
Gerado em" do `closing-flow`. Datas puras (`date`, sem horário) não foram tocadas.

**A diferença de DOIS dias (causa conferida no banco, somente-leitura):** a candidatura do caso (`a65945b6…`) foi criada em
04/11 (`created_at` = 04/11 23:37 UTC) e a lista mostra `created_at`. Uma candidatura REPETIDA em 06/11 **atualiza** o lead
(E581: período, motivo e pessoas) mas não o `created_at` — por isso "Enviada em" fica no primeiro envio (04/11). A tabela
`leads` não tem coluna de reenvio. **Decisão necessária (não feita aqui):** para mostrar 06/11 é preciso gravar a data do
reenvio (coluna nova `reenviada_em` + migração, ou usar `created_at`, o que bagunça ordenação e funil). Propostas: coluna
`reenviada_em` preenchida no E581 e exibida como "Enviada em" (reenvio, se houver). Fica a cargo da coordenação.

Teste: `src/lib/e657-data-envio-brt.test.ts` (visto vermelho antes). Escopo: 54/54 + o novo; `tsc` limpo.
