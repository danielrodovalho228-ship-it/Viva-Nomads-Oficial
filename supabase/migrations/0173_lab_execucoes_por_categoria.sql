-- 0173 — lab_execucoes.por_categoria (ordem 35527eb1, achado do Moacir: o boletim por categoria era agrupado à mão).
-- Guarda o resumo de cobertura por tipo (páginas / rotas / actions) de cada execução. Só contagens, sem dados pessoais.
-- Idempotente. A RLS da 0106 continua valendo (só admin lê; ninguém escreve pela API).
alter table public.lab_execucoes add column if not exists por_categoria jsonb not null default '{}'::jsonb;
comment on column public.lab_execucoes.por_categoria is 'Cobertura por tipo (paginas/rotas/actions) da execução: {total,cobertos,percentual,por_tipo}.';
