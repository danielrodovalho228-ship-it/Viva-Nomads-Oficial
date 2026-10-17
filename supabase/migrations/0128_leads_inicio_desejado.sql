-- F37 (ordem c4530769): data em que o inquilino quer entrar, informada na candidatura (opcional).
-- O Fechamento do dono já abre com ela preenchida; o servidor revalida na hora de gravar o contrato.
alter table public.leads add column if not exists inicio_desejado date;
comment on column public.leads.inicio_desejado is 'Data de entrada desejada, informada pelo inquilino na candidatura. Opcional; só sugere a data do Fechamento.';
