-- 0369 (E1238, ORDENS-DUET 1207, 1231 e 1233 do Gerente, 27/11/2026): o prazo da janela de 48 h da conferência fica
-- GRAVADO na própria conferência. congelarJanelaDeConferencia (src/lib/data/janela-conferencia.ts) grava-o no momento
-- em que a linha nasce (na primeira escrita, nos quatro pontos de abertura) e depois nunca mais o muda: editar a hora
-- das instruções de entrada não mexe num prazo já aberto.
-- O que NÃO faz: não grava, apaga nem muda conferência nenhuma ao aplicar. As linhas que já existem ficam com a coluna
-- vazia: as já fechadas ficam como estão (nada reabre); as abertas sem prazo calculam pela mesma regra. Sem dado pessoal.
alter table public.conferencias add column if not exists prazo_em timestamptz default now();
comment on column public.conferencias.prazo_em is 'E1238: o fim da janela de 48 h, gravado quando a conferência nasce (a hora das instruções de entrada nesse momento). Vazio nas conferências de antes da 0369.';
