-- 0089 — AVALIAÇÕES, FASE 1 (fechar a brecha). Pedido do Daniel em 07/10/2026.
--
-- Hoje há 3 tabelas parecidas e VAZIAS em produção (conferido em 07/10/2026):
--   reviews (0004: qualquer logado cria avaliação de qualquer um),
--   property_reviews (0018: "author_name" digitado à mão) e avaliacoes (0034).
-- Viram UMA tabela, public.avaliacoes, com:
--   • só quem foi PARTE de um contrato ENCERRADO avalia a OUTRA parte, uma vez,
--     até 14 dias depois do fim (contratos.encerrado_em);
--   • leitura pública só do que está PUBLICADO e só das colunas públicas
--     (as notas privadas nunca saem para anon/logado);
--   • sem UPDATE/DELETE do usuário depois de enviada;
--   • publicação ÀS CEGAS: as duas do mesmo contrato aparecem quando ambas
--     chegam, ou quando vence o prazo de 14 dias (publicar_avaliacoes, cron diário);
--   • comentário com telefone/e-mail/rede ou ofensa vai para 'em_moderacao'.
-- Cartão da Fernanda: grava os MESMOS valores que o Moacir já pôs em produção
-- (07/10/2026, "Confiança, Cadastro e Reputação", ativa, rotina 05:47) — nunca o antigo.
--
-- TRAVA: se qualquer uma das 3 tabelas tiver linha, a migração PARA (nada some).
-- Sem NOTICE. Rollback: supabase/producao/rollback/0089_rollback.sql

do $$
declare n bigint := 0;
begin
  if to_regclass('public.reviews') is not null then execute 'select count(*) from public.reviews' into n; end if;
  if n > 0 then raise exception 'reviews tem % linha(s): migração interrompida para não perder dados', n; end if;
  if to_regclass('public.property_reviews') is not null then execute 'select count(*) from public.property_reviews' into n; end if;
  if n > 0 then raise exception 'property_reviews tem % linha(s): migração interrompida para não perder dados', n; end if;
  if to_regclass('public.avaliacoes') is not null then execute 'select count(*) from public.avaliacoes' into n; end if;
  if n > 0 then raise exception 'avaliacoes tem % linha(s): migração interrompida para não perder dados', n; end if;
end;
$$;

drop table public.reviews;
drop table public.property_reviews;
drop table public.avaliacoes;

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  autor_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  alvo_id uuid not null references auth.users(id) on delete cascade,
  papel_autor text not null check (papel_autor in ('inquilino', 'proprietario')),
  imovel_id uuid references public.properties(id) on delete set null,
  nota_geral int check (nota_geral between 1 and 5),
  notas_categorias jsonb not null default '{}'::jsonb check (jsonb_typeof(notas_categorias) = 'object'),
  etiquetas text[] not null default '{}' check (cardinality(etiquetas) <= 12),
  recomendaria boolean,
  comentario_publico text check (char_length(comentario_publico) <= 500),
  nota_privada_parte text check (char_length(nota_privada_parte) <= 500),
  nota_privada_viva text check (char_length(nota_privada_viva) <= 500),
  status text not null default 'rascunho' check (status in ('rascunho', 'enviada', 'publicada', 'em_moderacao', 'removida')),
  moderacao_motivo text,
  enviada_em timestamptz,
  publicada_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (contrato_id, autor_id),
  check (autor_id <> alvo_id),
  check (status = 'rascunho' or nota_geral is not null)
);
create index avaliacoes_alvo_status on public.avaliacoes (alvo_id, status);
create index avaliacoes_imovel_status on public.avaliacoes (imovel_id, status);
create index avaliacoes_enviadas on public.avaliacoes (contrato_id) where status = 'enviada';

-- Ofensa/discriminação (lista curta; o que cair aqui vai para a fila do admin,
-- não é bloqueio automático). Mesma lista em src/lib/avaliacoes.ts (OFENSAS).
create or replace function public.contem_ofensa(t text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(
    translate(lower(t), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
      ~ '\m(porra|caralho|merda|bosta|puta|puto|putaria|foda|fodase|fdp|vsf|tnc|pqp|cu|buceta|arrombad[oa]|desgracad[oa]|vagabund[oa]|otari[oa]|babaca|imbecil|retardad[oa]|escrot[oa]|piranha|vadia|corno|viado|veado|bicha|traveco|sapatao|macaco|macaca|crioul[oa]|favelad[oa])\M',
    false)
$$;

-- Quem está logado pode avaliar ESTE contrato/alvo agora? (usada na política)
create or replace function public.pode_avaliar(p_contrato uuid, p_alvo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.contratos c
      join public.properties p on p.id = c.property_id
     where c.id = p_contrato
       and c.status in ('concluido', 'encerrado_sem_renovacao', 'encerrado_em_acerto')
       and c.encerrado_em is not null
       and now() <= c.encerrado_em + interval '14 days'
       and ((auth.uid() = c.tenant_id and p_alvo = p.owner_id)
         or (auth.uid() = p.owner_id and p_alvo = c.tenant_id))
       and auth.uid() <> p_alvo
  )
$$;

-- Regras de gravação (valem para o site, para a service role e para o SQL).
-- "Cliente" = chamada pelo PostgREST com JWT de usuário (auth.role() = 'authenticated').
-- pg_trigger_depth() > 1 = a própria publicação às cegas (função interna).
create or replace function public.avaliacao_valida()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
  cliente boolean := coalesce(auth.role(), '') in ('authenticated', 'anon') and pg_trigger_depth() <= 1;
begin
  if tg_op = 'UPDATE' then
    if new.contrato_id is distinct from old.contrato_id or new.autor_id is distinct from old.autor_id or new.alvo_id is distinct from old.alvo_id then
      raise exception 'Contrato, autor e avaliado não mudam.' using errcode = '23514';
    end if;
    if cliente and old.status <> 'rascunho' then
      raise exception 'Avaliação enviada não pode ser alterada.' using errcode = '42501';
    end if;
  end if;
  if cliente then
    new.autor_id := auth.uid();
    if new.status not in ('rascunho', 'enviada') then
      raise exception 'Status inválido.' using errcode = '42501';
    end if;
    new.publicada_em := null;
  end if;

  select ct.status, ct.tenant_id, ct.encerrado_em, ct.property_id, pr.owner_id
    into c
    from public.contratos ct
    join public.properties pr on pr.id = ct.property_id
   where ct.id = new.contrato_id;
  if not found then
    raise exception 'Contrato não encontrado.' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if c.status not in ('concluido', 'encerrado_sem_renovacao', 'encerrado_em_acerto') or c.encerrado_em is null then
      raise exception 'Só é possível avaliar depois do fim do contrato.' using errcode = '23514';
    end if;
    if now() > c.encerrado_em + interval '14 days' then
      raise exception 'O prazo para avaliar (14 dias depois do fim do contrato) terminou.' using errcode = '23514';
    end if;
  end if;
  if new.autor_id = c.tenant_id and new.alvo_id = c.owner_id then
    new.papel_autor := 'inquilino';
  elsif new.autor_id = c.owner_id and new.alvo_id = c.tenant_id then
    new.papel_autor := 'proprietario';
  else
    raise exception 'Autor e avaliado precisam ser as partes do contrato.' using errcode = '23514';
  end if;
  new.imovel_id := c.property_id;

  -- Enviada agora: data de envio + filtro (contato ou ofensa → moderação).
  if new.status = 'enviada' and (tg_op = 'INSERT' or old.status = 'rascunho') then
    new.enviada_em := now();
    if public.contem_contato(new.comentario_publico, true) or public.contem_contato(new.nota_privada_parte, true) then
      new.status := 'em_moderacao';
      new.moderacao_motivo := 'contato (telefone, e-mail ou rede social)';
    elsif public.contem_ofensa(new.comentario_publico) or public.contem_ofensa(new.nota_privada_parte) then
      new.status := 'em_moderacao';
      new.moderacao_motivo := 'ofensa ou discriminação';
    end if;
  end if;
  return new;
end;
$$;
create trigger avaliacao_valida before insert or update on public.avaliacoes
  for each row execute function public.avaliacao_valida();

-- Publicação ÀS CEGAS: 'enviada' vira 'publicada' quando a outra parte também
-- enviou (ou está em moderação/publicada) ou quando venceram os 14 dias.
create or replace function public.publicar_avaliacoes(p_contrato uuid default null)
returns integer
language sql
security definer
set search_path = public
as $$
  with pub as (
    update public.avaliacoes a
       set status = 'publicada', publicada_em = now()
     where a.status = 'enviada'
       and (p_contrato is null or a.contrato_id = p_contrato)
       and (exists (select 1 from public.avaliacoes b
                     where b.contrato_id = a.contrato_id and b.autor_id <> a.autor_id
                       and b.status in ('enviada', 'em_moderacao', 'publicada'))
            or exists (select 1 from public.contratos c
                        where c.id = a.contrato_id and c.encerrado_em + interval '14 days' <= now()))
    returning 1
  )
  select count(*)::int from pub
$$;

create or replace function public.avaliacao_apos_envio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.publicar_avaliacoes(new.contrato_id);
  return null;
end;
$$;
-- Também quando cai em moderação: quem enviou do outro lado não espera à toa.
create trigger avaliacao_apos_envio after insert or update of status on public.avaliacoes
  for each row when (new.status in ('enviada', 'em_moderacao')) execute function public.avaliacao_apos_envio();

-- Recebidas por mim (publicadas), com a nota privada que a outra parte me deixou.
create or replace function public.avaliacoes_recebidas()
returns table (id uuid, contrato_id uuid, papel_autor text, nota_geral int, notas_categorias jsonb, etiquetas text[],
               recomendaria boolean, comentario_publico text, nota_privada_parte text, publicada_em timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.contrato_id, a.papel_autor, a.nota_geral, a.notas_categorias, a.etiquetas,
         a.recomendaria, a.comentario_publico, a.nota_privada_parte, a.publicada_em
    from public.avaliacoes a
   where a.alvo_id = auth.uid() and a.status = 'publicada'
   order by a.publicada_em desc
$$;

alter table public.avaliacoes enable row level security;
revoke all on public.avaliacoes from anon, authenticated;
grant select (id, contrato_id, autor_id, alvo_id, papel_autor, imovel_id, nota_geral, notas_categorias, etiquetas,
              recomendaria, comentario_publico, status, enviada_em, publicada_em, criado_em)
  on public.avaliacoes to anon, authenticated;
grant insert (contrato_id, alvo_id, papel_autor, nota_geral, notas_categorias, etiquetas, recomendaria,
              comentario_publico, nota_privada_parte, nota_privada_viva, status)
  on public.avaliacoes to authenticated;
grant update (nota_geral, notas_categorias, etiquetas, recomendaria, comentario_publico, nota_privada_parte,
              nota_privada_viva, status)
  on public.avaliacoes to authenticated;
grant all on public.avaliacoes to service_role;

create policy avaliacoes_publicadas on public.avaliacoes for select to anon, authenticated
  using (status = 'publicada');
create policy avaliacoes_autor_le on public.avaliacoes for select to authenticated
  using (autor_id = auth.uid());
create policy avaliacoes_admin_le on public.avaliacoes for select to authenticated
  using (public.is_admin());
-- 'em_moderacao' só aparece aqui porque o FILTRO (gatilho) põe; o usuário não
-- consegue escolher esse status (o gatilho recusa qualquer um além de rascunho/enviada).
create policy avaliacoes_autor_cria on public.avaliacoes for insert to authenticated
  with check (autor_id = auth.uid() and status in ('rascunho', 'enviada', 'em_moderacao') and public.pode_avaliar(contrato_id, alvo_id));
create policy avaliacoes_autor_edita_rascunho on public.avaliacoes for update to authenticated
  using (autor_id = auth.uid() and status = 'rascunho')
  with check (autor_id = auth.uid() and status in ('rascunho', 'enviada', 'em_moderacao'));

revoke all on function public.pode_avaliar(uuid, uuid) from public, anon;
grant execute on function public.pode_avaliar(uuid, uuid) to authenticated, service_role;
revoke all on function public.publicar_avaliacoes(uuid) from public, anon, authenticated;
grant execute on function public.publicar_avaliacoes(uuid) to service_role;
revoke all on function public.avaliacoes_recebidas() from public, anon;
grant execute on function public.avaliacoes_recebidas() to authenticated;
revoke all on function public.avaliacao_valida() from public, anon, authenticated;
revoke all on function public.avaliacao_apos_envio() from public, anon, authenticated;

-- Fernanda: o mesmo cartão que o Moacir gravou em produção em 07/10/2026
-- (idempotente: lá não muda nada; num banco novo, ela já nasce ativa).
update public.agentes
   set cargo = 'Confiança, Cadastro e Reputação',
       status = 'ativo',
       rotina_texto = 'Todo dia 05:47 Brasília',
       trigger_id = 'trig_01DjEJvriUb7DgGXbPZJd4YX'
 where slug = 'fernanda';
