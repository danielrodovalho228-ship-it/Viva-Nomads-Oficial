-- E629 (rodada 10, 05/11): o cartão "[TESTE QA NÍVEL] Premium" mostrava o selo Essencial. O selo lê o nível COMPUTADO e o motor
-- está certo: neste anúncio todas as áreas estão em Premium (Sono, Banho, Clima, Cozinha, Sala, Lavanderia, Ruído) menos
-- Internet (Essencial: só há uma medição, do quarto principal, inválida) e Trabalho (Conforto: falta a medição do ponto de
-- trabalho e a videochamada). Pelo elo mais fraco, o nível é Essencial. Era o NOME da massa que prometia mais do que o anúncio
-- tem. Aqui o título passa a dizer a verdade; nada do nível, das provas ou das medições muda. Só renomeia se o título ainda for
-- o antigo (idempotente).
update public.properties
   set title = '[TESTE QA NÍVEL] Essencial (falta medir a internet para chegar a Premium)'
 where id = '330ebf37-fca4-4f8a-88d9-47614bc56674'
   and owner_id = '7216d0e9-6246-482a-a1de-524fd5231dc2'
   and title = '[TESTE QA NÍVEL] Premium';
