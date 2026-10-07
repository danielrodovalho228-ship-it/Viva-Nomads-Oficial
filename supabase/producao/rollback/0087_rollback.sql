-- Rollback da 0087: registrar_ronda volta ao corpo da 0078 e saem as colunas do repasse.
-- (As ordens de repasse/retorno já criadas continuam como ordens comuns.)
begin;
set local lock_timeout = '5s';
create or replace function public.registrar_ronda(
  p_slug text, p_inicio timestamptz, p_fim timestamptz, p_status text,
  p_resumo text, p_achados jsonb default '[]'::jsonb, p_ordens uuid[] default '{}', p_link text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.agentes_rondas (agente_slug, iniciada_em, concluida_em, status, resumo, achados, ordens_atendidas, link_sessao)
  values (p_slug, coalesce(p_inicio, now()), coalesce(p_fim, now()), p_status, left(coalesce(p_resumo,''), 4000), coalesce(p_achados,'[]'::jsonb), coalesce(p_ordens,'{}'), p_link)
  returning id into v_id;
  update public.agentes_ordens set status = 'concluida', atualizada_em = now()
   where id = any(coalesce(p_ordens,'{}')) and agente_slug = p_slug and status in ('pendente','lida');
  return v_id;
end $$;
revoke all on function public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text) from public, anon, authenticated;
grant execute on function public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text) to service_role;
drop index if exists public.agentes_ordens_repasse;
alter table public.agentes_ordens
  drop column if exists prioridade,
  drop column if exists retorno_de,
  drop column if exists origem_ronda,
  drop column if exists origem_slug;
delete from supabase_migrations.schema_migrations where version = '20261007000087';
commit;
