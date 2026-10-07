-- 0079 — Plano Gestor no banco: subscriptions.plan passa a aceitar 'gestor'.
-- Limite de anúncios (999) e comissão zero vêm de config/planos.ts (fonte única);
-- o banco só precisava aceitar o valor. A assinatura continua só pelo servidor
-- (0057): o Gestor é ativado pela equipe, para conta elegível.
-- Sem comandos que gerem NOTICE (reaplicar é seguro).
do $$
begin
  if not exists (
    select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
     where t.typname = 'plan_type' and e.enumlabel = 'gestor'
  ) then
    alter type public.plan_type add value 'gestor';
  end if;
end $$;
