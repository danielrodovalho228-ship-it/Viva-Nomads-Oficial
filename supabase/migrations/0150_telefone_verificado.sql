-- 0150 — Verificação de telefone por SMS (prompt 7).
-- O código é o NATIVO do Supabase Auth (updateUser({ phone }) + verifyOtp 'phone_change'); o provedor de SMS
-- é configurado pelo Daniel no painel do Supabase (docs/telefone-sms.md). Aqui só:
--   * public.telefone_verificacao: estado da verificação (sem o número), para "trocar o número zera o selo";
--   * telefone_em_uso(): recusa neutra quando o número já está confirmado em outra conta;
--   * telefones_verificados(): selo (cartão do proprietário e do candidato, /admin/usuarios).
-- A função do perfil da 0149 NÃO muda (reaplicar a 0149 continua seguro).
-- Tudo só service_role. Rollback: supabase/producao/rollback/0150_rollback.sql.

create table if not exists public.telefone_verificacao (
  user_id uuid primary key references auth.users (id) on delete cascade,
  verificado_em timestamptz,
  pedido_em timestamptz,
  atualizado_em timestamptz not null default now()
);

alter table public.telefone_verificacao enable row level security;
revoke all on table public.telefone_verificacao from public, anon, authenticated;
grant select, insert, update, delete on table public.telefone_verificacao to service_role;
comment on table public.telefone_verificacao is
  'Verificação de telefone (0150): só o estado (verificado_em / pedido_em). O número fica SÓ no Supabase Auth (auth.users.phone). Pedir código para outro número zera verificado_em. Só service_role.';

-- Número já confirmado em OUTRA conta (recusa neutra no envio). Só o servidor.
create or replace function public.telefone_em_uso(p_phone text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
     where u.phone = p_phone and u.id <> p_user and u.phone_confirmed_at is not null
  )
$$;
revoke all on function public.telefone_em_uso(text, uuid) from public, anon, authenticated;
grant execute on function public.telefone_em_uso(text, uuid) to service_role;

-- Selo "Telefone verificado" de vários usuários (cartão do candidato, admin). Nunca devolve o número.
create or replace function public.telefones_verificados(p_ids uuid[])
returns table (id uuid, verificado boolean)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, (u.phone_confirmed_at is not null and tv.verificado_em is not null) as verificado
    from auth.users u
    left join public.telefone_verificacao tv on tv.user_id = u.id
   where u.id = any (p_ids)
$$;
revoke all on function public.telefones_verificados(uuid[]) from public, anon, authenticated;
grant execute on function public.telefones_verificados(uuid[]) to service_role;

