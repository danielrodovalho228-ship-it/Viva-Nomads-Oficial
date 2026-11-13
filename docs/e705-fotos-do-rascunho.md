# E705 — fotos de rascunho excluído (resíduo 2 fechado; resíduo 1 depende de decisão)

Origem: `docs/qa-rodadas/2026-11-08-0945.md` (verificação por leitura).

## Resíduo 2 (código) — corrigido
`deleteProperty` montava a lista do que apagar só a partir de `property_photos`. O autosave do rascunho guarda as fotos no `draft_data` e não grava tabelas-filhas, então a foto que existia SÓ no `draft_data` ficava órfã no bucket. Agora `deleteProperty` lê também o `draft_data` do rascunho do próprio dono (`urlsDeFotosDoRascunho`, em `src/lib/minimizacao/fotos-rascunho.ts`) e passa as duas listas a `apagarFotosDoAnuncio`, que registra cada arquivo em `eliminacoes_registro`. A guarda do E308 segue valendo: arquivo usado por `property_photos` ou pelo `draft_data` de outro anúncio fica no bucket. Teste: `src/lib/minimizacao/e705-fotos-do-rascunho.test.ts`.

## Resíduo 1 (31 arquivos órfãos de antes do expurgo) — NÃO executado
Não dá para apagar por migração: o Supabase barra `delete` direto em `storage.objects` (gatilho `storage.protect_delete`, o mesmo que o drill do E745 encontrou). A limpeza precisa da API de Storage, com registro em `eliminacoes_registro`. Pendente de decisão: 22 são de contas de teste e 9 de contas reais (confirmar que nenhum é avatar ou anexo antes de apagar). Proposta: um comando administrativo único (script com a API de Storage e a mesma guarda do E308), rodado por quem o Daniel indicar, depois de conferir os 9.
