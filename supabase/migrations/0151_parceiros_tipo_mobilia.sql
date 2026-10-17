-- 0151 — Parceiros: novo tipo "mobilia" (Mobília, enxoval e mudança) no formulário "Quero ser parceiro"
-- (prompt 14). O cartão "Serviços para o imóvel" virou dois: "Limpeza e manutenção" (servicos) e
-- "Mobília, enxoval e mudança" (mobilia). Só amplia a lista aceita pela checagem da 0104.
-- Rollback: supabase/producao/rollback/0151_rollback.sql.

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.parceiros_interesse'::regclass
       and conname = 'parceiros_interesse_tipo_check'
       and pg_get_constraintdef(oid) like '%mobilia%'
  ) then
    alter table public.parceiros_interesse drop constraint if exists parceiros_interesse_tipo_check;
    alter table public.parceiros_interesse add constraint parceiros_interesse_tipo_check
      check (tipo in ('fotografo', 'empresa', 'gestor', 'servicos', 'mobilia', 'seguros'));
  end if;
end $$;
