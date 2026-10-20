-- Viva Nomads — 0169: telefone opcional do visitante no chamado (ordem 8e720f03, F24).
-- Só a equipe lê (RLS de chamados já restringe visitante à equipe). Só dígitos, 10 a 13.
alter table public.chamados add column if not exists visitante_telefone text;
alter table public.chamados drop constraint if exists chamados_visitante_telefone_formato;
alter table public.chamados add constraint chamados_visitante_telefone_formato
  check (visitante_telefone is null or visitante_telefone ~ '^[0-9]{10,13}$');
