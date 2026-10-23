-- 0222 — PAPEL-B: papel ativo com fonte única (Prompt 41, item 2). profiles.papel_ativo guarda o papel que a pessoa
-- escolheu usar (morador | proprietario | parceiro); null = derivar do modo, como antes. Só decide o menu e o painel que
-- aparecem primeiro (conta única, 14/10): nunca permissão. A pessoa só altera a PRÓPRIA linha (update da coluna
-- liberado + RLS "perfil próprio: atualiza" de profiles). Idempotente.
alter table public.profiles add column if not exists papel_ativo text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_papel_ativo_chk') then
    alter table public.profiles add constraint profiles_papel_ativo_chk
      check (papel_ativo is null or papel_ativo in ('morador', 'proprietario', 'parceiro'));
  end if;
end $$;

grant update (papel_ativo) on public.profiles to authenticated;
