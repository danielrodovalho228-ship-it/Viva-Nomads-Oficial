-- ROLLBACK da 0074 (documentos fiscais). APAGA os documentos emitidos — exporte
-- antes (são registros de retenção legal). Não devolve o TRUNCATE a anon/
-- authenticated (de propósito: era um furo).
begin;
grant insert, update, delete on public.caucao_acertos, public.caucao_descontos to authenticated;
-- registrado_por volta a NO ACTION; acertos sem autor (conta excluída) impedem o NOT NULL — ficam sem ele.
alter table public.caucao_acertos drop constraint if exists caucao_acertos_registrado_por_fkey;
alter table public.caucao_acertos add constraint caucao_acertos_registrado_por_fkey foreign key (registrado_por) references auth.users (id);
drop function if exists public.conferir_documento(text);
drop function if exists public.proximo_numero_documento(text);
drop table if exists public.documentos_fiscais;
drop function if exists public.documentos_fiscais_emissao();
drop function if exists public.documentos_fiscais_imutavel();
drop table if exists public.documentos_fiscais_contador;
drop function if exists public.iniciais(text);
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_encargos_lista;
alter table public.pagamentos_bloco drop column if exists encargos;
alter table public.profiles drop constraint if exists profiles_email_contador_formato;
alter table public.profiles drop column if exists email_contador;
do $c$ begin if to_regclass('public.invoices') is not null then alter table public.invoices drop column if exists numero; end if; end $c$;
delete from storage.buckets b where b.id = 'documentos' and not exists (select 1 from storage.objects o where o.bucket_id = 'documentos');
commit;
