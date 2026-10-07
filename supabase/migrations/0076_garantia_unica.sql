-- 0076 — Garantia ÚNICA por contrato (G1). Lei 8.245/91, art. 37, parágrafo
-- único: uma só modalidade de garantia por locação; exigir duas é nulo.
--
-- Antes, a garantia escolhida no fechamento não era gravada e todo bloco nascia
-- com caução — com o seguro-fiança ligado, o contrato teria as duas.
-- Agora:
--   • contratos.garantia ('caucao' | 'seguro_fianca'); contratos existentes = caução;
--   • contrato com seguro-fiança: bloco com caução > 0 e pagamento do tipo
--     caução são recusados; e um contrato com caução não vira seguro-fiança;
--   • locacoes (registro antigo): seguro-fiança sem valor de caução.
-- O seguro-fiança continua DESLIGADO no app (flag); isto só fecha a porta.
-- Reaplicar é seguro.

alter table public.contratos add column if not exists garantia text not null default 'caucao';
do $c$ begin
  alter table public.contratos add constraint contratos_garantia_valida check (garantia in ('caucao', 'seguro_fianca'));
exception when duplicate_object then null; end $c$;

-- Blocos: mesma função da 0063 (180 dias, teto de 3 aluguéis, aceite das duas
-- partes) + a regra da garantia única.
create or replace function public.contrato_blocos_regras()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  aluguel numeric;
  garantia_contrato text;
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

  select c.aluguel_mensal, c.garantia into aluguel, garantia_contrato from public.contratos c where c.id = new.contrato_id;

  if garantia_contrato = 'seguro_fianca' and coalesce(new.caucao, 0) > 0 then
    raise exception 'Contrato com seguro-fiança não tem caução: a lei permite uma só garantia (art. 37 da Lei 8.245/91).' using errcode = '23514';
  end if;

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

-- Contrato com caução registrada não troca para seguro-fiança.
create or replace function public.contratos_garantia_unica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.garantia = 'seguro_fianca' and old.garantia is distinct from new.garantia
     and (exists (select 1 from public.contrato_blocos b where b.contrato_id = new.id and b.caucao > 0)
          or exists (select 1 from public.pagamentos_bloco p where p.contrato_id = new.id and p.tipo = 'caucao'))
  then
    raise exception 'Este contrato já tem caução: não pode ter também seguro-fiança (art. 37 da Lei 8.245/91).' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_contratos_garantia_unica on public.contratos;
create trigger trg_contratos_garantia_unica
  before update of garantia on public.contratos
  for each row execute function public.contratos_garantia_unica();

-- Pagamento do tipo caução num contrato com seguro-fiança: recusado.
create or replace function public.pagamentos_bloco_garantia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'caucao'
     and exists (select 1 from public.contratos c where c.id = new.contrato_id and c.garantia = 'seguro_fianca')
  then
    raise exception 'Contrato com seguro-fiança não recebe caução (uma só garantia, art. 37 da Lei 8.245/91).' using errcode = '23514';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_pagamentos_bloco_garantia on public.pagamentos_bloco;
create trigger trg_pagamentos_bloco_garantia
  before insert or update of tipo, contrato_id on public.pagamentos_bloco
  for each row execute function public.pagamentos_bloco_garantia();

revoke all on function public.contratos_garantia_unica() from public, anon, authenticated;
revoke all on function public.pagamentos_bloco_garantia() from public, anon, authenticated;

-- Registro antigo (locacoes): seguro-fiança sem caução. Em produção a tabela
-- está vazia (06/10/2026), então a regra vale para todas as linhas.
do $c$ begin
  if (select count(*) from information_schema.columns
       where table_schema = 'public' and table_name = 'locacoes' and column_name in ('garantia', 'caucao_valor')) = 2 then
    alter table public.locacoes add constraint locacoes_garantia_unica
      check (garantia is distinct from 'seguro_fianca' or coalesce(caucao_valor, 0) = 0);
  end if;
exception when duplicate_object then null; end $c$;
