-- Viva Nomads — aplicar 0236 (PERFIL-B: chave Pix de recebimento do proprietário). Idempotente. Rollback: supabase/producao/rollback/0236_rollback.sql.
begin;
set local lock_timeout = '5s';

create table if not exists public.recebimento_pix (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  chave text not null check (char_length(chave) between 3 and 77),
  atualizado_em timestamptz not null default now()
);
comment on table public.recebimento_pix is
  'PERFIL-B: chave Pix em que o proprietário recebe o valor mensal direto do morador. Só o dono da linha lê e grava.';

alter table public.recebimento_pix enable row level security;
revoke all on public.recebimento_pix from anon;
grant select, insert, update, delete on public.recebimento_pix to authenticated;

drop policy if exists recebimento_pix_dono_le on public.recebimento_pix;
create policy recebimento_pix_dono_le on public.recebimento_pix for select to authenticated using (user_id = auth.uid());
drop policy if exists recebimento_pix_dono_cria on public.recebimento_pix;
create policy recebimento_pix_dono_cria on public.recebimento_pix for insert to authenticated with check (user_id = auth.uid());
drop policy if exists recebimento_pix_dono_muda on public.recebimento_pix;
create policy recebimento_pix_dono_muda on public.recebimento_pix for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists recebimento_pix_dono_apaga on public.recebimento_pix;
create policy recebimento_pix_dono_apaga on public.recebimento_pix for delete to authenticated using (user_id = auth.uid());

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261024000236', '0236_recebimento_pix',
       array['-- conteúdo em supabase/migrations/0236_recebimento_pix.sql'], 'danielrodovalho228@gmail.com'
 where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261024000236');
commit;
