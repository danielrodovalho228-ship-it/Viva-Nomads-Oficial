-- 0346 (E614, ORDEM-DUET-137/139/140 do Gerente, 18/11/2026): properties ganha `updated_at`, a hora da última gravação
-- da linha, mantida por gatilho.
--
-- Para quê: o rascunho retomado mostra "Salvo às HH:MM". A hora vem do carimbo `salvoEm` do draft_data; quando o
-- rascunho não tem carimbo (os anteriores à regra, ou gravados por outro caminho), o recurso é esta coluna.
--
-- O que NÃO faz: não preenche as linhas que já existem (nenhuma linha é regravada, nenhum outro gatilho dispara). Nelas
-- `updated_at` fica nulo até a próxima gravação; enquanto isso a tela usa a hora da criação (`created_at`), que é a
-- única gravação de que há registo. Linha nova nasce com a hora da criação. Sem dado pessoal.
alter table public.properties add column if not exists updated_at timestamptz;
alter table public.properties alter column updated_at set default now();

comment on column public.properties.updated_at is 'E614: hora da última gravação da linha (gatilho properties_updated_at). null = linha anterior à 0346 que ainda não foi regravada.';

create or replace function public.properties_carimbar_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  -- Quem grava a hora de propósito é respeitado; em qualquer outra gravação, a hora é a de agora.
  if new.updated_at is not distinct from old.updated_at then
    new.updated_at := now();
  end if;
  return new;
end;
$function$;

drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at
  before update on public.properties
  for each row execute function public.properties_carimbar_updated_at();

-- properties tem grants de coluna (0053): a coluna nova precisa de grant para o dono ler a hora do rascunho; como a
-- 0316, vai também para anon, para nenhuma leitura pública da tabela passar a falhar.
grant select (updated_at) on public.properties to anon, authenticated;
