-- Viva Nomads — 0168: itens da conferência congelam por parte (ordem 99c7c1e0, ajuste do PR #423).
-- Antes: a primeira resposta congelava os itens das DUAS partes. Agora: os itens de uma parte congelam
-- quando ELA responde, e tudo congela quando as duas respondem. Só troca o corpo da função; idempotente.
-- Rollback: supabase/producao/rollback/0168_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';

create or replace function public.conferencia_itens_trava() returns trigger
language plpgsql set search_path = public as $$
declare
  cid uuid := coalesce(new.conferencia_id, old.conferencia_id);
  minha text := coalesce(new.parte, old.parte);
begin
  if pg_trigger_depth() = 1 and (
    exists (select 1 from public.conferencia_respostas r where r.conferencia_id = cid and r.parte = minha)
    or (select count(*) from public.conferencia_respostas r where r.conferencia_id = cid) >= 2
  ) then
    raise exception 'A conferência já foi respondida e não pode mais ser alterada.';
  end if;
  return coalesce(new, old);
end;
$$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261018000168', '0168_conferencia_itens_por_parte',
       array['-- conteúdo em supabase/migrations/0168_conferencia_itens_por_parte.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261018000168');
commit;
