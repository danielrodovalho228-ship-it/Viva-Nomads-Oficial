-- Cartão "Por que estou na cidade" (ordem 9950ef15, item 3): período, empresa/instituição e frase curta.
-- A categoria (professional_category) e o motivo (motivo_estadia) já existem. Sem diagnóstico: texto livre curto,
-- filtrado de contato no servidor. Antes do aceite o proprietário NÃO lê estes campos (só categoria, selos e avaliações).
alter table public.profiles add column if not exists cidade_periodo_inicio date;
alter table public.profiles add column if not exists cidade_periodo_fim date;
alter table public.profiles add column if not exists cidade_empresa text;
alter table public.profiles add column if not exists cidade_frase text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_cidade_porque_chk') then
    alter table public.profiles add constraint profiles_cidade_porque_chk
      check (
        (cidade_empresa is null or char_length(cidade_empresa) <= 60)
        and (cidade_frase is null or char_length(cidade_frase) <= 140)
        and (cidade_periodo_inicio is null or cidade_periodo_fim is null or cidade_periodo_fim >= cidade_periodo_inicio)
      );
  end if;
end $$;

grant update (cidade_periodo_inicio, cidade_periodo_fim, cidade_empresa, cidade_frase) on public.profiles to authenticated;
