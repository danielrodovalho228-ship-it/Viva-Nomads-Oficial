-- ROLLBACK da 0068: NÃO volte para a versão da 0063 (ela libera qualquer
-- usuário). Se precisar desfazer, tire a função do alcance da API:
begin;
revoke execute on function public.marcar_fundador(uuid) from authenticated;
commit;
