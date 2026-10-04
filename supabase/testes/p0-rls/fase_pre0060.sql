-- Estado antigo para a migração de dados da 0060: dono2 (5555) tem 1 imóvel e
-- um checklist SEM imóvel (como o código antigo gravava).
reset role;
insert into qualification_checklists(id,owner_id,document_path,document_status,ready_to_live_score,ready_to_live_badge)
values ('99999999-0000-0000-0000-000000000055','55555555-5555-5555-5555-555555555555','doc/q.pdf','approved',75,true);
-- Imóveis 2 e 4 voltam a rascunho (fases anteriores os publicaram) para testar
-- a publicação por imóvel.
update properties set status='draft' where id in ('aaaaaaa2-0000-0000-0000-000000000002','aaaaaaa4-0000-0000-0000-000000000004');
