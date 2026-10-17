-- Motivo da estadia no perfil do inquilino (ordem a8bb8cfa): pré-preenche pedidos novos.
-- Guarda só a CHAVE da lista única de src/lib/pedidos/pedidos.ts (nunca texto livre nem diagnóstico).
-- A pessoa só altera a PRÓPRIA linha (update de coluna liberado + RLS de profiles já existente).
alter table public.profiles add column if not exists motivo_estadia text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_motivo_estadia_chk') then
    alter table public.profiles add constraint profiles_motivo_estadia_chk
      check (motivo_estadia is null or motivo_estadia in (
        'trabalho_remoto','tratamento_medico','relocacao_corporativa','intercambio_pos',
        'reforma_transicao','mudanca_familiar','aposentadoria_lifestyle','viagem_longa','outro'));
  end if;
end $$;

grant update (motivo_estadia) on public.profiles to authenticated;
