-- ROLLBACK da 0076 (garantia única). Volta a função de blocos da 0063 e remove
-- a coluna contratos.garantia (perde a escolha gravada).
begin;
drop trigger if exists trg_pagamentos_bloco_garantia on public.pagamentos_bloco;
drop function if exists public.pagamentos_bloco_garantia();
drop trigger if exists trg_contratos_garantia_unica on public.contratos;
drop function if exists public.contratos_garantia_unica();
do $c$ begin
  if to_regclass('public.locacoes') is not null then
    alter table public.locacoes drop constraint if exists locacoes_garantia_unica;
  end if;
end $c$;
create or replace function public.contrato_blocos_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aluguel numeric;
  dias_total int;
  caucao_total numeric;
begin
  -- Bloco além do 1º só entra em vigor com os DOIS aceites.
  if coalesce(new.numero_bloco, 1) > 1
     and new.status in ('agendado', 'ativo')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and (new.aceite_proprietario_em is null or new.aceite_inquilino_em is null)
  then
    raise exception 'Renovação precisa do aceite do proprietário e do inquilino.' using errcode = '23514';
  end if;

  select c.aluguel_mensal into aluguel from public.contratos c where c.id = new.contrato_id;

  -- Soma do contrato (sem os não aceitos), contando esta linha como ficará.
  select coalesce(sum(b.fim - b.inicio + 1), 0), coalesce(sum(b.caucao), 0)
    into dias_total, caucao_total
    from public.contrato_blocos b
   where b.contrato_id = new.contrato_id
     and b.status <> 'nao_aceito'
     and b.id is distinct from new.id;
  if new.status <> 'nao_aceito' then
    dias_total := dias_total + coalesce(new.fim - new.inicio + 1, 0);
    caucao_total := caucao_total + coalesce(new.caucao, 0);
  end if;

  if dias_total > 180 then
    raise exception 'O contrato passaria de 180 dias. Para continuar, é preciso um novo contrato.' using errcode = '23514';
  end if;
  if aluguel is not null and aluguel > 0 and caucao_total > aluguel * 3 then
    raise exception 'A caução total do contrato não pode passar de 3 aluguéis (art. 38 §2º da Lei 8.245/91).' using errcode = '23514';
  end if;
  return new;
end;
$$;
alter table public.contratos drop constraint if exists contratos_garantia_valida;
alter table public.contratos drop column if exists garantia;
commit;
