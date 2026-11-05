-- Viva Nomads — 0301 (E543): número do contrato único no dado e na criação.
-- Aplicação em produção: supabase/producao/aplicar-0301.sql. Rollback: supabase/producao/rollback/0301_rollback.sql.

-- O número público do contrato é VN-CT- + os 8 primeiros hex do id (E331). A semente da massa 0268 deu a dois contratos
-- DIFERENTES ids com o mesmo começo (a0268b00-…0011, avaliação; a0268b00-…0021, instruções): o admin mostrava
-- VN-CT-A0268B00 duas vezes, e o registro também (2× VN-CT-A0268B00 v1). Única colisão no banco.

-- 1. Prevenção: contrato novo nunca nasce com o número de outro. Antes do insert, se o começo do id coincidir com o de
--    um contrato existente, o id é sorteado de novo (nunca impede o contrato de nascer, a regra da 0201).
create or replace function public.contratos_numero_unico() returns trigger language plpgsql set search_path = public as $$
begin
  while exists (select 1 from public.contratos c where left(c.id::text, 8) = left(new.id::text, 8) and c.id <> new.id) loop
    new.id := gen_random_uuid();
  end loop;
  return new;
end $$;
drop trigger if exists trg_contratos_numero_unico on public.contratos;
create trigger trg_contratos_numero_unico before insert on public.contratos
  for each row execute function public.contratos_numero_unico();

-- 2. O dado: o contrato …0021 é recriado como a0268b01-…0021 (VN-CT-A0268B01), com o seu bloco. O registro antigo dele
--    fica 'anulado' com o motivo (o registro é imutável: só o status anda; o gatilho do insert cria o registro novo).
--    Só roda se o …0021 ainda existe, se o id novo está livre e se o contrato não tem nada além do bloco (o que a massa
--    criou) — nunca apaga histórico.
do $$
declare
  v_velho constant uuid := 'a0268b00-0000-4000-8000-000000000021';
  v_novo constant uuid := 'a0268b01-0000-4000-8000-000000000021';
  v_contrato jsonb;
  v_blocos jsonb;
  v_fk record;
  v_tem boolean;
begin
  if not exists (select 1 from public.contratos where id = v_velho) or exists (select 1 from public.contratos where id = v_novo) then
    return;
  end if;
  for v_fk in
    select c.conrelid::regclass as tabela, a.attname as coluna
      from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid = 'public.contratos'::regclass and c.conrelid <> 'public.contrato_blocos'::regclass
  loop
    execute format('select exists (select 1 from %s where %I = $1)', v_fk.tabela, v_fk.coluna) into v_tem using v_velho;
    if v_tem then
      raise notice 'E543: o contrato % tem registros além do bloco (%); nada foi mudado.', v_velho, v_fk.tabela;
      return;
    end if;
  end loop;

  select to_jsonb(c) into v_contrato from public.contratos c where id = v_velho;
  select coalesce(jsonb_agg(to_jsonb(b) || jsonb_build_object('contrato_id', v_novo)), '[]'::jsonb) into v_blocos
    from public.contrato_blocos b where contrato_id = v_velho;

  delete from public.contratos where id = v_velho;  -- o bloco sai junto (cascade)
  -- O contrato já estava assinado: recriá-lo não é uma assinatura nova. Sem isto, o gatilho daria como 'atendido' o
  -- pedido de moradia em aberto do inquilino de teste.
  alter table public.contratos disable trigger trg_pedido_atendido_no_contrato;
  insert into public.contratos
    select * from jsonb_populate_record(null::public.contratos, v_contrato || jsonb_build_object('id', v_novo));
  alter table public.contratos enable trigger trg_pedido_atendido_no_contrato;
  insert into public.contrato_blocos
    select * from jsonb_populate_recordset(null::public.contrato_blocos, v_blocos);

  update public.documentos_registro
     set status = 'anulado', anulado_motivo = 'E543: número repetido de outro contrato (massa 0268); o contrato foi recriado como VN-CT-A0268B01.'
   where ref_tabela = 'contratos' and ref_id = v_velho and status = 'valido';
end $$;

-- Conferência (somente leitura):
--   select upper(left(id::text, 8)), count(*) from public.contratos group by 1 having count(*) > 1;  -- nenhuma linha
--   select numero, status, ref_id from public.documentos_registro where numero like 'VN-CT-A0268B0%' order by registro_seq;
