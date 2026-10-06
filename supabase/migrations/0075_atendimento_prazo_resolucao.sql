-- 0075 — Atendimento: prazo depois da 1ª resposta (QA 06/out, VN-000100).
--
-- Antes, a varredura só olhava chamados SEM 1ª resposta: um chamado marcado
-- "em risco" e respondido no prazo ficava "em risco" para sempre, e o prazo de
-- RESOLUÇÃO não era acompanhado. Agora a mesma regra vale para todos (espelho
-- de slaDoChamado em src/config/atendimento.ts):
--   • sem 1ª resposta: relógio da 1ª resposta (≥ 75% do tempo = em risco);
--   • 1ª resposta fora do prazo: estourado (fica registrado);
--   • respondido no prazo: relógio do prazo de resolução;
--   • resolvido/encerrado: ok se cumpriu os dois prazos, senão estourado.
-- Os chamados já gravados se corrigem na primeira varredura (a cada 15 min).
-- Os alertas por e-mail continuam só para P1/P2 sem 1ª resposta.
-- Reaplicar é seguro (create or replace).

create or replace function public.atendimento_sla_calculado(c public.chamados, agora timestamptz default now())
returns text
language sql
stable
set search_path = public
as $$
  select case
    when c.status in ('resolvido', 'encerrado') then
      case when coalesce(c.primeira_resposta_em, c.resolvido_em, agora) <= c.prazo_primeira_resposta
             and coalesce(c.resolvido_em, c.encerrado_em, agora) <= c.prazo_resolucao
           then 'ok' else 'estourado' end
    when c.primeira_resposta_em is null then
      case when agora >= c.prazo_primeira_resposta then 'estourado'
           when agora - c.criado_em >= 0.75 * (c.prazo_primeira_resposta - c.criado_em) then 'em_risco'
           else 'ok' end
    when c.primeira_resposta_em > c.prazo_primeira_resposta then 'estourado'
    when agora >= c.prazo_resolucao then 'estourado'
    when agora - c.criado_em >= 0.75 * (c.prazo_resolucao - c.criado_em) then 'em_risco'
    else 'ok'
  end
$$;
revoke all on function public.atendimento_sla_calculado(public.chamados, timestamptz) from public, anon, authenticated;
grant execute on function public.atendimento_sla_calculado(public.chamados, timestamptz) to service_role;

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
     set sla_estado = public.atendimento_sla_calculado(c),
         atualizado_em = now()
   where c.sla_estado is distinct from public.atendimento_sla_calculado(c)
     and (c.status not in ('resolvido', 'encerrado') or c.sla_estado = 'em_risco');
  select count(*) into n from chamados
   where simulacao = false and primeira_resposta_em is null and status not in ('resolvido', 'encerrado')
     and prioridade in ('p1', 'p2') and sla_estado in ('em_risco', 'estourado')
     and (alerta_enviado_em is null or alerta_enviado_em < now() - interval '1 hour');
  return n;
end;
$$;
revoke all on function public.atendimento_varrer_prazos() from public, anon, authenticated;
grant execute on function public.atendimento_varrer_prazos() to service_role;
