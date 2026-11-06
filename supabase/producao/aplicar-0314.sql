-- Viva Nomads — aplicar 0314 (E647: forma de pagamento da proposta, escolhida pelo dono). Idempotente.
-- Aplicada pela Action quando o PR é mesclado. Rollback: supabase/producao/rollback/0314_rollback.sql.
begin;
set local lock_timeout = '5s';

alter table public.proposta_versoes
  add column if not exists forma_pagamento text;
alter table public.proposta_versoes drop constraint if exists proposta_versoes_forma_pagamento;
alter table public.proposta_versoes add constraint proposta_versoes_forma_pagamento
  check (forma_pagamento is null or forma_pagamento in ('bloco', 'mensal'));

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '20261106000314', '0314_proposta_forma_pagamento_e647', array['-- conteúdo em supabase/migrations/0314_proposta_forma_pagamento_e647.sql'], 'danielrodovalho228@gmail.com'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261106000314');

commit;
