-- Leads: faltava a policy de INSERT, então a RLS bloqueava TODO o funil — nenhum
-- inquilino conseguia registrar interesse. Permite que o inquilino crie o próprio
-- lead (tenant_id = auth.uid()). O dono continua lendo pela policy "leads das partes".
--
-- Observação: imóveis DEMO (ids textuais, fora da tabela properties) não geram
-- linha em leads — o aviso ao proprietário sai por e-mail/WhatsApp. Esta policy
-- vale para imóveis REAIS (id uuid), que têm linha em properties.
drop policy if exists "inquilino cria lead" on leads;
create policy "inquilino cria lead" on leads
  for insert with check (tenant_id = auth.uid());
