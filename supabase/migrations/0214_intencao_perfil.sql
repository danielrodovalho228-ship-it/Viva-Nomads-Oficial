-- Prompt 49 — intenção como camada: o que a pessoa veio fazer (morar | anunciar | servicos), multi-escolha.
-- NÃO é papel nem permissão: define o painel inicial e o checklist (Prompt 50). null = ainda não respondeu
-- (conta nova vê a pergunta depois do 1º código); '{}' = respondeu "Agora não". A pessoa só altera a PRÓPRIA
-- linha (update da coluna liberado + RLS "perfil próprio: atualiza" de profiles).
alter table public.profiles add column if not exists intencao text[];

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_intencao_chk') then
    alter table public.profiles add constraint profiles_intencao_chk
      check (intencao is null or intencao <@ array['morar', 'anunciar', 'servicos']::text[]);
  end if;
end $$;

grant update (intencao) on public.profiles to authenticated;
