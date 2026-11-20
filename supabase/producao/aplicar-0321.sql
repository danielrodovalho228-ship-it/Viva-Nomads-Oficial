-- Viva Nomads — aplicar 0321 (E287: marca de boas-vindas nas duas únicas contas reais). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0321_rollback.sql.
-- NÃO envia e-mail. Para (exceção) e não grava nada se as duas contas não conferirem por e-mail e papel.
begin;
set local lock_timeout = '5s';

do $$
declare
  existentes integer;
  achadas integer;
begin
  -- Banco sem nenhuma das duas contas (laboratório, CI, banco novo): não há o que marcar. Avisa e segue, sem gravar.
  select count(*) into existentes
    from public.profiles p
   where lower(p.email) in ('fatima.alves.campanha@gmail.com', 'lyamercaldi@gmail.com');
  if existentes = 0 then
    raise notice 'E287: nenhuma das duas contas existe neste banco — nada a marcar (laboratório ou banco novo)';
    return;
  end if;

  -- Alguma existe: então as DUAS têm de conferir por e-mail e papel; se não, PARA (exceção) e não grava nada.
  select count(*) into achadas
    from public.profiles p
   where p.is_teste is not true
     and ((lower(p.email) = 'fatima.alves.campanha@gmail.com' and p.role = 'owner')
       or (lower(p.email) = 'lyamercaldi@gmail.com' and p.role = 'tenant'));
  if achadas <> 2 then
    raise exception 'E287: esperava 2 contas reais (Maria de Fátima, proprietária; Lya Raquel, inquilina) e achei % — nada foi gravado', achadas;
  end if;

  insert into public.automacoes_envios (chave, tipo, usuario_id)
  select 'boas_vindas:' || p.id::text, 'boas_vindas', p.id
    from public.profiles p
   where p.is_teste is not true
     and ((lower(p.email) = 'fatima.alves.campanha@gmail.com' and p.role = 'owner')
       or (lower(p.email) = 'lyamercaldi@gmail.com' and p.role = 'tenant'))
  on conflict (chave) do nothing;
end $$;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261107000321', '0321_marca_boas_vindas_pioneiras_e287', array['-- conteúdo em supabase/migrations/0321_marca_boas_vindas_pioneiras_e287.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261107000321');

commit;
