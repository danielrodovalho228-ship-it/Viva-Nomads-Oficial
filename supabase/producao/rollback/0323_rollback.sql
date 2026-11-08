-- Rollback da 0323 (E679-B parte 2). Volta o par cliente ↔ parceiro ao desenho da 0197 e a trilha de resposta/contestação à da 0129.
-- ATENÇÃO (destrutivo só para o que a 0323 criou): apaga respostas e contestações ligadas a avaliações de parceiro e as
-- colunas novas de parceiro_avaliacoes. As avaliações da estadia não são tocadas.
begin;
delete from public.avaliacao_respostas where parceiro_avaliacao_id is not null;
delete from public.avaliacao_contestacoes where parceiro_avaliacao_id is not null;
drop policy if exists avaliacao_respostas_publicas_parceiro on public.avaliacao_respostas;
drop index if exists public.avaliacao_respostas_uma_por_avaliacao;
drop index if exists public.avaliacao_respostas_uma_por_parceiro;
drop index if exists public.avaliacao_contestacoes_uma_aberta_parceiro;
alter table public.avaliacao_respostas drop constraint if exists avaliacao_respostas_alvo_e679;
alter table public.avaliacao_contestacoes drop constraint if exists avaliacao_contestacoes_alvo_e679;
revoke select on public.avaliacao_respostas from anon, authenticated;
revoke insert on public.avaliacao_respostas from authenticated;
revoke insert on public.avaliacao_contestacoes from authenticated;
alter table public.avaliacao_respostas drop column if exists parceiro_avaliacao_id;
alter table public.avaliacao_contestacoes drop column if exists parceiro_avaliacao_id;
alter table public.avaliacao_respostas drop constraint if exists avaliacao_respostas_pkey;
alter table public.avaliacao_respostas drop column if exists id;
alter table public.avaliacao_respostas alter column avaliacao_id set not null;
alter table public.avaliacao_respostas add primary key (avaliacao_id);
alter table public.avaliacao_contestacoes alter column avaliacao_id set not null;
grant select (avaliacao_id, texto, criada_em) on public.avaliacao_respostas to anon, authenticated;
grant insert (avaliacao_id, texto) on public.avaliacao_respostas to authenticated;
grant insert (avaliacao_id, motivo, detalhe) on public.avaliacao_contestacoes to authenticated;
create or replace function public.avaliacao_resposta_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare a record;
begin
  select alvo_id, status into a from public.avaliacoes where id = new.avaliacao_id;
  if not found or a.status <> 'publicada' then
    raise exception 'Só é possível responder a uma avaliação publicada.' using errcode = '23514';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    new.autor_id := auth.uid();
    if a.alvo_id is distinct from auth.uid() then
      raise exception 'Só a pessoa avaliada responde.' using errcode = '42501';
    end if;
  end if;
  if public.contem_contato(new.texto, true) then
    raise exception 'Tire telefone, e-mail ou rede social da resposta.' using errcode = '23514';
  end if;
  if public.contem_ofensa(new.texto) then
    raise exception 'A resposta não pode ter ofensa.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create or replace function public.avaliacao_contestacao_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare a record;
begin
  if tg_op = 'INSERT' then
    select alvo_id, status into a from public.avaliacoes where id = new.avaliacao_id;
    if not found or a.status <> 'publicada' then
      raise exception 'Só é possível pedir revisão de uma avaliação publicada.' using errcode = '23514';
    end if;
    if coalesce(auth.role(), '') <> 'service_role' then
      new.autor_id := auth.uid();
      if a.alvo_id is distinct from auth.uid() then
        raise exception 'Só a pessoa avaliada pede revisão.' using errcode = '42501';
      end if;
      new.status := 'aberta';
      new.decisao := null;
      new.decidida_em := null;
    end if;
  elsif coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Só a equipe decide o pedido de revisão.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.avaliacao_resposta_valida() from public, anon, authenticated;
revoke all on function public.avaliacao_contestacao_valida() from public, anon, authenticated;

drop function if exists public.nota_do_cliente_entre_parceiros(uuid);
create or replace function public.publicar_avaliacoes_parceiro(p_pedido uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with pub as (
    update public.parceiro_avaliacoes a
       set status = 'publicada', publicada_em = now()
     where a.status = 'enviada'
       and (p_pedido is null or a.pedido_id = p_pedido)
       and (exists (select 1 from public.parceiro_avaliacoes b
                     where b.pedido_id = a.pedido_id and b.autor_id <> a.autor_id
                       and b.status in ('enviada', 'em_moderacao', 'publicada'))
            or exists (select 1 from public.parceiro_pedidos x
                        where x.id = a.pedido_id and x.concluido_em + interval '14 days' <= now()))
    returning a.pedido_id
  )
  select count(*)::integer into n from pub;

  update public.parceiros p
     set nota_media = s.media, avaliacoes_qtd = s.qtd
    from (
      select x.parceiro_id, round(avg(a.nota)::numeric, 1) as media, count(*)::integer as qtd
        from public.parceiro_avaliacoes a
        join public.parceiro_pedidos x on x.id = a.pedido_id
       where a.status = 'publicada' and a.papel_autor = 'cliente'
       group by x.parceiro_id
    ) s
   where p.id = s.parceiro_id
     and (p.nota_media is distinct from s.media or p.avaliacoes_qtd is distinct from s.qtd);
  return n;
end $$;
revoke all on function public.publicar_avaliacoes_parceiro(uuid) from public, anon, authenticated;
grant execute on function public.publicar_avaliacoes_parceiro(uuid) to service_role;
drop trigger if exists parceiro_avaliacao_valida on public.parceiro_avaliacoes;
drop function if exists public.parceiro_avaliacao_valida();
drop policy if exists parceiro_avaliacoes_le on public.parceiro_avaliacoes;
create policy parceiro_avaliacoes_le on public.parceiro_avaliacoes for select to authenticated
  using (autor_id = (select auth.uid()) or (status = 'publicada' and public.parceiro_pedido_parte(pedido_id)) or public.is_admin());
revoke select on public.parceiro_avaliacoes from authenticated;
grant select on public.parceiro_avaliacoes to authenticated;
drop function if exists public.parceiro_avaliacao_legivel(uuid, text);
drop function if exists public.sou_parceiro();
alter table public.parceiro_avaliacoes drop constraint if exists parceiro_avaliacoes_campos_e679;
alter table public.parceiro_avaliacoes
  drop column if exists notas_categorias, drop column if exists etiquetas, drop column if exists recomendaria,
  drop column if exists nota_privada_parte, drop column if exists nota_privada_viva, drop column if exists moderacao_motivo;
delete from supabase_migrations.schema_migrations where version = '20261107000323';
commit;
