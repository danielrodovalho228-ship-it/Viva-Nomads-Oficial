-- 0225 — 61-B: dados que faltavam da análise do Airbnb. Tipo de entrada (público, sem código nem local do cofre), mensagem
-- do dono para quem vai pedir, "o que considerar antes de pedir" e o convite a quem vai morar junto (só leitura).
-- Idempotente.

-- ── 1. Anúncio: tipo de entrada, mensagem para quem pede, o que considerar ──────────────────────────────────────────
alter table public.properties add column if not exists tipo_entrada text;
alter table public.properties add column if not exists mensagem_para_pedido text;
alter table public.properties add column if not exists considerar_antes text[] not null default '{}';
alter table public.properties add column if not exists considerar_antes_texto text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'properties_tipo_entrada_chk') then
    alter table public.properties add constraint properties_tipo_entrada_chk
      check (tipo_entrada is null or tipo_entrada in ('porteiro', 'chave_com_proprietario', 'cofre_de_chaves', 'fechadura_com_codigo', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_mensagem_para_pedido_chk') then
    alter table public.properties add constraint properties_mensagem_para_pedido_chk
      check (mensagem_para_pedido is null or char_length(mensagem_para_pedido) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_considerar_antes_chk') then
    alter table public.properties add constraint properties_considerar_antes_chk
      check (considerar_antes <@ array['barulho', 'obra', 'escada', 'area_compartilhada', 'outro']::text[]);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'properties_considerar_antes_texto_chk') then
    alter table public.properties add constraint properties_considerar_antes_texto_chk
      check (considerar_antes_texto is null or char_length(considerar_antes_texto) <= 300);
  end if;
end $$;
comment on column public.properties.tipo_entrada is
  '61-B: como se entra (público). Código, senha e local do cofre ficam em imovel_instrucoes_chegada.como_entrar (restrito, D-7).';
comment on column public.properties.mensagem_para_pedido is
  '61-B: mensagem do dono a quem vai pedir (≤ 500). Contato direto mascarado ao salvar e ao exibir.';
-- Públicas como o resto do anúncio: aparecem na página do imóvel e no pedido.
grant select (tipo_entrada, mensagem_para_pedido, considerar_antes, considerar_antes_texto) on public.properties to anon, authenticated;

-- ── 2. Convidados da estadia (quem vai morar junto; só leitura) ─────────────────────────────────────────────────────
create table if not exists public.estadia_convidados (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.contratos(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and char_length(email) between 5 and 254),
  convidado_user_id uuid references auth.users(id) on delete set null,
  convidado_por uuid not null references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now(),
  removido_em timestamptz
);
create index if not exists estadia_convidados_contrato on public.estadia_convidados (contrato_id);
create index if not exists estadia_convidados_usuario on public.estadia_convidados (convidado_user_id) where removido_em is null;
create unique index if not exists estadia_convidados_um_ativo on public.estadia_convidados (contrato_id, email) where removido_em is null;
comment on table public.estadia_convidados is
  '61-B: ocupantes convidados pelo morador. Veem datas, endereço, instruções de chegada (depois do D-7) e linha do tempo; nunca valores, contrato, caução, documentos, recibos ou conversa. Remover corta o acesso na hora. Apagados 30 dias depois do fim da estadia.';
alter table public.estadia_convidados enable row level security;
revoke all on public.estadia_convidados from anon, authenticated;
grant select on public.estadia_convidados to authenticated;
grant all on public.estadia_convidados to service_role;

-- O convidado ATIVO do contrato (removido_em nulo). Security definer, como eh_parte_do_contrato.
create or replace function public.eh_convidado_do_contrato(p_contrato uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.estadia_convidados e
     where e.contrato_id = p_contrato and auth.uid() is not null and e.convidado_user_id = auth.uid() and e.removido_em is null
  );
$$;
revoke all on function public.eh_convidado_do_contrato(uuid) from public, anon;
grant execute on function public.eh_convidado_do_contrato(uuid) to authenticated, service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'estadia_convidados' and policyname = 'convidados: partes, o próprio convidado ativo e a equipe') then
    create policy "convidados: partes, o próprio convidado ativo e a equipe" on public.estadia_convidados for select to authenticated using (
      public.is_admin() or public.eh_parte_do_contrato(estadia_convidados.contrato_id)
      or (estadia_convidados.convidado_user_id = auth.uid() and estadia_convidados.removido_em is null)
    );
  end if;
end $$;

-- Teto no banco: convidados ativos nunca passam de qtd_ocupantes − 1 (o servidor confere antes; isto é a rede).
create or replace function public.estadia_convidados_teto() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  teto integer;
  ativos integer;
begin
  if new.removido_em is not null then
    return new;
  end if;
  select greatest(coalesce(qtd_ocupantes, 1) - 1, 0) into teto from public.contratos where id = new.contrato_id;
  select count(*) into ativos from public.estadia_convidados
   where contrato_id = new.contrato_id and removido_em is null and id <> new.id;
  if ativos >= teto then
    raise exception 'convidados acima do limite do contrato (%)', teto using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.estadia_convidados_teto() from public;
drop trigger if exists estadia_convidados_teto on public.estadia_convidados;
create trigger estadia_convidados_teto before insert or update of removido_em on public.estadia_convidados
  for each row execute function public.estadia_convidados_teto();

-- ── 3. Eventos do contrato: convite feito, removido e apagado pela retenção ──────────────────────────────────────────
alter table public.contrato_eventos drop constraint if exists contrato_eventos_tipo_check;
alter table public.contrato_eventos add constraint contrato_eventos_tipo_check check (tipo in (
  'aditivo_proposto', 'aditivo_aceito', 'aditivo_recusado', 'aditivo_expirado', 'estadia_remarcada',
  'encerramento_pedido', 'contrato_encerrado', 'instrucoes_liberadas', 'ocupantes_apagados',
  'convidado_adicionado', 'convidado_removido', 'convidados_apagados'
));
