-- Rollback da 0324 (E679-B parte 3). Volta a conduta ao desenho da 0215/0220 (leitura imediata dos dois lados, nota na hora).
-- Atenção: depois do rollback a avaliação de conduta deixa de ser cega.
begin;
drop trigger if exists vistoria_conduta_apos_envio on public.vistoria_conduta;
drop function if exists public.vistoria_conduta_apos_envio();
drop trigger if exists vistoria_conduta_valida on public.vistoria_conduta;
drop function if exists public.vistoria_conduta_valida();
drop function if exists public.publicar_conduta_avaliador(uuid);
drop policy if exists vistoria_conduta_le on public.vistoria_conduta;
create policy vistoria_conduta_le on public.vistoria_conduta for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.vistoria_pedidos p where p.id = vistoria_conduta.pedido_id
               and (p.owner_id = (select auth.uid()) or public.vistoria_sou_avaliador(p.avaliador_id)))
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
   where c.status in ('ativo', 'em_teste')
$$;
revoke all on function public.avaliadores_publicos() from public;
grant execute on function public.avaliadores_publicos() to anon, authenticated, service_role;
drop function if exists public.vistoria_laudo_emitido_em(uuid);
alter table public.vistoria_conduta drop column if exists publicada_em;
delete from supabase_migrations.schema_migrations where version = '20261107000324';
commit;
