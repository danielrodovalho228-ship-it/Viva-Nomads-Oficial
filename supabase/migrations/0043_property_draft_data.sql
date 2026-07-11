-- Autosave REAL do rascunho no servidor (P0 — perda de dados). O editor passa a
-- persistir o estado completo do formulário (todos os campos + a etapa atual)
-- neste jsonb, com debounce, em vez de só no localStorage do navegador. Assim o
-- rascunho sobrevive a troca de aba/dispositivo/limpeza de cache.
--
-- A RLS de `properties` já existente (dono insere/atualiza o próprio) governa a
-- gravação — nada de novo aqui.
alter table public.properties
  add column if not exists draft_data jsonb;
