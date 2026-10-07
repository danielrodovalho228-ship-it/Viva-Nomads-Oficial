-- Antes da 0079: subscriptions.plan como em produção (enum sem 'gestor').
reset role;
do $$ begin
  if not exists (select 1 from pg_type where typname = 'plan_type') then
    create type public.plan_type as enum ('free', 'essential', 'pro');
  end if;
end $$;
drop trigger if exists trg_assinatura_evento on public.subscriptions;
alter table public.subscriptions alter column plan drop default;
alter table public.subscriptions alter column plan type public.plan_type using plan::public.plan_type;
alter table public.subscriptions alter column plan set default 'free';
create trigger trg_assinatura_evento after insert or update of status, plan on public.subscriptions
  for each row execute function public.registra_assinatura_evento();
select t('ANTES@0079','assinatura Gestor é recusada pelo banco','falha',$q$insert into subscriptions (owner_id, plan, status) values ('11111111-1111-1111-1111-111111111111','gestor','active')$q$);
