-- Viva Nomads — 0109: histórico e réplica da ordem de manutenção; notificações ligadas por padrão.
-- Idempotente e sem NOTICE (tudo criado só se ainda não existir). Não mexe nas políticas de service_orders (F1).
-- Produção: supabase/producao/aplicar-0109.sql (aplicada pela Action no merge). Rollback: supabase/producao/rollback/0109_rollback.sql.
-- Histórico da ordem de manutenção (abertura e cada mudança de status, com data/hora)
-- e réplica dentro da ordem (service_order_messages). Toda escrita passa pelo servidor
-- (service role) depois de conferir que quem age é uma das partes da ordem; as partes só leem.
do $$
begin
  if to_regclass('public.service_order_eventos') is null then
    create table public.service_order_eventos (
      id uuid primary key default gen_random_uuid(),
      service_order_id uuid not null references public.service_orders (id) on delete cascade,
      ator_id uuid references public.profiles (id) on delete set null,
      papel text not null check (papel in ('inquilino', 'proprietario', 'sistema')),
      tipo text not null check (tipo in ('aberto', 'status')),
      status_de text,
      status_para text,
      criado_em timestamptz not null default now()
    );
    create index service_order_eventos_ordem_idx on public.service_order_eventos (service_order_id, criado_em);
  end if;
  if to_regclass('public.service_order_messages_ordem_idx') is null then
    create index service_order_messages_ordem_idx on public.service_order_messages (service_order_id, created_at);
  end if;
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.service_order_messages'::regclass and conname = 'service_order_messages_body_tamanho'
  ) then
    alter table public.service_order_messages
      add constraint service_order_messages_body_tamanho check (length(body) between 1 and 2000);
  end if;
end;
$$;

comment on table public.service_order_eventos is 'Histórico da ordem de manutenção: abertura e mudanças de status. Só o servidor grava; as partes leem.';

alter table public.service_order_eventos enable row level security;
revoke all on public.service_order_eventos from anon, authenticated;
grant select on public.service_order_eventos to authenticated;
grant all on public.service_order_eventos to service_role;

-- Mensagens da ordem: as partes leem (política "mensagens do chamado", 0006); gravar só pelo servidor.
revoke all on public.service_order_messages from anon;
revoke insert, update, delete on public.service_order_messages from authenticated;
grant select on public.service_order_messages to authenticated;
grant all on public.service_order_messages to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'service_order_eventos' and policyname = 'historico da ordem: partes e equipe'
  ) then
    create policy "historico da ordem: partes e equipe" on public.service_order_eventos
      for select to authenticated using (
        public.is_admin()
        or exists (
          select 1 from public.service_orders s
           where s.id = service_order_eventos.service_order_id
             and (s.tenant_id = auth.uid() or s.owner_id = auth.uid())
        )
      );
  end if;
end;
$$;

-- Ordens que já existiam ganham a linha de abertura no histórico (uma vez só).
insert into public.service_order_eventos (service_order_id, ator_id, papel, tipo, status_para, criado_em)
select s.id, s.tenant_id, 'inquilino', 'aberto', 'aberto', s.opened_at
  from public.service_orders s
 where not exists (select 1 from public.service_order_eventos e where e.service_order_id = s.id and e.tipo = 'aberto');

-- Critério 5: notificações ligadas por padrão (conta sem preferência salva = ligada).
alter table public.profiles alter column notif_email set default true;
alter table public.profiles alter column notif_whatsapp set default true;
update public.profiles set notif_email = true where notif_email is null;
update public.profiles set notif_whatsapp = true where notif_whatsapp is null;
