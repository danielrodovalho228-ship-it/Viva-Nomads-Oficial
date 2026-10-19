-- Rollback da 0189: devolve a política ao role public (como a 0184 a criou).
begin;
alter policy "dono gerencia seus ignorados" on public.pedidos_ignorados to public;
delete from supabase_migrations.schema_migrations where version = '20261019000189';
commit;
