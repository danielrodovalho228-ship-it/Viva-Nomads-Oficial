-- Rollback da 0075: volta a varredura da 0073 (só 1ª resposta) e remove a função de cálculo.
begin;
create or replace function public.atendimento_varrer_prazos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update chamados c
     set sla_estado = case
           when now() >= c.prazo_primeira_resposta then 'estourado'
           when now() - c.criado_em >= 0.75 * (c.prazo_primeira_resposta - c.criado_em) then 'em_risco'
           else 'ok' end,
         atualizado_em = now()
   where c.primeira_resposta_em is null
     and c.status not in ('resolvido', 'encerrado')
     and c.sla_estado is distinct from (case
           when now() >= c.prazo_primeira_resposta then 'estourado'
           when now() - c.criado_em >= 0.75 * (c.prazo_primeira_resposta - c.criado_em) then 'em_risco'
           else 'ok' end);
  select count(*) into n from chamados
   where simulacao = false and primeira_resposta_em is null and status not in ('resolvido', 'encerrado')
     and prioridade in ('p1', 'p2') and sla_estado in ('em_risco', 'estourado')
     and (alerta_enviado_em is null or alerta_enviado_em < now() - interval '1 hour');
  return n;
end;
$$;
revoke all on function public.atendimento_varrer_prazos() from public, anon, authenticated;
grant execute on function public.atendimento_varrer_prazos() to service_role;
drop function if exists public.atendimento_sla_calculado(public.chamados, timestamptz);
commit;
