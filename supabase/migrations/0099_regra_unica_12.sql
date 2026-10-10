-- 0099 — REGRA ÚNICA DE COBRANÇA: 12% do primeiro aluguel de cada contrato novo E de cada renovação (ordem eaa5adce, Daniel 10/10).
--   • config_cobranca: taxa_comissao=12 e taxa_renovacao=12 (em %, fonte única da taxa).
--   • faixas_comissao: fica um degrau só (1+ imóveis, 12%); os degraus por volume deixam de existir. Nenhuma tela lê esta tabela ainda.
--   • contratos.tipo_cobranca: 'novo' | 'renovacao' (substitui a ideia de 'extensao' do PR #353, que deve ser fechado sem mesclar).
-- Sem dado pessoal. Idempotente. Quem está em plano pago mantém as condições até o fim do ciclo (tratado no app, não aqui).

insert into public.config_cobranca (chave, valor) values
  ('taxa_comissao', '12'),
  ('taxa_renovacao', '12')
on conflict (chave) do nothing;

-- Remove só os degraus por volume; o de 1 imóvel vira "sem teto, 12%".
delete from public.faixas_comissao where min_imoveis > 1;
update public.faixas_comissao set max_imoveis = null, taxa = 0.12 where min_imoveis = 1;
insert into public.faixas_comissao (min_imoveis, max_imoveis, taxa) values (1, null, 0.12)
on conflict (min_imoveis) do nothing;

alter table public.contratos add column if not exists tipo_cobranca text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contratos_tipo_cobranca_check') then
    alter table public.contratos add constraint contratos_tipo_cobranca_check
      check (tipo_cobranca is null or tipo_cobranca in ('novo', 'renovacao')) not valid;
  end if;
end;
$$;
