-- Viva Nomads — aplicar 0262 (E264-B: categoria "Sugestões e novidades" e a fila dos e-mails proativos). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0262_rollback.sql.
begin;
set local lock_timeout = '5s';

-- ── 1. Categoria "Sugestões e novidades" (sugestoes) ────────────────────────────────────────────────────────────
-- Os 5 e-mails proativos (imóvel novo para o pedido, alerta de busca, pedido compatível, resumo de pedidos e pedido
-- expirando) saem de "outros"/"lembretes" para "sugestoes". Quem já tinha desligado "outros" continua sem eles: a
-- categoria nova entra desligada para essa pessoa.
alter table public.profiles drop constraint if exists profiles_notif_categorias_chk;
alter table public.profiles add constraint profiles_notif_categorias_chk
  check (notif_categorias_desligadas <@ array['mensagens', 'lembretes', 'outros', 'sugestoes']::text[]);
update public.profiles
   set notif_categorias_desligadas = notif_categorias_desligadas || array['sugestoes']::text[]
 where 'outros' = any (notif_categorias_desligadas)
   and not ('sugestoes' = any (notif_categorias_desligadas));
comment on column public.profiles.notif_categorias_desligadas is
  'Prompt 44 + E264-B: categorias de aviso desligadas pela pessoa (mensagens, lembretes, outros, sugestoes). Decisões e segurança não desligam.';

-- ── 2. Fila dos e-mails proativos ────────────────────────────────────────────────────────────────────────────────
-- Uma linha por (pessoa, evento, imóvel ou pedido): a chave única é o "sem repetição". O e-mail sai agrupado (até 3
-- cartões) e respeita o teto por pessoa (1 por dia, 3 por semana) e o silêncio das 22h–7h; o que não cabe espera o
-- próximo envio. envio_id agrupa as linhas que saíram no mesmo e-mail (é o que o teto conta).
create table if not exists public.emails_proativos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.profiles (id) on delete cascade,
  evento text not null check (evento in ('pedido_imovel_novo', 'saved_search_match', 'pedido_compativel', 'pedido_expirando')),
  ref_id uuid not null,
  chave text not null unique check (char_length(chave) <= 300),
  extra jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz,
  envio_id uuid,
  descartado_em timestamptz,
  motivo_descarte text check (motivo_descarte is null or char_length(motivo_descarte) <= 60)
);
create index if not exists emails_proativos_pendentes on public.emails_proativos (usuario_id, criado_em)
  where enviado_em is null and descartado_em is null;
create index if not exists emails_proativos_enviados on public.emails_proativos (usuario_id, enviado_em desc)
  where enviado_em is not null;
alter table public.emails_proativos enable row level security;
revoke all on public.emails_proativos from anon, authenticated;
comment on table public.emails_proativos is
  'E264-B: fila dos e-mails proativos (sugestões e novidades), uma linha por (pessoa, evento, imóvel/pedido). Só o servidor lê e grava.';

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261030000262', '0262_emails_proativos', array['-- conteúdo em supabase/migrations/0262_emails_proativos.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261030000262');
commit;
