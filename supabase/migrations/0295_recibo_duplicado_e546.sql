-- E546 — recibos em duplicidade (19/10, contas de teste): REC-2026-000004 e REC-2026-000005 têm a mesma data, imóvel,
-- morador e R$ 6.400 e os dois somavam no resumo do mês (R$ 12.800). São dois pagamentos do 1º bloco da MESMA estadia
-- em dois contratos: o CT-D9C70197 (encerrado às 05:02, refeito como CT-11281A61) e o CT-11281A61. O REC-2026-000005 é o
-- do contrato encerrado e foi emitido às 05:10, depois do encerramento. Tratado como a caução gêmea CAU-2026-000002
-- (0182): fica o registro do contrato vigente; o pagamento, o documento fiscal e o registro do REC-2026-000005 são
-- ANULADOS com o motivo "registro em duplicidade". Nada é apagado. Só toca contas de teste (dono is_teste); em conta real
-- não faz nada. A guarda para a emissão não duplicar está no código (fiscal/emitir.ts, duplicidadeDeRecibo).

with alvo as (
  select d.id as doc_id, d.pagamento_id
    from public.documentos_fiscais d
    join public.profiles pr on pr.id = d.owner_id and pr.is_teste
   where d.numero = 'REC-2026-000005' and d.anulado_em is null
)
update public.pagamentos_bloco p
   set anulado_em = now(), anulado_motivo = 'registro em duplicidade'
  from alvo
 where p.id = alvo.pagamento_id and p.anulado_em is null;

update public.documentos_fiscais d
   set anulado_em = now(), anulado_motivo = 'registro em duplicidade'
  from public.profiles pr
 where d.numero = 'REC-2026-000005' and d.anulado_em is null and pr.id = d.owner_id and pr.is_teste;

update public.documentos_registro r
   set status = 'anulado', anulado_motivo = 'registro em duplicidade', status_em = now()
 where r.numero = 'REC-2026-000005' and r.status = 'valido' and r.is_teste;
