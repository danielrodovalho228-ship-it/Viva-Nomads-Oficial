-- Desfaz a 0079. O Postgres não remove valor de enum: recria o tipo sem 'gestor'.
-- Falha (de propósito) se alguma assinatura ainda estiver como 'gestor'.
do $$
begin
  if exists (select 1 from public.subscriptions where plan::text = 'gestor') then
    raise exception 'Há assinaturas Gestor; troque o plano delas antes do rollback.';
  end if;
end $$;
alter type public.plan_type rename to plan_type_0079;
create type public.plan_type as enum ('free', 'essential', 'pro');
drop trigger if exists trg_assinatura_evento on public.subscriptions;
alter table public.subscriptions alter column plan drop default;
alter table public.subscriptions alter column plan type public.plan_type using plan::text::public.plan_type;
alter table public.subscriptions alter column plan set default 'free';
drop type public.plan_type_0079;
create trigger trg_assinatura_evento after insert or update of status, plan on public.subscriptions
  for each row execute function public.registra_assinatura_evento();
