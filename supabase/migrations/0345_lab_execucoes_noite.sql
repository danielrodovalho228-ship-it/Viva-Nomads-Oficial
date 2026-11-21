-- E744, T4 (plano de 17/11/2026): cada rodada do laboratório grava se foi uma NOITE VERDE e os números por classe.
-- Verde = a completude fecha, zero falhas fora de "conhecida" e de "quarentena", zero instáveis fora de "quarentena".
--   noite = { estado: "verde" | "vermelha", motivos: [texto], sequencia: noites agendadas verdes seguidas,
--             classes: { falhou, conhecida, quarentena, instavel, sem_disposicao },
--             conhecidas_por_item: { "E975": 1 }, specs_sem_disposicao: [spec],
--             quarentena: { tamanho, vencidas, candidatas, nao_rodaram } }
-- Só contagens, itens e nomes de specs; nenhum dado pessoal. Linhas antigas ficam com null (não se sabe o estado delas).
-- Só leitura do admin, como o resto da tabela (0106); ninguém escreve pela API.
alter table public.lab_execucoes add column if not exists noite jsonb;
comment on column public.lab_execucoes.noite is 'Estado da rodada (verde/vermelha), motivos, sequência de noites verdes e números por classe (E744, T4).';
