-- Pedido de Moradia (housing request reverso): o inquilino publica o que precisa
-- e os proprietários da cidade respondem com seus imóveis.
--
-- REGRAS INEGOCIÁVEIS refletidas aqui:
-- • A plataforma conecta/verifica/documenta/registra — nunca movimenta dinheiro.
-- • TODA comunicação fica DENTRO da plataforma (thread na tabela `messages`).
-- • PRIVACIDADE: o card público NÃO expõe identidade do inquilino. Nome/foto só
--   aparecem para um proprietário DEPOIS que o inquilino aceita a resposta dele.
--   Implementado por VIEW (colunas seguras) + FUNÇÃO de revelação — não no cliente.
-- Reutiliza `public.is_admin()` (0011) nas policies.

-- ── Enums (text + check, padrão das tabelas novas) ───────────────────────────
-- motivo: trabalho_saude | trabalho_corporativo | transicao | estudo | outro
-- pedido: ativo | pausado | atendido | expirado | removido_admin
-- resposta: enviada | vista | aceita_para_conversa | recusada

-- ── 1) Pedido de moradia ─────────────────────────────────────────────────────
create table if not exists pedidos_moradia (
  id uuid primary key default gen_random_uuid(),
  inquilino_id uuid not null references auth.users(id) on delete cascade,
  cidade text not null,
  uf text,
  data_inicio date not null,
  prazo_meses int not null check (prazo_meses between 1 and 12),
  orcamento_mensal numeric(12,2) not null check (orcamento_mensal >= 0),
  qtd_ocupantes int not null check (qtd_ocupantes >= 1),
  motivo text not null check (motivo in
    ('trabalho_saude','trabalho_corporativo','transicao','estudo','outro')),
  apresentacao text,
  status text not null default 'ativo' check (status in
    ('ativo','pausado','atendido','expirado','removido_admin')),
  removido_motivo text,                    -- preenchido na moderação (admin)
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);

create index if not exists pedidos_inquilino_idx on pedidos_moradia (inquilino_id);
create index if not exists pedidos_cidade_status_idx on pedidos_moradia (cidade, status);
create index if not exists pedidos_expira_idx on pedidos_moradia (expira_em);

-- Expiração automática = MENOR entre (data_inicio + 15d) e (criado_em + 60d).
-- Trigger garante o valor mesmo se o insert não vier do app.
create or replace function set_pedido_expira_em() returns trigger
language plpgsql as $trg$
begin
  if new.expira_em is null then
    new.expira_em := least(
      (new.data_inicio::timestamptz + interval '15 days'),
      (coalesce(new.criado_em, now()) + interval '60 days')
    );
  end if;
  return new;
end $trg$;

drop trigger if exists trg_pedido_expira on pedidos_moradia;
create trigger trg_pedido_expira before insert on pedidos_moradia
  for each row execute function set_pedido_expira_em();

-- ── 2) Resposta do proprietário ao pedido ────────────────────────────────────
create table if not exists respostas_pedido (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos_moradia(id) on delete cascade,
  proprietario_id uuid not null references auth.users(id) on delete cascade,
  imovel_id uuid not null references properties(id) on delete cascade,
  mensagem text,
  status text not null default 'enviada' check (status in
    ('enviada','vista','aceita_para_conversa','recusada')),
  recusa_motivo text,
  criado_em timestamptz not null default now(),
  -- Um imóvel responde o mesmo pedido UMA vez.
  unique (pedido_id, imovel_id)
);

create index if not exists respostas_pedido_idx on respostas_pedido (pedido_id);
create index if not exists respostas_prop_idx on respostas_pedido (proprietario_id);

-- ── 3) Log de moderação (ações de admin) ─────────────────────────────────────
create table if not exists moderacao_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  acao text not null,                      -- ex.: 'ocultar_pedido', 'reativar_pedido'
  alvo_tipo text not null,                 -- ex.: 'pedido_moradia'
  alvo_id uuid not null,
  motivo text,
  criado_em timestamptz not null default now()
);
create index if not exists moderacao_log_alvo_idx on moderacao_log (alvo_tipo, alvo_id);

-- ── 4) RLS ───────────────────────────────────────────────────────────────────
alter table pedidos_moradia enable row level security;
alter table respostas_pedido enable row level security;
alter table moderacao_log enable row level security;

-- pedidos_moradia: inquilino dono OU admin. Proprietários NÃO leem a linha-base
-- (identidade protegida) — eles usam a view `pedidos_publicos` (abaixo).
drop policy if exists "inquilino gerencia seus pedidos" on pedidos_moradia;
create policy "inquilino gerencia seus pedidos" on pedidos_moradia
  for all using (inquilino_id = auth.uid() or public.is_admin())
  with check (inquilino_id = auth.uid() or public.is_admin());

-- respostas_pedido: proprietário vê/cria as suas; inquilino vê/atualiza as
-- respostas aos SEUS pedidos; admin tudo.
drop policy if exists "proprietario le suas respostas" on respostas_pedido;
create policy "proprietario le suas respostas" on respostas_pedido
  for select using (
    proprietario_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from pedidos_moradia p
               where p.id = respostas_pedido.pedido_id and p.inquilino_id = auth.uid())
  );

-- Proprietário cria resposta: precisa ser dono do imóvel, imóvel ATIVO e pedido
-- ATIVO (a capacidade x ocupantes é validada na server action).
drop policy if exists "proprietario cria resposta" on respostas_pedido;
create policy "proprietario cria resposta" on respostas_pedido
  for insert with check (
    proprietario_id = auth.uid()
    and exists (
      select 1 from properties im
      where im.id = respostas_pedido.imovel_id
        and im.owner_id = auth.uid()
        and im.status = 'active'
    )
    and exists (
      select 1 from pedidos_moradia p
      where p.id = respostas_pedido.pedido_id and p.status = 'ativo'
    )
  );

-- Atualização: o proprietário atualiza a própria resposta; o inquilino atualiza
-- o status (aceitar/recusar) das respostas aos seus pedidos; admin tudo.
drop policy if exists "partes atualizam resposta" on respostas_pedido;
create policy "partes atualizam resposta" on respostas_pedido
  for update using (
    proprietario_id = auth.uid()
    or public.is_admin()
    or exists (select 1 from pedidos_moradia p
               where p.id = respostas_pedido.pedido_id and p.inquilino_id = auth.uid())
  );

-- moderacao_log: só admin.
drop policy if exists "admin gerencia log" on moderacao_log;
create policy "admin gerencia log" on moderacao_log
  for all using (public.is_admin()) with check (public.is_admin());

-- ── 5) View de privacidade — o que o proprietário vê do pedido ───────────────
-- SECURITY DEFINER (default de views no PG): expõe SÓ colunas seguras dos
-- pedidos ATIVOS e não expirados, com o selo de verificação do inquilino.
-- NUNCA inclui inquilino_id, nome ou foto.
create or replace view pedidos_publicos
with (security_invoker = false) as
  select
    p.id,
    p.cidade,
    p.uf,
    p.data_inicio,
    p.prazo_meses,
    p.orcamento_mensal,
    p.qtd_ocupantes,
    p.motivo,
    p.apresentacao,
    p.status,
    p.criado_em,
    p.expira_em,
    coalesce(pf.verification_progress, 0) >= 100 as inquilino_verificado
  from pedidos_moradia p
  join profiles pf on pf.id = p.inquilino_id
  where p.status = 'ativo' and p.expira_em > now();

grant select on pedidos_publicos to authenticated;

-- ── 6) Revelação do nome — SÓ após aceite ────────────────────────────────────
-- Devolve nome/foto do inquilino APENAS se o proprietário que chama tem uma
-- resposta 'aceita_para_conversa' naquele pedido. Antes disso, retorna vazio.
create or replace function public.pedido_inquilino(pedido uuid)
returns table (full_name text, verificado boolean)
language sql security definer set search_path = public as $$
  select pf.full_name, coalesce(pf.verification_progress,0) >= 100
  from pedidos_moradia p
  join profiles pf on pf.id = p.inquilino_id
  where p.id = pedido
    and exists (
      select 1 from respostas_pedido r
      where r.pedido_id = p.id
        and r.proprietario_id = auth.uid()
        and r.status = 'aceita_para_conversa'
    )
  limit 1;
$$;

revoke all on function public.pedido_inquilino(uuid) from public;
grant execute on function public.pedido_inquilino(uuid) to authenticated;

-- ── 7) Expiração (função idempotente) + pg_cron + checagem lazy ──────────────
create or replace function expira_pedidos_moradia() returns void
language plpgsql security definer set search_path = public as $fn$
begin
  update pedidos_moradia
     set status = 'expirado'
   where status = 'ativo' and expira_em <= now();
end $fn$;

grant execute on function expira_pedidos_moradia() to authenticated, service_role;

do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('expira-pedidos-moradia')
    where exists (select 1 from cron.job where jobname = 'expira-pedidos-moradia');
  perform cron.schedule('expira-pedidos-moradia', '5 6 * * *', 'select expira_pedidos_moradia();');
exception when others then
  raise notice 'pg_cron indisponível (%). A checagem lazy no app cobre a expiração.', sqlerrm;
end $cron$;

-- ── 8) Acesso admin ao super admin (via papel na tabela, não no cliente) ─────
update profiles set role = 'admin' where lower(email) = 'dtrodovalho40@gmail.com';
