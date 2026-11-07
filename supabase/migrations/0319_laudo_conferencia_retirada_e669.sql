-- E669 — o laudo independente da conferência passa a poder ser REMOVIDO ou TROCADO pelo próprio autor enquanto a conferência
-- está aberta, sempre com registro. A tabela conferencia_laudos continua imutável para qualquer escrita direta; só a função
-- abaixo (chamada pelo servidor) abre a exceção, na mesma transação, com uma marca de sessão.
create table if not exists public.conferencia_laudos_retirados (
  id uuid primary key default gen_random_uuid(),
  conferencia_id uuid not null references public.conferencias (id) on delete cascade,
  path text not null,
  tamanho integer not null,
  parte text not null check (parte in ('proprietario', 'inquilino')),
  enviado_por uuid references auth.users (id) on delete set null,
  anexado_em timestamptz not null,
  retirado_por uuid references auth.users (id) on delete set null,
  retirado_em timestamptz not null default now(),
  motivo text not null check (motivo in ('retirado', 'trocado'))
);
comment on table public.conferencia_laudos_retirados is
  'E669: registro dos laudos independentes retirados ou trocados pelo autor antes de a conferência fechar (quem, quando, por quê). Só o servidor lê e grava.';
create index if not exists conferencia_laudos_retirados_conf on public.conferencia_laudos_retirados (conferencia_id);
alter table public.conferencia_laudos_retirados enable row level security;
revoke all on public.conferencia_laudos_retirados from anon, authenticated;
grant all on public.conferencia_laudos_retirados to service_role;

create or replace function public.conferencia_laudos_imutavel() returns trigger
language plpgsql set search_path = public as $$
begin
  -- Única exceção: a troca/retirada feita por trocar_laudo_conferencia (marca de sessão, vale só nesta transação).
  if tg_op in ('UPDATE', 'DELETE') and pg_trigger_depth() = 1 and coalesce(current_setting('viva.laudo_troca', true), '') <> 'on' then
    raise exception 'O laudo anexado não pode ser alterado.';
  end if;
  return coalesce(new, old);
end;
$$;

-- Retira (p_novo_path nulo) ou troca o laudo. Devolve 'ok', 'sem_laudo', 'nao_autor' ou 'fechada'. Atômica: registro + remoção + novo.
create or replace function public.trocar_laudo_conferencia(
  p_conferencia uuid, p_user uuid, p_novo_path text, p_novo_tamanho integer, p_parte text
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_atual public.conferencia_laudos%rowtype;
begin
  select * into v_atual from public.conferencia_laudos where conferencia_id = p_conferencia for update;
  if not found then return 'sem_laudo'; end if;
  if v_atual.enviado_por is distinct from p_user then return 'nao_autor'; end if;
  if exists (select 1 from public.conferencias where id = p_conferencia and fechada_em is not null) then return 'fechada'; end if;

  insert into public.conferencia_laudos_retirados (conferencia_id, path, tamanho, parte, enviado_por, anexado_em, retirado_por, motivo)
  values (v_atual.conferencia_id, v_atual.path, v_atual.tamanho, v_atual.parte, v_atual.enviado_por, v_atual.criado_em, p_user,
          case when p_novo_path is null then 'retirado' else 'trocado' end);

  perform set_config('viva.laudo_troca', 'on', true);
  delete from public.conferencia_laudos where conferencia_id = p_conferencia;
  if p_novo_path is not null then
    insert into public.conferencia_laudos (conferencia_id, path, tamanho, enviado_por, parte)
    values (p_conferencia, p_novo_path, p_novo_tamanho, p_user, p_parte);
  end if;
  perform set_config('viva.laudo_troca', 'off', true);
  return 'ok';
end;
$$;
revoke all on function public.trocar_laudo_conferencia(uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.trocar_laudo_conferencia(uuid, uuid, text, integer, text) to service_role;
