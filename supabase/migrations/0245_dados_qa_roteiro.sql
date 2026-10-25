-- 0245 — Dados de teste do roteiro de QA logado (ordem ee7d27b8, item 4). Só a conta de teste proprietario1.
-- O imóvel do roteiro (Santa Mônica) volta ao ar COM pacote de limpeza; o segundo (também com documento aprovado e
-- 8 fotos) volta ao ar SEM pacote, para o contraste. Só mexe em dono marcado is_teste; nunca em conta real.
do $$
declare
  v_dono uuid;
begin
  select p.id into v_dono from public.profiles p
   where lower(p.email) = 'proprietario1@vivanomads.com.br' and p.is_teste;
  if v_dono is null then
    raise notice '0245: proprietario1 ausente ou não marcado como teste; nada a fazer';
    return;
  end if;

  update public.properties
     set status = 'active', pausa_motivo = null,
         limpeza_estadia = '{"porMes": 2, "inclui": "Limpeza geral e troca de roupa de cama", "valorMes": 180}'::jsonb
   where id = 'ddf86c66-a214-463d-8563-66a5204010b5' and owner_id = v_dono;

  update public.properties
     set status = 'active', pausa_motivo = null, limpeza_estadia = null
   where id = '9f18c108-ce4e-4b2c-b731-606ade99370d' and owner_id = v_dono;
end;
$$;
