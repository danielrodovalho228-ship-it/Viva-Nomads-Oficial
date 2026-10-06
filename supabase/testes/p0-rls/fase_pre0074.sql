-- Antes da 0074: alinha o local ao de produção onde a 0074 depende dele.
reset role;
-- pgcrypto mora no schema "extensions" em produção.
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role;
-- profiles: em produção authenticated tem SELECT na tabela e UPDATE só nestas colunas.
revoke insert, update, delete on public.profiles from anon, authenticated;
do $c$
declare c text;
begin
  foreach c in array array['avatar_atualizado_em','company_name','full_name','linkedin_url','needs_nfse','notif_email','notif_whatsapp','phone','preferred_mode','professional_category'] loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name=c) then
      execute format('grant update (%I) on public.profiles to authenticated', c);
    end if;
  end loop;
end $c$;
-- Chaves como em produção: excluir a conta apaga em cascata contratos → blocos → pagamentos/acertos.
alter table public.contratos drop constraint if exists contratos_tenant_id_fkey,
  add constraint contratos_tenant_id_fkey foreign key (tenant_id) references auth.users (id) on delete cascade;
alter table public.contrato_blocos drop constraint if exists contrato_blocos_contrato_id_fkey,
  add constraint contrato_blocos_contrato_id_fkey foreign key (contrato_id) references public.contratos (id) on delete cascade;
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_contrato_id_fkey,
  add constraint pagamentos_bloco_contrato_id_fkey foreign key (contrato_id) references public.contratos (id) on delete cascade;
alter table public.pagamentos_bloco drop constraint if exists pagamentos_bloco_bloco_id_fkey,
  add constraint pagamentos_bloco_bloco_id_fkey foreign key (bloco_id) references public.contrato_blocos (id) on delete cascade;
alter table public.caucao_acertos drop constraint if exists caucao_acertos_contrato_id_fkey,
  add constraint caucao_acertos_contrato_id_fkey foreign key (contrato_id) references public.contratos (id) on delete cascade;
alter table public.properties drop constraint if exists properties_owner_id_fkey,
  add constraint properties_owner_id_fkey foreign key (owner_id) references public.profiles (id) on delete cascade;
alter table public.contratos drop constraint if exists contratos_property_id_fkey,
  add constraint contratos_property_id_fkey foreign key (property_id) references public.properties (id) on delete cascade;
select v('ANTES@0074','tabela de documentos não existe','select (to_regclass(''public.documentos_fiscais'') is null)::text','true');
select v('ANTES@0074','anon tem TRUNCATE em alguma tabela (o furo)','select (count(*) > 0)::text from information_schema.table_privileges where table_schema=''public'' and privilege_type=''TRUNCATE'' and grantee=''anon''','true');

-- Contratos de teste: X (dono 1111 × inquilino 2222) e Y (dono 7775 × inquilino 7774, contas que serão excluídas).
insert into auth.users (id, email, raw_user_meta_data) values
 ('77777774-0000-0000-0000-000000000000','inq74@t.com','{"role":"tenant","full_name":"Inquilina Setenta Quatro"}'),
 ('77777775-0000-0000-0000-000000000000','dono74@t.com','{"role":"owner","full_name":"Dono Setenta Cinco"}');
update public.profiles set cpf = '111.222.333-44' where id = '77777774-0000-0000-0000-000000000000';
insert into public.properties (id, owner_id, title, city, status, monthly_price) values
 ('aaaa7400-0000-0000-0000-000000000001','77777775-0000-0000-0000-000000000000','Imóvel Y','Uberlândia','active',2400);
insert into public.contratos (id, property_id, tenant_id, status) values
 ('d7400000-0000-0000-0000-000000000001','aaaaaaa1-0000-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','ativo'),
 ('d7400000-0000-0000-0000-000000000002','aaaa7400-0000-0000-0000-000000000001','77777774-0000-0000-0000-000000000000','ativo');
insert into public.contrato_blocos (id, contrato_id, numero_bloco, valor, caucao) values
 ('b7400000-0000-0000-0000-000000000001','d7400000-0000-0000-0000-000000000001',1,6000,3000),
 ('b7400000-0000-0000-0000-000000000002','d7400000-0000-0000-0000-000000000002',1,4800,2400);
insert into public.pagamentos_bloco (id, bloco_id, contrato_id, valor, data_pagamento, marcado_por, confirmado_pelo_inquilino) values
 ('a7400000-0000-0000-0000-000000000001','b7400000-0000-0000-0000-000000000001','d7400000-0000-0000-0000-000000000001',3000,'2026-10-01','11111111-1111-1111-1111-111111111111',true),
 ('a7400000-0000-0000-0000-000000000002','b7400000-0000-0000-0000-000000000002','d7400000-0000-0000-0000-000000000002',2400,'2026-10-01','77777775-0000-0000-0000-000000000000',true),
 ('a7400000-0000-0000-0000-000000000003','b7400000-0000-0000-0000-000000000001','d7400000-0000-0000-0000-000000000001',3000,'2026-11-01','11111111-1111-1111-1111-111111111111',true);
insert into public.caucao_acertos (id, contrato_id, tipo, caucao_total, valor_devolvido, status, registrado_por) values
 ('e7400000-0000-0000-0000-000000000001','d7400000-0000-0000-0000-000000000002','devolucao_integral',2400,2400,'devolvida_integral','77777775-0000-0000-0000-000000000000');
