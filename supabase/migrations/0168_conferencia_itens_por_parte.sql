-- Viva Nomads — 0168: itens da conferência congelam por parte (ordem 99c7c1e0, ajuste do PR #423).
-- Antes: a primeira resposta congelava os itens das DUAS partes. Agora: os itens de uma parte congelam
-- quando ELA responde, e tudo congela quando as duas respondem. Só troca o corpo da função; idempotente.
-- Produção: supabase/producao/aplicar-0168.sql (Action no merge). Rollback: supabase/producao/rollback/0168_rollback.sql.
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
