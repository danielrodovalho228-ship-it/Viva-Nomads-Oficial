-- 0253 — QA-LOGIN-B v2, ponto aberto 1: o admin observador da QA não escreve direto pela API nas tabelas de admin.
-- O admin observador da QA (0252) continua LENDO o que o admin lê, mas não ESCREVE nas tabelas que hoje aceitam
-- escrita de qualquer admin direto pela API (fora do site, onde as ações já recusam o observador). Política
-- RESTRITIVA por comando (insert/update/delete): soma-se às permissivas com AND, então não muda nada para quem não é
-- o observador e não toca leitura. Onde a pessoa também escreve as próprias linhas (dono do imóvel, do pedido, da
-- resposta; o próprio avatar/documento), a linha dele mesmo continua liberada. is_admin() e a regra do 2FA NÃO mudam.
do $$
declare
  -- tabela | comandos | linha da própria pessoa (fica liberada) ou null
  alvo record;
  cmd text;
  livre text;
begin
  for alvo in
    select * from (values
      ('agentes',                  array['insert','update','delete'], null::text),
      ('agentes_conversas',        array['insert','update','delete'], null),
      ('agentes_memoria',          array['insert','update','delete'], null),
      ('agentes_ordens',           array['insert','update','delete'], null),
      ('cidades_liberadas',        array['insert','update','delete'], null),
      ('config_parceria',          array['insert','update','delete'], null),
      ('destinos',                 array['insert','update','delete'], null),
      ('fotografo_pedidos',        array['update'],                   null),
      ('fotografos',               array['insert','update','delete'], null),
      ('fotografos_contato',       array['insert','update','delete'], null),
      ('fotos_perfil_revisao',     array['update'],                   null),
      ('gastos_marketing',         array['insert','update','delete'], null),
      ('moderacao_log',            array['insert','update','delete'], null),
      ('parceiros_interesse',      array['update'],                   null),
      ('pedidos_ajuda_publicacao', array['update'],                   null),
      ('pedidos_ignorados',        array['insert','update','delete'], 'proprietario_id = (select auth.uid())'),
      ('pedidos_moradia',          array['insert','update','delete'], 'inquilino_id = (select auth.uid())'),
      ('properties',               array['insert','update','delete'], 'owner_id = (select auth.uid())'),
      ('qualification_checklists', array['insert','update','delete'], 'owner_id = (select auth.uid())'),
      ('respostas_pedido',         array['update'],
        'proprietario_id = (select auth.uid()) or exists (select 1 from public.pedidos_moradia p where p.id = respostas_pedido.pedido_id and p.inquilino_id = (select auth.uid()))')
    ) as t(tabela, cmds, propria)
  loop
    if to_regclass('public.' || alvo.tabela) is null then
      continue;
    end if;
    livre := '(not (select public.is_qa_admin((select auth.uid()))))' || coalesce(' or (' || alvo.propria || ')', '');
    foreach cmd in array alvo.cmds loop
      execute format('drop policy if exists %I on public.%I', 'qa_observador: nao escreve (' || cmd || ')', alvo.tabela);
      execute format(
        'create policy %I on public.%I as restrictive for %s to authenticated %s',
        'qa_observador: nao escreve (' || cmd || ')', alvo.tabela, cmd,
        case cmd
          when 'insert' then format('with check (%s)', livre)
          when 'delete' then format('using (%s)', livre)
          else format('using (%s) with check (%s)', livre, livre)
        end);
    end loop;
  end loop;
end $$;

-- Arquivos: o admin apaga avatar e documento de imóvel de qualquer pessoa; o observador só os próprios.
drop policy if exists "qa_observador: nao apaga arquivo alheio" on storage.objects;
create policy "qa_observador: nao apaga arquivo alheio" on storage.objects as restrictive for delete to authenticated
  using (
    bucket_id not in ('avatars', 'property-docs')
    or not (select public.is_qa_admin((select auth.uid())))
    or (storage.foldername(name))[1] = (select auth.uid())::text
  );
