-- 0258 (E202 candidatura): a SAÍDA que o morador escolheu na candidatura. Antes só a entrada ia a leads.inicio_desejado
-- e a saída seguia numa linha da mensagem: os e-mails da candidatura não tinham o período e o Fechamento abria em
-- 4 meses. Como inicio_desejado, a coluna NÃO entra no SELECT por coluna de leads (0062): só o servidor lê.
alter table public.leads add column if not exists fim_desejado date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_fim_desejado_chk') then
    alter table public.leads add constraint leads_fim_desejado_chk
      check (fim_desejado is null or (inicio_desejado is not null and fim_desejado > inicio_desejado));
  end if;
end $$;
comment on column public.leads.fim_desejado is 'Data de saída desejada, informada na candidatura (depois da entrada). Opcional; os e-mails e o Fechamento usam o período.';
