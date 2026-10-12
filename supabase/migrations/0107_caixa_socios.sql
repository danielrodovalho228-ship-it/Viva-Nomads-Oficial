-- 0107 — CAIXA DOS SÓCIOS (pedido do Daniel, 12/10/2026). Tela /admin/socios: sócios (admins) mandam texto, áudio,
-- documento ou print; o servidor transcreve o áudio e lê o print/documento; o Moacir (gerente) lê de hora em hora,
-- distribui para a equipe e responde ali mesmo.
-- Segurança: só admin (public.is_admin()) lê, envia e atualiza; anon não tem acesso. Arquivos num bucket PRIVADO
-- (`caixa-socios`), caminho `<autor>/<arquivo>`, só admin lê/envia. As funções do Moacir rodam como dono (service)
-- e não são executáveis por anon/authenticated. Idempotente e sem NOTICE (reaplicar não muda nada).

do $$
begin
  if to_regclass('public.caixa_socios') is null then
    create table public.caixa_socios (
      id uuid primary key default gen_random_uuid(),
      criado_em timestamptz not null default now(),
      autor uuid default auth.uid() references public.profiles(id) on delete set null,
      tipo text not null check (tipo in ('texto','audio','documento','imagem')),
      texto text check (texto is null or char_length(texto) <= 4000),
      arquivo_path text check (arquivo_path is null or char_length(arquivo_path) <= 300),
      arquivo_nome text check (arquivo_nome is null or char_length(arquivo_nome) <= 200),
      texto_extraido text check (texto_extraido is null or char_length(texto_extraido) <= 20000),
      extracao_status text not null default 'nao_se_aplica'
        check (extracao_status in ('nao_se_aplica','pendente','ok','falhou','desligada')),
      status text not null default 'novo' check (status in ('novo','em_andamento','feito','precisa_daniel')),
      resposta text check (resposta is null or char_length(resposta) <= 4000),
      respondido_em timestamptz,
      ordem_id uuid,
      constraint caixa_socios_tem_conteudo check (texto is not null or arquivo_path is not null)
    );
    create index caixa_socios_recentes on public.caixa_socios (criado_em desc);
    create index caixa_socios_abertos on public.caixa_socios (status) where status in ('novo','em_andamento');
  end if;
end;
$$;

alter table public.caixa_socios enable row level security;
revoke all on public.caixa_socios from public, anon, authenticated;
grant select, insert, update on public.caixa_socios to authenticated;   -- só passa a política de admin
grant all on public.caixa_socios to service_role;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='caixa_socios' and policyname='caixa_socios: admin le') then
    create policy "caixa_socios: admin le" on public.caixa_socios for select to authenticated using (public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='caixa_socios' and policyname='caixa_socios: admin envia') then
    create policy "caixa_socios: admin envia" on public.caixa_socios for insert to authenticated
      with check (public.is_admin() and autor = auth.uid() and status = 'novo' and resposta is null);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='caixa_socios' and policyname='caixa_socios: admin atualiza') then
    create policy "caixa_socios: admin atualiza" on public.caixa_socios for update to authenticated
      using (public.is_admin()) with check (public.is_admin());
  end if;
end;
$$;

-- Bucket privado (25 MB): áudio, PDF/Office e imagens.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('caixa-socios', 'caixa-socios', false, 26214400, array[
  'audio/mp4','audio/x-m4a','audio/m4a','audio/mpeg','audio/ogg','audio/opus','audio/wav','audio/x-wav','audio/webm','audio/aac',
  'application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain',
  'image/png','image/jpeg','image/webp','image/heic','image/heif'
])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='caixa-socios: admin le') then
    create policy "caixa-socios: admin le" on storage.objects for select to authenticated
      using (bucket_id = 'caixa-socios' and public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='caixa-socios: admin envia') then
    create policy "caixa-socios: admin envia" on storage.objects for insert to authenticated
      with check (bucket_id = 'caixa-socios' and public.is_admin() and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end;
$$;

-- Moacir: itens a tratar (novos, com a leitura do arquivo já feita ou que falhou/está desligada há mais de 10 min).
create or replace function public.caixa_socios_pendentes()
returns table (id uuid, criado_em timestamptz, tipo text, texto text, arquivo_nome text, texto_extraido text, extracao_status text)
language sql stable security definer set search_path = public as $$
  select c.id, c.criado_em, c.tipo, c.texto, c.arquivo_nome, c.texto_extraido, c.extracao_status
    from public.caixa_socios c
   where c.status = 'novo'
     and (c.extracao_status in ('nao_se_aplica','ok','falhou','desligada') or c.criado_em < now() - interval '10 minutes')
   order by c.criado_em
   limit 30;
$$;

create or replace function public.responder_caixa_socios(p_id uuid, p_status text, p_resposta text, p_ordem uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('em_andamento','feito','precisa_daniel') then raise exception 'status inválido'; end if;
  if p_resposta is null or char_length(btrim(p_resposta)) = 0 or char_length(p_resposta) > 4000 then raise exception 'resposta inválida'; end if;
  update public.caixa_socios
     set status = p_status, resposta = p_resposta, respondido_em = now(), ordem_id = coalesce(p_ordem, ordem_id)
   where id = p_id;
end;
$$;

revoke all on function public.caixa_socios_pendentes() from public, anon, authenticated;
revoke all on function public.responder_caixa_socios(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.caixa_socios_pendentes() to service_role;
grant execute on function public.responder_caixa_socios(uuid, text, text, uuid) to service_role;
