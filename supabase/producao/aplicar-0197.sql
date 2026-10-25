-- Viva Nomads — 0197: contratação de parceiros (Prompt 31b) — orçamento, aceite, horário, execução, entrega,
-- documento do parceiro e avaliação; bucket privado das entregas; catálogo antigo marcado como obsoleto. Idempotente.
-- Nenhum dinheiro passa pela Viva: pagamento "indisponivel" (chave desligada) ou "simulado" (contas de teste).
-- Rollback: supabase/producao/rollback/0197_rollback.sql.
-- Aplicada pela Action quando o PR é mesclado (o merge é a aprovação do Daniel).
begin;
set local lock_timeout = '5s';


-- ── 1. parceiro_pedidos ganha horários, valores congelados, pagamento, documento e origem ──────────────────────
alter table public.parceiro_pedidos add column if not exists horarios_propostos timestamptz[] not null default '{}';
alter table public.parceiro_pedidos add column if not exists horario_confirmado timestamptz;
alter table public.parceiro_pedidos add column if not exists valor_combinado numeric(10, 2);
alter table public.parceiro_pedidos add column if not exists taxa_percent numeric(4, 3);
alter table public.parceiro_pedidos add column if not exists valor_taxa numeric(10, 2);
alter table public.parceiro_pedidos add column if not exists valor_parceiro numeric(10, 2);
alter table public.parceiro_pedidos add column if not exists pagamento_status text not null default 'indisponivel';
alter table public.parceiro_pedidos add column if not exists pagamento_ref text;
alter table public.parceiro_pedidos add column if not exists documento_parceiro_path text;
alter table public.parceiro_pedidos add column if not exists concluido_em timestamptz;
alter table public.parceiro_pedidos add column if not exists entregue_em timestamptz;
alter table public.parceiro_pedidos add column if not exists origem text not null default 'manual';
alter table public.parceiro_pedidos add column if not exists motivo_recusa text;

comment on column public.parceiro_pedidos.valor is 'Legado (0190): sinônimo de valor_combinado, sem uso novo.';
comment on column public.parceiro_pedidos.data_sugerida is 'Legado (0190): substituída por horarios_propostos, sem uso novo.';

alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_status_check;
alter table public.parceiro_pedidos add constraint parceiro_pedidos_status_check check (status in (
  'solicitado', 'orcado', 'aceito', 'agendado', 'em_execucao', 'entregue', 'concluido', 'recusado', 'cancelado'));

alter table public.parceiro_pedidos drop constraint if exists parceiro_pedidos_contratacao_check;
alter table public.parceiro_pedidos add constraint parceiro_pedidos_contratacao_check check (
  coalesce(array_length(horarios_propostos, 1), 0) <= 3
  and (valor_combinado is null or (valor_combinado > 0 and valor_combinado <= 100000))
  and (taxa_percent is null or taxa_percent between 0 and 1)
  and (valor_taxa is null or valor_taxa >= 0)
  and (valor_parceiro is null or valor_parceiro >= 0)
  -- a divisão sempre fecha: taxa + parceiro = valor combinado
  and (valor_combinado is null or valor_taxa is null or valor_parceiro is null or valor_taxa + valor_parceiro = valor_combinado)
  and pagamento_status in ('indisponivel', 'simulado', 'pago')
  and (pagamento_ref is null or char_length(pagamento_ref) <= 80)
  and (documento_parceiro_path is null or char_length(documento_parceiro_path) <= 200)
  and origem in ('manual', 'automatico')
  and (motivo_recusa is null or char_length(motivo_recusa) <= 120)
);

-- Teto de orçamentos abertos e listas do painel.
create index if not exists parceiro_pedidos_cliente_abertos on public.parceiro_pedidos (cliente_id, categoria)
  where status in ('solicitado', 'orcado');
create index if not exists parceiro_pedidos_agendados on public.parceiro_pedidos (horario_confirmado)
  where status = 'agendado';

-- Conversa do pedido: as mensagens ficam em messages, marcadas com o pedido (separadas das conversas de imóvel).
-- Quem grava é o servidor, depois de conferir que a pessoa é parte do pedido (o filtro de contato do banco vale igual).
alter table public.messages add column if not exists parceiro_pedido_id uuid references public.parceiro_pedidos (id) on delete set null;
create index if not exists messages_parceiro_pedido on public.messages (parceiro_pedido_id) where parceiro_pedido_id is not null;

-- ── 2. Avaliações do pedido (a tabela avaliacoes exige contrato de imóvel: não serve para pedido de parceiro) ──
create table if not exists public.parceiro_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.parceiro_pedidos (id) on delete cascade,
  autor_id uuid not null references auth.users (id) on delete cascade,
  papel_autor text not null check (papel_autor in ('cliente', 'parceiro')),
  nota smallint not null check (nota between 1 and 5),
  texto text check (texto is null or char_length(texto) <= 500),
  status text not null default 'enviada' check (status in ('enviada', 'publicada', 'em_moderacao', 'removida')),
  enviada_em timestamptz not null default now(),
  publicada_em timestamptz,
  unique (pedido_id, autor_id)
);
create index if not exists parceiro_avaliacoes_pedido on public.parceiro_avaliacoes (pedido_id);
create index if not exists parceiro_avaliacoes_autor on public.parceiro_avaliacoes (autor_id);

alter table public.parceiro_avaliacoes enable row level security;
revoke all on public.parceiro_avaliacoes from public, anon, authenticated;
grant select on public.parceiro_avaliacoes to authenticated;
grant all on public.parceiro_avaliacoes to service_role;
drop policy if exists parceiro_avaliacoes_le on public.parceiro_avaliacoes;
-- Cega até publicar: cada um vê a própria; a da outra parte só depois de publicada. A equipe vê todas.
create policy parceiro_avaliacoes_le on public.parceiro_avaliacoes for select to authenticated
  using (autor_id = (select auth.uid()) or (status = 'publicada' and public.parceiro_pedido_parte(pedido_id)) or public.is_admin());

-- Publica quando as duas partes avaliaram ou 14 dias depois da conclusão; atualiza a nota da página do parceiro.
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

-- ── 3. Bucket PRIVADO das entregas e do documento do parceiro (URL assinada de 10 min; só o servidor grava) ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('parceiro-entregas', 'parceiro-entregas', false, 26214400,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/zip', 'video/mp4'])
on conflict (id) do nothing;

-- ── 4. Catálogo paralelo: obsoleto (não apagar; nada novo lê ou grava) ─────────────────────────────────────────
comment on table public.servicos_adicionais is 'OBSOLETA (0197): os serviços do morador e do dono são os parceiros (parceiro_pedidos).';
comment on table public.servicos_pedidos is 'OBSOLETA (0197): substituída por parceiro_pedidos.';
comment on table public.interesse_servico is 'OBSOLETA (0197): copiada para o avise-me de categoria (interesse_fotografo_cidade).';

-- O avise-me antigo vira avise-me de categoria na cidade do imóvel da pessoa (contrato mais recente ou imóvel dela).
insert into public.interesse_fotografo_cidade (user_id, uf, chave, cidade, categoria)
select i.user_id, upper(btrim(pr.state)), c.chave, btrim(pr.city), m.categoria
  from public.interesse_servico i
  join (values ('assistencia_24h', 'manutencao'), ('frete_mudanca', 'mudanca'), ('lavanderia_enxoval', 'lavanderia'),
               ('limpeza', 'limpeza'), ('plano_manutencao', 'manutencao')) as m (servico_id, categoria)
    on m.servico_id = i.servico_id
  join lateral (
    select p.city, p.state from (
      select k.property_id, k.created_at from public.contratos k where k.tenant_id = i.user_id
      union all
      select o.id, o.created_at from public.properties o where o.owner_id = i.user_id
    ) r
    join public.properties p on p.id = r.property_id
    order by r.created_at desc
    limit 1
  ) pr on true
  cross join lateral (
    select btrim(regexp_replace(regexp_replace(lower(translate(btrim(pr.city),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
      '[^a-z0-9'' -]', ' ', 'g'), '\s+', ' ', 'g')) as chave
  ) c
 where i.avisado_em is null
   and upper(btrim(coalesce(pr.state, ''))) ~ '^[A-Z]{2}$'
   and char_length(btrim(coalesce(pr.city, ''))) between 2 and 80
   and char_length(c.chave) >= 2
on conflict (user_id, uf, chave, categoria) do nothing;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261021000197', '0197_parceiros_contratacao',
       array['-- conteúdo em supabase/migrations/0197_parceiros_contratacao.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261021000197');
commit;
