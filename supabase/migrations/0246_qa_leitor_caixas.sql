-- 0246 — QA-CAIXA-B: leitor de QA das caixas de teste, sem admin e sem 2FA.
-- profiles.qa_leitor marca a conta de QA que lê TODAS as caixas de teste em /dashboard/qa/emails.
-- Só o servidor (service role / migração) liga qa_leitor, como is_teste na 0135: uma pessoa logada não se marca.
-- A leitura vale só em emails_teste, só select, e só para conta qa_leitor E is_teste. Nenhuma outra tabela muda.
-- ADMIN_2FA_OBRIGATORIA e is_admin() não são tocados: o admin continua exigindo o código.
alter table public.profiles add column if not exists qa_leitor boolean not null default false;

create or replace function public.profiles_qa_leitor_so_servidor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'service_role') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.qa_leitor := false;
    else
      new.qa_leitor := old.qa_leitor;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_qa_leitor_guarda on public.profiles;
create trigger profiles_qa_leitor_guarda
  before insert or update on public.profiles
  for each row execute function public.profiles_qa_leitor_so_servidor();

drop policy if exists emails_teste_qa_leitor_le on public.emails_teste;
create policy emails_teste_qa_leitor_le on public.emails_teste
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.qa_leitor and p.is_teste));

-- A conta de QA do Muse (conta de teste já usada no roteiro), pelo id: nenhum e-mail na migração.
-- Só liga se ela for conta de teste; trocar de conta = outra migração com o novo id.
update public.profiles
   set qa_leitor = true
 where id = '7216d0e9-6246-482a-a1de-524fd5231dc2'
   and is_teste
   and not qa_leitor;
