-- Rollback da 0321 (E287). Remove SÓ as duas marcas de boas-vindas das contas das pioneiras (pelo e-mail e papel) e desregistra.
-- Atenção: depois de remover, o boas-vindas automático volta a poder ser enviado para essas duas contas.
begin;
delete from public.automacoes_envios a
 using public.profiles p
 where a.chave = 'boas_vindas:' || p.id::text
   and a.tipo = 'boas_vindas'
   and p.is_teste is not true
   and ((lower(p.email) = 'fatima.alves.campanha@gmail.com' and p.role = 'owner')
     or (lower(p.email) = 'lyamercaldi@gmail.com' and p.role = 'tenant'));
delete from supabase_migrations.schema_migrations where version = '20261107000321';
commit;
