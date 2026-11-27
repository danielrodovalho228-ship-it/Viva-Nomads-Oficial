-- Viva Nomads — aplicar 0292 (E565: a faixa da taxa conta só os imóveis ativos de verdade). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0292_rollback.sql.
begin;
set local lock_timeout = '5s';

-- 1) Quantos imóveis do dono contam para a faixa: publicado + documento VIGENTE aprovado + calendário em dia.
--    Documento vigente = existe uma linha aprovada em qualification_checklists (a aprovada mais recente vale; um envio
--    novo pendente ou recusado não rebaixa — E-DOC-VIGENTE). Calendário em dia = disponibilidade_confirmada_em nos
--    últimos 30 dias (o mesmo corte do ranking).
create or replace function public.imoveis_ativos_de_verdade(p_owner uuid) returns integer
language sql stable security definer set search_path = '' as $fn$
  select count(*)::integer
    from public.properties p
   where p.owner_id = p_owner
     and p.status = 'active'
     and p.disponibilidade_confirmada_em >= now() - interval '30 days'
     and exists (select 1 from public.qualification_checklists q where q.property_id = p.id and q.document_status = 'approved')
$fn$;
revoke all on function public.imoveis_ativos_de_verdade(uuid) from public, anon, authenticated;
grant execute on function public.imoveis_ativos_de_verdade(uuid) to service_role;

-- 2) A faixa_dono (queda de 30 dias, 0172) passa a contar igual. O resto da regra não muda.
create or replace function public.atualizar_faixa_dono(p_owner uuid) returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_ativos integer;
  v_taxa numeric;
  v_atual public.faixa_dono%rowtype;
begin
  if p_owner is null then return; end if;
  v_ativos := public.imoveis_ativos_de_verdade(p_owner);
  v_taxa := coalesce(public.taxa_da_faixa(v_ativos), 0.12);
  select * into v_atual from public.faixa_dono where owner_id = p_owner;
  if not found then
    insert into public.faixa_dono (owner_id, taxa_atual) values (p_owner, v_taxa) on conflict (owner_id) do nothing;
  elsif v_taxa > v_atual.taxa_atual then
    -- Caiu de faixa (taxa maior): a anterior, menor, vale por mais 30 dias a partir de agora.
    update public.faixa_dono set taxa_anterior = v_atual.taxa_atual, queda_em = now(), taxa_atual = v_taxa, atualizado_em = now()
     where owner_id = p_owner;
  elsif v_taxa < v_atual.taxa_atual then
    -- Subiu de faixa: vale na hora; a janela de queda acaba.
    update public.faixa_dono set taxa_anterior = null, queda_em = null, taxa_atual = v_taxa, atualizado_em = now()
     where owner_id = p_owner;
  end if;
end
$fn$;
revoke all on function public.atualizar_faixa_dono(uuid) from public, anon, authenticated;
grant execute on function public.atualizar_faixa_dono(uuid) to service_role;

-- 3) O gatilho de properties acompanha também a confirmação do calendário.
drop trigger if exists properties_faixa_dono on public.properties;
create trigger properties_faixa_dono after insert or delete or update of status, owner_id, disponibilidade_confirmada_em on public.properties
  for each row execute function public.properties_faixa_dono();

-- 4) Documento aprovado, recusado ou trocado também muda a faixa do dono do imóvel.
create or replace function public.qualification_checklists_faixa_dono() returns trigger
language plpgsql security definer set search_path = public as $fn$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.properties where id = coalesce(new.property_id, old.property_id);
  perform public.atualizar_faixa_dono(v_owner);
  return coalesce(new, old);
end
$fn$;
revoke all on function public.qualification_checklists_faixa_dono() from public, anon, authenticated;
drop trigger if exists qualification_checklists_faixa_dono on public.qualification_checklists;
create trigger qualification_checklists_faixa_dono after insert or delete or update of document_status, property_id on public.qualification_checklists
  for each row execute function public.qualification_checklists_faixa_dono();

-- 5) O calendário que vence não muda linha nenhuma: a rotina diária (cron de automações) recalcula todos os donos.
create or replace function public.atualizar_faixas_dos_donos() returns integer
language plpgsql security definer set search_path = public as $fn$
declare
  v_owner uuid;
  v_n integer := 0;
begin
  for v_owner in select distinct owner_id from public.properties where owner_id is not null loop
    perform public.atualizar_faixa_dono(v_owner);
    v_n := v_n + 1;
  end loop;
  return v_n;
end
$fn$;
revoke all on function public.atualizar_faixas_dos_donos() from public, anon, authenticated;
grant execute on function public.atualizar_faixas_dos_donos() to service_role;

-- 6) Situação de hoje com a regra nova (quem cair de faixa ganha a janela de 30 dias com a taxa anterior).
select public.atualizar_faixas_dos_donos();

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261104000292', '0292_faixa_ativos_de_verdade', array['-- conteúdo em supabase/migrations/0292_faixa_ativos_de_verdade.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261104000292');
commit;
