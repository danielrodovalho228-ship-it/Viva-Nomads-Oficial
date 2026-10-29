-- 0255 — E237 (E231-B do coordenador): o bucket "central-anexos" (0097, Central v2 "PR A" de 10/10) sai junto com a rota
-- /api/admin/agentes/anexos, que nenhuma tela chamou. GUARDA: só apaga com o bucket VAZIO; com qualquer objeto, aborta
-- com mensagem e nada muda. A 0097 não criou política; se alguma política em storage citar o bucket, sai antes.
-- O Supabase barra DELETE direto em storage.buckets (storage.protect_delete); a liberação vale só nesta transação,
-- depois da contagem. Idempotente: sem o bucket, não faz nada.

do $$
declare
  n bigint;
  p record;
begin
  if not exists (select 1 from storage.buckets where id = 'central-anexos') then
    return;
  end if;
  select count(*) into n from storage.objects where bucket_id = 'central-anexos';
  if n > 0 then
    raise exception '0255: o bucket central-anexos tem % objeto(s); nada foi apagado. Decida o destino dos arquivos antes de reaplicar.', n;
  end if;
  for p in
    select policyname, tablename from pg_policies
     where schemaname = 'storage' and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) like '%central-anexos%'
  loop
    execute format('drop policy if exists %I on storage.%I', p.policyname, p.tablename);
  end loop;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.buckets where id = 'central-anexos';
end
$$;
