-- 0098 — EXTENSÃO/RENOVAÇÃO PAGA 6% (ordem 9d7b98a7 do Daniel, 09/10; parte 2 da cobrança). PRECISA APROVAÇÃO DO DANIEL.
--   • config_cobranca ganha taxa_extensao=6 (percentual da extensão fora do código).
--   • contratos ganha tipo_cobranca ('novo' | 'extensao'), nulo nos antigos.
-- Só cria; idempotente; sem DROP; sem dado pessoal.

insert into public.config_cobranca (chave, valor) values ('taxa_extensao', '6')
on conflict (chave) do nothing;

alter table public.contratos add column if not exists tipo_cobranca text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_tipo_cobranca_check') then
    alter table public.contratos add constraint contratos_tipo_cobranca_check
      check (tipo_cobranca is null or tipo_cobranca in ('novo', 'extensao')) not valid;
  end if;
end;
$$;
