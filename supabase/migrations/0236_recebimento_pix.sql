-- PERFIL-B (ordem do Daniel 23/10 21:03, item 3; mockup perfil-07-pagamentos): como o proprietário RECEBE.
-- O morador paga o valor mensal direto ao proprietário — a Viva não recebe esse valor. Até aqui a chave Pix
-- não existia no cadastro (a tela de Pagamentos só tinha o texto). Uma linha por pessoa; só a própria pessoa lê
-- e grava (dado financeiro: nem anon, nem outras contas). Formato validado em src/lib/conta/chave-pix.ts.
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
