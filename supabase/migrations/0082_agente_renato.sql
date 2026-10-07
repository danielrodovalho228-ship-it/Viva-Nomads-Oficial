-- 0082 — Agente Renato (engenheiro) na Central de Agentes. Só INSERT, sem NOTICE;
-- reaplicar é seguro (on conflict do nothing). Rotina: trig_01RFS85WLF1FsNhXB8zzEdbq.

insert into public.agentes (slug, nome, cargo, esquadrao, rotina_texto, trigger_id, status, ordem, briefing)
values ('renato', 'Renato', 'Engenheiro', 'tecnologia', 'Todo dia 06:57 Brasília', 'trig_01RFS85WLF1FsNhXB8zzEdbq', 'ativo', 17,
        'Engenheiro. Pega as ordens do Daniel e o pacote do Otávio, corrige com testes e abre um PR por dia. Nunca mescla nem aplica migração.')
on conflict (slug) do nothing;
