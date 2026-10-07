-- Central de Agentes — rotina do Moacir (boletim diário do gerente).
-- Só dados (uma linha da tabela agentes); nenhum comando gera NOTICE.
-- Desfazer: rotina_texto = 'Sempre ativo no Cowork · relatório 9h Texas', trigger_id = null.
update public.agentes
   set rotina_texto = 'Todo dia 08:07 Texas (boletim do gerente)',
       trigger_id = 'trig_01HrFips4pxDaLedy8y9QfZz'
 where slug = 'moacir';

select slug, status, rotina_texto, trigger_id from public.agentes where slug = 'moacir';
