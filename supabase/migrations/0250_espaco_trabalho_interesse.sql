-- Medir interesse em espaços de trabalho (ordem 286312f8, P3): só duas respostas opcionais no perfil, sem anúncio de sala.
-- Sem dado pessoal além da escolha em lista fechada; cada pessoa grava só o próprio perfil (RLS de profiles já existente).
alter table public.profiles add column if not exists espaco_trabalho_oferta text;
alter table public.profiles add column if not exists espaco_trabalho_procura text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_espaco_trabalho_chk') then
    alter table public.profiles add constraint profiles_espaco_trabalho_chk
      check (
        (espaco_trabalho_oferta is null or espaco_trabalho_oferta in ('nao', 'sala', 'consultorio', 'clinica', 'outro'))
        and (espaco_trabalho_procura is null or espaco_trabalho_procura in ('nao', 'coworking', 'sala_consultorio'))
      );
  end if;
end $$;

grant update (espaco_trabalho_oferta, espaco_trabalho_procura) on public.profiles to authenticated;
