-- Viva Nomads — 0172: a regra da taxa completa no servidor (especificação de testes da taxa, 19/10; parte B do prompt 27).
-- 1) R3 — queda de faixa: faixa_dono guarda a taxa atual do dono e, quando ele cai de faixa (menos imóveis ativos,
--    taxa maior), a taxa anterior e o momento da queda. A anterior vale por mais 30 dias (regra.ts). Um gatilho em
--    properties mantém a tabela em dia; a faixa vem de faixas_comissao (a mesma tabela do admin).
-- 2) Origem da taxa aplicada (faixa / faixa_com_queda_recente / admin / proposta_envio) e a faixa no momento.
-- 3) A taxa da proposta deixa de ser legível pela conta do morador (nem pela API direta): o SELECT de propostas para
--    authenticated passa a ser por coluna, sem taxa_congelada, taxa_no_envio e taxa_origem. O servidor lê a taxa só
--    para o dono e o admin.

create table if not exists public.faixa_dono (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  taxa_atual numeric(5, 4) not null check (taxa_atual >= 0 and taxa_atual < 1),
  taxa_anterior numeric(5, 4) check (taxa_anterior is null or (taxa_anterior >= 0 and taxa_anterior < 1)),
  queda_em timestamptz,
  atualizado_em timestamptz not null default now()
);
alter table public.faixa_dono enable row level security;
revoke all on public.faixa_dono from anon, authenticated;
grant select on public.faixa_dono to authenticated;
grant all on public.faixa_dono to service_role;
drop policy if exists faixa_dono_leitura on public.faixa_dono;
create policy faixa_dono_leitura on public.faixa_dono for select to authenticated using (owner_id = auth.uid() or public.is_admin());

create or replace function public.taxa_da_faixa(p_ativos integer) returns numeric
language sql stable set search_path = public as $$
  select taxa from public.faixas_comissao
   where greatest(1, coalesce(p_ativos, 0)) >= min_imoveis
     and (max_imoveis is null or greatest(1, coalesce(p_ativos, 0)) <= max_imoveis)
   order by min_imoveis desc limit 1
$$;

create or replace function public.atualizar_faixa_dono(p_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
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
    -- Caiu de faixa (taxa maior): a anterior, menor, vale por mais 30 dias a partir de agora.
    update public.faixa_dono set taxa_anterior = v_atual.taxa_atual, queda_em = now(), taxa_atual = v_taxa, atualizado_em = now()
     where owner_id = p_owner;
  elsif v_taxa < v_atual.taxa_atual then
    -- Subiu de faixa: vale na hora; a janela de queda acaba.
    update public.faixa_dono set taxa_anterior = null, queda_em = null, taxa_atual = v_taxa, atualizado_em = now()
     where owner_id = p_owner;
  end if;
end
$$;
revoke all on function public.atualizar_faixa_dono(uuid) from public, anon, authenticated;
grant execute on function public.atualizar_faixa_dono(uuid) to service_role;

create or replace function public.properties_faixa_dono() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform public.atualizar_faixa_dono(old.owner_id);
    return old;
  end if;
  perform public.atualizar_faixa_dono(new.owner_id);
  if tg_op = 'UPDATE' and old.owner_id is distinct from new.owner_id then
    perform public.atualizar_faixa_dono(old.owner_id);
  end if;
  return new;
end
$$;
drop trigger if exists properties_faixa_dono on public.properties;
create trigger properties_faixa_dono after insert or delete or update of status, owner_id on public.properties
  for each row execute function public.properties_faixa_dono();

-- Situação de hoje para quem já tem imóvel (sem janela de queda: não há histórico anterior).
insert into public.faixa_dono (owner_id, taxa_atual)
select owner_id, coalesce(public.taxa_da_faixa(count(*) filter (where status = 'active')::integer), 0.12)
  from public.properties where owner_id is not null group by owner_id
on conflict (owner_id) do nothing;

alter table public.propostas add column if not exists taxa_origem text;
alter table public.propostas drop constraint if exists propostas_taxa_origem_valida;
alter table public.propostas add constraint propostas_taxa_origem_valida
  check (taxa_origem is null or taxa_origem in ('faixa', 'faixa_com_queda_recente', 'admin', 'proposta_envio'));
alter table public.leads add column if not exists accepted_commission_origem text;
alter table public.leads drop constraint if exists leads_accepted_commission_origem_valida;
alter table public.leads add constraint leads_accepted_commission_origem_valida
  check (accepted_commission_origem is null or accepted_commission_origem in ('faixa', 'faixa_com_queda_recente', 'admin', 'proposta_envio', 'plano'));
alter table public.leads add column if not exists accepted_commission_faixa numeric(5, 4);

revoke select on public.propostas from authenticated;
grant select (id, numero, lead_id, property_id, owner_id, tenant_id, status, versao_atual, validade_dias, valida_ate,
              visto_em, recusada_por, recusa_motivo, recusa_texto, aceita_em, criada_em, atualizada_em)
  on public.propostas to authenticated;
