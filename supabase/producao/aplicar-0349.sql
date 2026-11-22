-- Viva Nomads — aplicar 0349 (E1075). Idempotente. Aplicada pela Action quando o PR é mesclado.
-- E1075 (ORDEM-DUET-355, decisão do Daniel de 21/11/2026): a página pública do avaliador do Rogério Silva no ar já, sem
-- esperar pelo CNPJ. SÓ o perfil público: um registo mínimo (avaliadores_perfil_publico) com nome, cidade, selo e um
-- número do contador da cidade, lido pela função avaliador_perfil_publico(numero). NÃO toca em avaliadores_credenciamento
-- (o credenciamento continua à espera do CNPJ), no rodízio, na escolha pelo dono, nos pedidos nem na chave VISTORIA_ATIVA.
-- Rollback: supabase/producao/rollback/0349_rollback.sql
begin;
set local lock_timeout = '5s';

create table if not exists public.avaliadores_perfil_publico (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique check (numero ~ '^[A-Z]{3}-[0-9]{3,}$'),
  nome_publico text not null check (char_length(btrim(nome_publico)) between 2 and 80),
  cidade text not null check (char_length(btrim(cidade)) between 2 and 80),
  selo text not null check (char_length(btrim(selo)) between 2 and 60),
  publicado boolean not null default true,
  -- Quando o credenciamento for concluído (depois do CNPJ), a linha dele liga-se aqui; até lá fica vazio.
  credenciamento_id uuid unique references public.avaliadores_credenciamento (id) on delete set null,
  criado_em timestamptz not null default now()
);
alter table public.avaliadores_perfil_publico enable row level security;
revoke all on public.avaliadores_perfil_publico from public, anon, authenticated;
grant all on public.avaliadores_perfil_publico to service_role;

-- Só o que a página mostra. Laudos e conduta vêm do credenciamento ligado (as mesmas contas de avaliadores_publicos);
-- sem credenciamento, 0 laudos e nota vazia: nada inventado.
create or replace function public.avaliador_perfil_publico(p_numero text)
returns table (numero text, nome_publico text, cidade text, selo text, avaliacoes_feitas integer, nota_conduta numeric)
language sql
stable
security definer
set search_path = public
as $$
  select p.numero,
         btrim(p.nome_publico),
         p.cidade,
         p.selo,
         coalesce((select count(*)::integer from public.vistoria_pedidos v
                    where v.avaliador_id = p.credenciamento_id and v.status = 'laudo_emitido' and not v.teste), 0),
         (select round(avg((k.pontualidade + k.cordialidade + k.cuidado) / 3.0), 1) from public.vistoria_conduta k
           where k.avaliador_id = p.credenciamento_id and k.autor = 'dono' and k.publicada_em is not null)
    from public.avaliadores_perfil_publico p
   where p.numero = p_numero and p.publicado
$$;
revoke all on function public.avaliador_perfil_publico(text) from public;
grant execute on function public.avaliador_perfil_publico(text) to anon, authenticated;

-- O perfil do Rogério Silva (decisão do Daniel, 21/11/2026). O número sai do contador da cidade, o mesmo dos
-- credenciados: nunca repete um número. Só na primeira vez.
insert into public.avaliadores_perfil_publico (numero, nome_publico, cidade, selo)
select public.proximo_numero_avaliador('UDI'), 'Rogério Silva', 'Uberlândia', 'Avaliador sócio da Viva'
 where not exists (select 1 from public.avaliadores_perfil_publico where nome_publico = 'Rogério Silva' and cidade = 'Uberlândia');

insert into supabase_migrations.schema_migrations (version, name)
select '20261121000349', '0349_avaliador_perfil_publico_e1075'
where not exists (select 1 from supabase_migrations.schema_migrations where version = '20261121000349');
commit;
