-- E603: o autosave do rascunho não gravava os quartos na coluna (só no draft_data): a listagem de Meus imóveis mostrava 0 num
-- rascunho de 2 quartos. O código passou a gravar; aqui os rascunhos antigos recebem o valor que já está no draft_data.
-- Só rascunho, só onde a coluna está em 0 e o draft_data tem um inteiro positivo. Idempotente.
update public.properties
   set bedrooms = least((draft_data ->> 'bedrooms')::int, 50)
 where status = 'draft'
   and coalesce(bedrooms, 0) = 0
   and draft_data ->> 'bedrooms' ~ '^[0-9]{1,2}$'
   and (draft_data ->> 'bedrooms')::int > 0;
