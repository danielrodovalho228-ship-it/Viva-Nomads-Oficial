-- Viva Nomads — desfazer a 0362 (E1177: a alternância de avaliadores sem beco). Apaga as três colunas e volta a regra
-- da fila aos cinco tipos de antes. Rode só junto com a reversão do código que as lê. Se houver itens abertos do tipo
-- 'contestacao_sem_avaliador', resolva-os ou apague-os antes: a regra antiga não os aceita.
begin;
alter table public.vistoria_pedidos drop column if exists motivo_da_espera;
alter table public.vistoria_designacoes drop column if exists mesmo_da_anterior;
alter table public.vistoria_laudos drop column if exists mesmo_da_anterior;
alter table public.vistoria_fila_admin drop constraint if exists vistoria_fila_admin_tipo_check;
alter table public.vistoria_fila_admin add constraint vistoria_fila_admin_tipo_check
  check (tipo in ('sem_avaliador', 'avaliacao_teste', 'suspensao_automatica', 'proposta_descredenciamento', 'revisao_criterio'));
delete from supabase_migrations.schema_migrations where version = '20261124000362';
commit;
