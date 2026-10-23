-- Viva Nomads — rollback da 0220 (porta de entrada do avaliador — correção 62-B3). Idempotente.
-- Os pedidos de credenciamento ainda sem parceiro (aguardando a aprovação) são apagados; a página volta a só ativos.
begin;
set local lock_timeout = '5s';
delete from public.avaliadores_credenciamento where parceiro_id is null;
drop policy if exists avaliadores_credenciamento_le on public.avaliadores_credenciamento;
create policy avaliadores_credenciamento_le on public.avaliadores_credenciamento for select to authenticated
  using (public.parceiro_meu(parceiro_id) or public.is_admin());
drop index if exists public.avaliadores_credenciamento_usuario;
alter table public.avaliadores_credenciamento drop constraint if exists avaliadores_credenciamento_dono;
alter table public.avaliadores_credenciamento drop column if exists solicitacao_id;
alter table public.avaliadores_credenciamento drop column if exists user_id;
alter table public.avaliadores_credenciamento alter column parceiro_id set not null;
update public.parceiro_solicitacoes set categorias = array_remove(categorias, 'vistoria') where 'vistoria' = any(categorias);
alter table public.parceiro_solicitacoes drop constraint if exists parceiro_solicitacoes_categorias;
alter table public.parceiro_solicitacoes add constraint parceiro_solicitacoes_categorias check (
  categorias <@ array['fotografia', 'mudanca', 'limpeza', 'lavanderia', 'montagem', 'manutencao', 'outro']::text[]
);
create or replace function public.avaliadores_publicos()
returns table (numero_credenciado text, nome_curto text, cidade text, avaliacoes_feitas integer, nota_conduta numeric, teste boolean)
language sql
stable
security definer
set search_path = public
as $$
  select c.numero_credenciado,
         split_part(btrim(p.nome_publico), ' ', 1),
         c.cidade,
         (select count(*)::integer from public.vistoria_pedidos v where v.avaliador_id = c.id and v.status = 'laudo_emitido' and not v.teste),
         (select round(avg((k.pontualidade + k.cordialidade + k.cuidado) / 3.0), 1) from public.vistoria_conduta k
           where k.avaliador_id = c.id and k.autor = 'dono'),
         coalesce(pf.is_teste, false)
    from public.avaliadores_credenciamento c
    join public.parceiros p on p.id = c.parceiro_id
    left join public.profiles pf on pf.id = p.user_id
   where c.status = 'ativo'
$$;
delete from supabase_migrations.schema_migrations where version = '20261023000220';
commit;
