-- Rollback da 0292: a faixa volta a contar todo imóvel com status "active" (regra da 0172). Tira o gatilho dos
-- documentos, a rotina diária e a contagem nova; o gatilho de properties volta às colunas status/owner_id. Volte o
-- código junto (o cron chama atualizar_faixas_dos_donos; sem a função, a chamada só falha calada).
begin;
set local lock_timeout = '5s';
drop trigger if exists qualification_checklists_faixa_dono on public.qualification_checklists;
drop function if exists public.qualification_checklists_faixa_dono();
drop trigger if exists properties_faixa_dono on public.properties;
create trigger properties_faixa_dono after insert or delete or update of status, owner_id on public.properties
  for each row execute function public.properties_faixa_dono();
create or replace function public.atualizar_faixa_dono(p_owner uuid) returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_ativos integer;
  v_taxa numeric;
  v_atual public.faixa_dono%rowtype;
begin
  if p_owner is null then return; end if;
  select count(*) into v_ativos from public.properties where owner_id = p_owner and status = 'active';
  v_taxa := coalesce(public.taxa_da_faixa(v_ativos), 0.12);
  select * into v_atual from public.faixa_dono where owner_id = p_owner;
  if not found then
    insert into public.faixa_dono (owner_id, taxa_atual) values (p_owner, v_taxa) on conflict (owner_id) do nothing;
  elsif v_taxa > v_atual.taxa_atual then
    update public.faixa_dono set taxa_anterior = v_atual.taxa_atual, queda_em = now(), taxa_atual = v_taxa, atualizado_em = now()
     where owner_id = p_owner;
  elsif v_taxa < v_atual.taxa_atual then
    update public.faixa_dono set taxa_anterior = null, queda_em = null, taxa_atual = v_taxa, atualizado_em = now()
     where owner_id = p_owner;
  end if;
end
$fn$;
drop function if exists public.atualizar_faixas_dos_donos();
drop function if exists public.imoveis_ativos_de_verdade(uuid);
delete from supabase_migrations.schema_migrations where version = '20261104000292';
commit;
