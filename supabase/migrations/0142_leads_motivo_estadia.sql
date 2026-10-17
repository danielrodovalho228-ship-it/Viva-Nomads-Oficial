-- Motivo da estadia na candidatura (ordem a8bb8cfa/9a723929): foto do motivo no momento do envio.
-- Guarda só a CHAVE da lista única de src/lib/pedidos/pedidos.ts (sem texto livre nem diagnóstico).
-- Leitura só pelo servidor (o SELECT de leads é por coluna e esta não é liberada ao navegador).
alter table public.leads add column if not exists motivo_estadia text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_motivo_estadia_chk') then
    alter table public.leads add constraint leads_motivo_estadia_chk
      check (motivo_estadia is null or motivo_estadia in (
        'trabalho_remoto','tratamento_medico','relocacao_corporativa','intercambio_pos',
        'reforma_transicao','mudanca_familiar','aposentadoria_lifestyle','viagem_longa','outro'));
  end if;
end $$;
comment on column public.leads.motivo_estadia is 'Chave do motivo da estadia informado na candidatura (lista MOTIVOS). Opcional.';
