-- 0101 — CNPJ ÚNICO POR CONTA (ordem 0cb385f5, teste de cadastro: "CNPJ/CPF duplicado").
-- O CPF já tinha índice único (0090, profiles_cpf_unico); o CNPJ não: duas contas podiam usar a mesma empresa.
-- Segurança de rodar no merge: se JÁ existir CNPJ repetido em produção, o índice NÃO é criado (nada quebra) e a
-- migração só avisa; a equipe resolve os repetidos e roda de novo. Sem dado pessoal. Idempotente.
do $$
begin
  if exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_cnpj_unico') then
    return;
  end if;
  if exists (select 1 from public.profiles where cnpj is not null group by cnpj having count(*) > 1) then
    raise warning '0101: há CNPJ repetido em profiles; índice profiles_cnpj_unico NÃO criado.';
    return;
  end if;
  create unique index profiles_cnpj_unico on public.profiles (cnpj) where cnpj is not null;
end;
$$;
