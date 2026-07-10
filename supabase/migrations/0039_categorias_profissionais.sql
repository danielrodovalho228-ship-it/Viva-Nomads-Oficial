-- ══════════════════════════════════════════════════════════════════════════
-- Categorias profissionais — expansão do select (fonte única em
-- config/categorias-profissionais.ts). A coluna profiles.professional_category
-- já existe; aqui só migramos os VALORES antigos (5 rótulos livres) para as
-- novas keys estáveis.
--
-- DE-PARA (mostrado antes de aplicar, conforme combinado):
--   'Médico / saúde'          → 'saude_outros'         (Outros profissionais de saúde)
--   'Executivo / corporativo' → 'trabalho_realocacao'  (Realocação/transferência)
--   'Nômade digital / remoto' → 'trabalho_remoto'      (Trabalho remoto/nômade digital)
--   'Estudante / intercâmbio' → 'educacao_graduacao'   (Estudante de graduação)
--   'Outro'                   → 'outro:'               (Outro, sem texto livre)
--
-- Idempotente: só toca linhas cujo valor é um dos 5 rótulos antigos. Rodar de
-- novo não faz nada (os valores já viraram keys). Valores nulos ou já-novos
-- ficam intactos.
-- ══════════════════════════════════════════════════════════════════════════

update public.profiles
set professional_category = case professional_category
    when 'Médico / saúde'          then 'saude_outros'
    when 'Executivo / corporativo' then 'trabalho_realocacao'
    when 'Nômade digital / remoto' then 'trabalho_remoto'
    when 'Estudante / intercâmbio' then 'educacao_graduacao'
    when 'Outro'                   then 'outro:'
    else professional_category
  end
where professional_category in (
  'Médico / saúde',
  'Executivo / corporativo',
  'Nômade digital / remoto',
  'Estudante / intercâmbio',
  'Outro'
);
