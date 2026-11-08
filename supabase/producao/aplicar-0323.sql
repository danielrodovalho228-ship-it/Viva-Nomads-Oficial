-- Viva Nomads — aplicar 0323 (E679-B parte 2: avaliação do parceiro igual à da estadia). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0323_rollback.sql.
begin;
set local lock_timeout = '5s';

-- ── 1. Colunas novas em parceiro_avaliacoes ─────────────────────────────────────────────────────────────────────
alter table public.parceiro_avaliacoes add column if not exists notas_categorias jsonb not null default '{}'::jsonb;
alter table public.parceiro_avaliacoes add column if not exists etiquetas text[] not null default '{}';
alter table public.parceiro_avaliacoes add column if not exists recomendaria boolean;
alter table public.parceiro_avaliacoes add column if not exists nota_privada_parte text;
alter table public.parceiro_avaliacoes add column if not exists nota_privada_viva text;
alter table public.parceiro_avaliacoes add column if not exists moderacao_motivo text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'parceiro_avaliacoes_campos_e679') then
    alter table public.parceiro_avaliacoes add constraint parceiro_avaliacoes_campos_e679 check (
      jsonb_typeof(notas_categorias) = 'object'
      and cardinality(etiquetas) <= 12
      and (nota_privada_parte is null or char_length(nota_privada_parte) <= 500)
      and (nota_privada_viva is null or char_length(nota_privada_viva) <= 500)
    );
  end if;
end $$;

-- ── 2. Quem é parceiro ativo (usado na leitura da nota parceiro → cliente) ──────────────────────────────────────
create or replace function public.sou_parceiro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.parceiros p where p.user_id = (select auth.uid()) and p.status in ('publicado', 'pausado'))
$$;
revoke all on function public.sou_parceiro() from public, anon;
grant execute on function public.sou_parceiro() to authenticated, service_role;

-- Leitura da avaliação do pedido (a cega continua: cada um vê a própria; a da outra parte só depois de publicada).
--   cliente → parceiro: as duas partes do pedido leem, depois de publicada;
--   parceiro → cliente: SÓ outros parceiros leem (premissa fechada do Daniel); o cliente avaliado NÃO lê.
create or replace function public.parceiro_avaliacao_legivel(p_pedido uuid, p_papel text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_papel = 'cliente' then public.parceiro_pedido_parte(p_pedido)
    else public.sou_parceiro()
         and not exists (select 1 from public.parceiro_pedidos x where x.id = p_pedido and x.cliente_id = (select auth.uid()))
  end
$$;
revoke all on function public.parceiro_avaliacao_legivel(uuid, text) from public, anon;
grant execute on function public.parceiro_avaliacao_legivel(uuid, text) to authenticated, service_role;

drop policy if exists parceiro_avaliacoes_le on public.parceiro_avaliacoes;
create policy parceiro_avaliacoes_le on public.parceiro_avaliacoes for select to authenticated
  using (
    autor_id = (select auth.uid())
    or (status = 'publicada' and public.parceiro_avaliacao_legivel(pedido_id, papel_autor))
    or public.is_admin()
  );
-- As notas privadas nunca saem pela leitura direta: só o servidor (service_role) e a RPC entregam.
revoke select on public.parceiro_avaliacoes from authenticated;
grant select (id, pedido_id, autor_id, papel_autor, nota, texto, status, enviada_em, publicada_em, notas_categorias, etiquetas, recomendaria)
  on public.parceiro_avaliacoes to authenticated;

-- ── 3. Regras de gravação (valem para o site, a service role e o SQL) ──────────────────────────────────────────
create or replace function public.parceiro_avaliacao_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  x record;
  chaves text[];
begin
  if tg_op = 'UPDATE' then
    -- Sem edição depois de enviada: só status, publicada_em e motivo de moderação mudam (publicação e moderação).
    if new.pedido_id is distinct from old.pedido_id or new.autor_id is distinct from old.autor_id
       or new.papel_autor is distinct from old.papel_autor or new.nota is distinct from old.nota
       or new.texto is distinct from old.texto or new.notas_categorias is distinct from old.notas_categorias
       or new.etiquetas is distinct from old.etiquetas or new.recomendaria is distinct from old.recomendaria
       or new.nota_privada_parte is distinct from old.nota_privada_parte or new.nota_privada_viva is distinct from old.nota_privada_viva
       or new.enviada_em is distinct from old.enviada_em then
      raise exception 'Avaliação enviada não pode ser alterada.' using errcode = '42501';
    end if;
    return new;
  end if;

  select p.status, p.cliente_id, p.concluido_em, pa.user_id as parceiro_user
    into x
    from public.parceiro_pedidos p
    join public.parceiros pa on pa.id = p.parceiro_id
   where p.id = new.pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = '23514';
  end if;
  if x.status <> 'concluido' or x.concluido_em is null then
    raise exception 'A avaliação abre quando o serviço é concluído.' using errcode = '23514';
  end if;
  if now() > x.concluido_em + interval '14 days' then
    raise exception 'O prazo para avaliar (14 dias depois da conclusão) terminou.' using errcode = '23514';
  end if;
  if new.autor_id = x.cliente_id then
    new.papel_autor := 'cliente';
    chaves := array['qualidade', 'pontualidade', 'cuidado_imovel'];
  elsif new.autor_id = x.parceiro_user then
    new.papel_autor := 'parceiro';
    chaves := array['comunicacao', 'imovel_pronto', 'combinado_cumprido'];
  else
    raise exception 'Só o cliente e o parceiro do pedido avaliam.' using errcode = '42501';
  end if;

  if exists (select 1 from jsonb_object_keys(new.notas_categorias) k where k <> all (chaves)) then
    raise exception 'Esse critério não existe nesta avaliação.' using errcode = '23514';
  end if;
  if exists (select 1 from jsonb_each(new.notas_categorias) e
              where jsonb_typeof(e.value) <> 'number' or (e.value #>> '{}') !~ '^[1-5]$') then
    raise exception 'A nota de cada critério vai de 1 a 5.' using errcode = '23514';
  end if;
  if (select count(*) from jsonb_object_keys(new.notas_categorias)) <> 3 then
    raise exception 'Dê uma nota de 1 a 5 para cada um dos três critérios.' using errcode = '23514';
  end if;
  if new.recomendaria is null then
    raise exception 'Diga se recomendaria (sim ou não).' using errcode = '23514';
  end if;
  if cardinality(new.etiquetas) > 5 or exists (select 1 from unnest(new.etiquetas) t where char_length(t) > 40) then
    raise exception 'Escolha até 5 etiquetas.' using errcode = '23514';
  end if;

  new.enviada_em := now();
  new.publicada_em := null;
  if new.status not in ('enviada', 'em_moderacao') then
    new.status := 'enviada';
  end if;
  -- Moderação só por ofensa ou dado pessoal (telefone, e-mail, rede, documento). Nota baixa legítima nunca é barrada.
  if public.contem_contato(new.texto, true) or public.contem_contato(new.nota_privada_parte, true)
     or public.contem_documento(new.texto) or public.contem_documento(new.nota_privada_parte) then
    new.status := 'em_moderacao';
    new.moderacao_motivo := 'dado pessoal (telefone, e-mail, rede social ou documento)';
  elsif public.contem_ofensa(new.texto) or public.contem_ofensa(new.nota_privada_parte) then
    new.status := 'em_moderacao';
    new.moderacao_motivo := 'ofensa ou discriminação';
  end if;
  return new;
end;
$$;
drop trigger if exists parceiro_avaliacao_valida on public.parceiro_avaliacoes;
create trigger parceiro_avaliacao_valida before insert or update on public.parceiro_avaliacoes
  for each row execute function public.parceiro_avaliacao_valida();
revoke all on function public.parceiro_avaliacao_valida() from public, anon, authenticated;

-- ── 4. Publicação cega: o MESMO motor; a nota da página do parceiro só conta o PUBLICADO ────────────────────────
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

  -- Recalcula de todos os parceiros que já tiveram avaliação: remoção por revisão também tira da média.
  update public.parceiros p
     set nota_media = s.media, avaliacoes_qtd = s.qtd
    from (
      select pa.id as parceiro_id,
             (select round(avg(a.nota)::numeric, 1) from public.parceiro_avaliacoes a
                join public.parceiro_pedidos x on x.id = a.pedido_id
               where x.parceiro_id = pa.id and a.status = 'publicada' and a.papel_autor = 'cliente') as media,
             (select count(*)::integer from public.parceiro_avaliacoes a
                join public.parceiro_pedidos x on x.id = a.pedido_id
               where x.parceiro_id = pa.id and a.status = 'publicada' and a.papel_autor = 'cliente') as qtd
        from public.parceiros pa
       where pa.id in (select x.parceiro_id from public.parceiro_pedidos x join public.parceiro_avaliacoes a on a.pedido_id = x.id)
    ) s
   where p.id = s.parceiro_id
     and (p.nota_media is distinct from s.media or p.avaliacoes_qtd is distinct from s.qtd);
  return n;
end $$;
revoke all on function public.publicar_avaliacoes_parceiro(uuid) from public, anon, authenticated;
grant execute on function public.publicar_avaliacoes_parceiro(uuid) to service_role;

-- A nota que os parceiros deram a um cliente: só para quem é parceiro ativo e não é o próprio cliente.
create or replace function public.nota_do_cliente_entre_parceiros(p_cliente uuid)
returns table (media numeric, qtd integer, recomendariam integer)
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(a.nota)::numeric, 1), count(*)::integer, count(*) filter (where a.recomendaria)::integer
    from public.parceiro_avaliacoes a
    join public.parceiro_pedidos x on x.id = a.pedido_id
   where x.cliente_id = p_cliente and a.papel_autor = 'parceiro' and a.status = 'publicada'
     and public.sou_parceiro() and (select auth.uid()) <> p_cliente
  having count(*) > 0
$$;
revoke all on function public.nota_do_cliente_entre_parceiros(uuid) from public, anon;
grant execute on function public.nota_do_cliente_entre_parceiros(uuid) to authenticated, service_role;

-- ── 5. Resposta e contestação: a MESMA trilha, agora também para a avaliação do parceiro ───────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'avaliacao_respostas' and column_name = 'id') then
    alter table public.avaliacao_respostas drop constraint avaliacao_respostas_pkey;
    alter table public.avaliacao_respostas add column id uuid not null default gen_random_uuid();
    alter table public.avaliacao_respostas add primary key (id);
  end if;
end $$;
alter table public.avaliacao_respostas alter column avaliacao_id drop not null;
alter table public.avaliacao_respostas add column if not exists parceiro_avaliacao_id uuid references public.parceiro_avaliacoes (id) on delete cascade;
alter table public.avaliacao_contestacoes alter column avaliacao_id drop not null;
alter table public.avaliacao_contestacoes add column if not exists parceiro_avaliacao_id uuid references public.parceiro_avaliacoes (id) on delete cascade;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'avaliacao_respostas_alvo_e679') then
    alter table public.avaliacao_respostas add constraint avaliacao_respostas_alvo_e679 check ((avaliacao_id is null) <> (parceiro_avaliacao_id is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avaliacao_contestacoes_alvo_e679') then
    alter table public.avaliacao_contestacoes add constraint avaliacao_contestacoes_alvo_e679 check ((avaliacao_id is null) <> (parceiro_avaliacao_id is null));
  end if;
end $$;
create unique index if not exists avaliacao_respostas_uma_por_avaliacao on public.avaliacao_respostas (avaliacao_id) where avaliacao_id is not null;
create unique index if not exists avaliacao_respostas_uma_por_parceiro on public.avaliacao_respostas (parceiro_avaliacao_id) where parceiro_avaliacao_id is not null;
create unique index if not exists avaliacao_contestacoes_uma_aberta_parceiro on public.avaliacao_contestacoes (parceiro_avaliacao_id) where status = 'aberta' and parceiro_avaliacao_id is not null;

revoke select on public.avaliacao_respostas from anon, authenticated;
grant select (id, avaliacao_id, parceiro_avaliacao_id, texto, criada_em) on public.avaliacao_respostas to anon, authenticated;
revoke insert on public.avaliacao_respostas from authenticated;
grant insert (avaliacao_id, parceiro_avaliacao_id, texto) on public.avaliacao_respostas to authenticated;
revoke insert on public.avaliacao_contestacoes from authenticated;
grant insert (avaliacao_id, parceiro_avaliacao_id, motivo, detalhe) on public.avaliacao_contestacoes to authenticated;

-- Resposta do parceiro-avaliação segue a visibilidade da própria avaliação (a resposta à nota parceiro → cliente
-- também fica só entre parceiros). A subconsulta roda com a RLS de quem lê.
drop policy if exists avaliacao_respostas_publicas_parceiro on public.avaliacao_respostas;
create policy avaliacao_respostas_publicas_parceiro on public.avaliacao_respostas for select to authenticated
  using (parceiro_avaliacao_id is not null and exists (select 1 from public.parceiro_avaliacoes a where a.id = parceiro_avaliacao_id and a.status = 'publicada'));
drop policy if exists avaliacao_respostas_avaliado_cria on public.avaliacao_respostas;
create policy avaliacao_respostas_avaliado_cria on public.avaliacao_respostas for insert to authenticated
  with check (autor_id = auth.uid());

create or replace function public.avaliacao_resposta_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
begin
  if new.parceiro_avaliacao_id is not null then
    -- Só a avaliação do CLIENTE sobre o PARCEIRO recebe resposta: a nota do parceiro sobre o cliente é lida só entre
    -- parceiros, então o cliente avaliado nem a vê (não responde nem contesta).
    select pa.status, par.user_id as alvo_id
      into a
      from public.parceiro_avaliacoes pa
      join public.parceiro_pedidos x on x.id = pa.pedido_id
      join public.parceiros par on par.id = x.parceiro_id
     where pa.id = new.parceiro_avaliacao_id and pa.papel_autor = 'cliente';
  else
    select alvo_id, status into a from public.avaliacoes where id = new.avaliacao_id;
  end if;
  if not found or a.status <> 'publicada' then
    raise exception 'Só é possível responder a uma avaliação publicada.' using errcode = '23514';
  end if;
  if coalesce(auth.role(), '') <> 'service_role' then
    new.autor_id := auth.uid();
    if a.alvo_id is distinct from auth.uid() then
      raise exception 'Só a pessoa avaliada responde.' using errcode = '42501';
    end if;
  end if;
  if public.contem_contato(new.texto, true) or public.contem_documento(new.texto) then
    raise exception 'Tire telefone, e-mail, rede social ou documento da resposta.' using errcode = '23514';
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
declare
  a record;
begin
  if tg_op = 'INSERT' then
    if new.parceiro_avaliacao_id is not null then
      select pa.status, par.user_id as alvo_id
        into a
        from public.parceiro_avaliacoes pa
        join public.parceiro_pedidos x on x.id = pa.pedido_id
        join public.parceiros par on par.id = x.parceiro_id
       where pa.id = new.parceiro_avaliacao_id and pa.papel_autor = 'cliente';
    else
      select alvo_id, status into a from public.avaliacoes where id = new.avaliacao_id;
    end if;
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

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000323', '0323_parceiro_avaliacoes_e679', array['-- conteúdo em supabase/migrations/0323_parceiro_avaliacoes_e679.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000323');

commit;
