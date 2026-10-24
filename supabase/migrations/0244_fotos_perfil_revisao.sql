-- FOTO-PERFIL-B (E13) — a foto do perfil é o ROSTO do titular adulto. Revisão DEPOIS de publicar: toda foto nova entra
-- 'em_revisao' e já aparece (a regra de quem vê continua a do E14: inquilino protegido até o aceite; dono público).
--
--   fotos_perfil_revisao: uma linha por envio (histórico). No máximo uma 'em_revisao' por pessoa.
--     RLS: a pessoa lê só as próprias linhas; só o admin lê todas e muda o status. Ninguém insere ou apaga pela API.
--   foto_perfil_enviada(user, caminho): grava o avatar no perfil E a linha da revisão na MESMA transação (só o
--     servidor chama, pelo service_role, depois de conferir a sessão e o arquivo).
--   Fotos que já existem: uma linha 'em_revisao' para cada avatar atual. NADA é apagado aqui; remover é só pela fila,
--     com motivo da lista fechada.
--   Denúncia "Foto de perfil inadequada": a foto volta para 'em_revisao' no topo da fila (denunciada_em).
--   chamados.contexto_tipo ganha 'perfil' (o "Problema com isto?" da foto de uma pessoa).

create table if not exists public.fotos_perfil_revisao (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  caminho text not null,
  status text not null default 'em_revisao' check (status in ('em_revisao', 'aprovada', 'removida')),
  motivo text,
  revisado_por uuid references public.profiles (id) on delete set null,
  revisado_em timestamptz,
  enviada_em timestamptz not null default now(),
  denunciada_em timestamptz,
  constraint fotos_perfil_revisao_caminho_do_dono check (caminho = user_id::text || '/avatar.webp'),
  constraint fotos_perfil_revisao_motivo check (
    (status = 'removida' and motivo in ('Não mostra um rosto', 'Parece ser de criança ou adolescente', 'Mais de uma pessoa', 'Não parece ser você', 'Imagem imprópria'))
    or (status <> 'removida' and motivo is null)
  ),
  constraint fotos_perfil_revisao_revisada check (status = 'em_revisao' or (revisado_em is not null))
);
create unique index if not exists fotos_perfil_revisao_uma_aberta on public.fotos_perfil_revisao (user_id) where status = 'em_revisao';
create index if not exists fotos_perfil_revisao_fila_idx on public.fotos_perfil_revisao (denunciada_em desc nulls last, enviada_em) where status = 'em_revisao';
create index if not exists fotos_perfil_revisao_user_idx on public.fotos_perfil_revisao (user_id, enviada_em desc);

alter table public.fotos_perfil_revisao enable row level security;
revoke all on public.fotos_perfil_revisao from anon, authenticated;
grant select on public.fotos_perfil_revisao to authenticated;
grant update (status, motivo, revisado_por, revisado_em, denunciada_em) on public.fotos_perfil_revisao to authenticated;
drop policy if exists "fotos_perfil_revisao: a pessoa lê as suas; admin lê todas" on public.fotos_perfil_revisao;
create policy "fotos_perfil_revisao: a pessoa lê as suas; admin lê todas" on public.fotos_perfil_revisao
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "fotos_perfil_revisao: só admin muda o status" on public.fotos_perfil_revisao;
create policy "fotos_perfil_revisao: só admin muda o status" on public.fotos_perfil_revisao
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Avatar + revisão na mesma transação. Foto nova com uma revisão aberta: a linha aberta passa a ser a da foto nova
-- (volta para o fim da fila e deixa de contar como denunciada).
create or replace function public.foto_perfil_enviada(p_user uuid, p_caminho text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_caminho is distinct from p_user::text || '/avatar.webp' then
    raise exception 'caminho da foto não é o do titular' using errcode = '22023';
  end if;
  update public.profiles set avatar_url = p_caminho, avatar_atualizado_em = now() where id = p_user;
  if not found then
    raise exception 'perfil inexistente' using errcode = 'P0002';
  end if;
  insert into public.fotos_perfil_revisao (user_id, caminho)
  values (p_user, p_caminho)
  on conflict (user_id) where status = 'em_revisao'
  do update set caminho = excluded.caminho, enviada_em = now(), denunciada_em = null
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.foto_perfil_enviada(uuid, text) from public, anon, authenticated;
grant execute on function public.foto_perfil_enviada(uuid, text) to service_role;

-- Fotos que já existem entram na fila (a mais antiga primeiro). Nada é apagado.
insert into public.fotos_perfil_revisao (user_id, caminho, enviada_em)
select p.id, p.avatar_url, coalesce(p.avatar_atualizado_em, now())
  from public.profiles p
 where p.avatar_url = p.id::text || '/avatar.webp'
   and not exists (select 1 from public.fotos_perfil_revisao r where r.user_id = p.id and r.status = 'em_revisao');

alter table public.chamados drop constraint if exists chamados_contexto_tipo_check;
alter table public.chamados add constraint chamados_contexto_tipo_check check (contexto_tipo in ('pedido', 'contrato', 'anuncio', 'manutencao', 'parceiro', 'perfil'));
