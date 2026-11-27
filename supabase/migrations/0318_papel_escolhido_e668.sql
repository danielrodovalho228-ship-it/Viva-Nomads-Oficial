-- E668 — o papel "parceiro" só vale como papel gravado se foi ESCOLHIDO (selo do topo ou Conta). Antes do E653 a área do
-- parceiro gravava profiles.papel_ativo = 'parceiro' sozinha, sem clique, e esse valor antigo fazia o morador (que também tem
-- parceria) abrir a casca em "Áreas do parceiro". A coluna guarda QUANDO a escolha foi feita; sem ela, o valor antigo não vale.
-- Só uma coluna nula nova: nada é lido, apagado nem regravado. A pessoa só altera a PRÓPRIA linha (RLS de profiles).
alter table public.profiles add column if not exists papel_ativo_escolhido_em timestamptz;

comment on column public.profiles.papel_ativo_escolhido_em is
  'E668: quando a pessoa escolheu o papel ativo (selo/Conta). papel_ativo = parceiro sem este carimbo é valor antigo gravado pela área e não vale.';

grant update (papel_ativo_escolhido_em) on public.profiles to authenticated;
