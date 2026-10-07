-- Asserções do banco (laboratório noturno, depois das migrações). Falha = noite vermelha.
-- Cada bloco diz o que voltou ao estado errado. Sem NOTICE.
do $$
declare
  n int;
begin
  -- 0084/4: nenhuma extensão no schema public.
  select count(*) into n from pg_extension where extnamespace = 'public'::regnamespace;
  if n > 0 then raise exception 'extensão no schema public (%)', (select string_agg(extname, ', ') from pg_extension where extnamespace = 'public'::regnamespace); end if;

  -- 0084/2: anon não executa as funções internas.
  select count(*) into n from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('is_admin', 'pode_ver_contrato', 'pedido_ativo', 'pedido_inquilino')
     and has_function_privilege('anon', p.oid, 'EXECUTE');
  if n > 0 then raise exception 'anon executa função interna (is_admin/pode_ver_contrato/pedido_ativo/pedido_inquilino)'; end if;

  -- 0084/2: política de role public chamando essas funções derruba a leitura pública.
  select count(*) into n from pg_policies
   where roles = array['public']::name[]
     and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(is_admin|pode_ver_contrato|pedido_ativo|pedido_inquilino)\(';
  if n > 0 then raise exception '% política(s) de role public chamam função interna: use "to authenticated"', n; end if;
end;
$$;
