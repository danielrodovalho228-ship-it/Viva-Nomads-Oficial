-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICAÇÃO (SÓ LEITURA) do estado das migrações no banco ALVO. Cole no SQL
-- editor do Supabase de PRODUÇÃO e rode. Não altera nada.
--
-- Alternativa automatizada (recomendada): npm run check:migracoes
-- ═══════════════════════════════════════════════════════════════════════════

-- 1) Colunas de moderação/conferência (0042 + 0044). Esperado: 6 linhas.
--    Se vier VAZIO ou incompleto → o furo está VIVO: aplique aplicar-piloto.sql.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'qualification_checklists'
  and column_name in (
    'document_status', 'document_review_reason', 'document_reviewed_at',
    'document_reviewed_by', 'document_hash_sha256', 'document_uploaded_at'
  )
order by column_name;

-- 2) Políticas RLS de admin sobre a fila (0042). Esperado: 2 (lê + modera).
select policyname
from pg_policies
where schemaname = 'public'
  and tablename = 'qualification_checklists'
  and policyname in ('qualif: admin lê', 'qualif: admin modera');

-- 3) Migrações do #212. Esperado: leads.accepted_commission_rate,
--    profiles.account_type e a tabela account_type_audit.
select 'leads.accepted_commission_rate' as marca,
       to_regclass('public.leads') is not null
       and exists (select 1 from information_schema.columns
                   where table_name='leads' and column_name='accepted_commission_rate') as existe
union all
select 'profiles.account_type',
       exists (select 1 from information_schema.columns
               where table_name='profiles' and column_name='account_type')
union all
select 'tabela account_type_audit', to_regclass('public.account_type_audit') is not null;

-- 4) Estado da fila (sanidade): quantos documentos em cada status.
select coalesce(document_status, 'none') as status, count(*)
from public.qualification_checklists
group by 1
order by 1;
