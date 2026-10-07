-- 0078 Central de Agentes (escrita pelo Moacir em 07/10/2026; aprovada pelo Daniel)
-- Sem comandos que gerem NOTICE.

create table public.agentes (
  slug text primary key,
  nome text not null,
  cargo text not null,
  esquadrao text not null check (esquadrao in ('comando','operacoes','tecnologia','crescimento','financas','plataforma')),
  rotina_texto text,
  trigger_id text,
  status text not null default 'ativo' check (status in ('ativo','planejado','pausado')),
  briefing text not null default '',
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table public.agentes_rondas (
  id uuid primary key default gen_random_uuid(),
  agente_slug text not null references public.agentes(slug),
  iniciada_em timestamptz not null default now(),
  concluida_em timestamptz,
  status text not null check (status in ('ok','alerta','falhou')),
  resumo text not null default '' check (char_length(resumo) <= 4000),
  achados jsonb not null default '[]'::jsonb,
  ordens_atendidas uuid[] not null default '{}',
  link_sessao text,
  criado_em timestamptz not null default now()
);
create index agentes_rondas_slug_data on public.agentes_rondas (agente_slug, iniciada_em desc);

create table public.agentes_ordens (
  id uuid primary key default gen_random_uuid(),
  agente_slug text not null references public.agentes(slug),
  texto text not null check (char_length(texto) between 1 and 4000),
  criado_por uuid default auth.uid(),
  criada_em timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente','lida','concluida','cancelada')),
  resposta text,
  atualizada_em timestamptz not null default now()
);
create index agentes_ordens_slug_status on public.agentes_ordens (agente_slug, status);

create table public.agentes_conversas (
  id uuid primary key default gen_random_uuid(),
  agente_slug text references public.agentes(slug),
  papel text not null check (papel in ('daniel','agente','sistema')),
  autor_slug text references public.agentes(slug),
  texto text not null check (char_length(texto) <= 8000),
  usuario uuid default auth.uid(),
  criado_em timestamptz not null default now()
);
create index agentes_conversas_slug_data on public.agentes_conversas (agente_slug, criado_em desc);
create index agentes_conversas_usuario_data on public.agentes_conversas (usuario, criado_em desc);

alter table public.agentes enable row level security;
alter table public.agentes_rondas enable row level security;
alter table public.agentes_ordens enable row level security;
alter table public.agentes_conversas enable row level security;

revoke all on public.agentes, public.agentes_rondas, public.agentes_ordens, public.agentes_conversas from anon, authenticated;
grant select, insert, update on public.agentes, public.agentes_ordens, public.agentes_conversas to authenticated;
grant select on public.agentes_rondas to authenticated;

create policy agentes_admin_all on public.agentes for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy agentes_rondas_admin_le on public.agentes_rondas for select to authenticated using (public.is_admin());
create policy agentes_ordens_admin_all on public.agentes_ordens for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy agentes_conversas_admin_all on public.agentes_conversas for all to authenticated using (public.is_admin()) with check (public.is_admin());

create function public.registrar_ronda(
  p_slug text, p_inicio timestamptz, p_fim timestamptz, p_status text,
  p_resumo text, p_achados jsonb default '[]'::jsonb, p_ordens uuid[] default '{}', p_link text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.agentes_rondas (agente_slug, iniciada_em, concluida_em, status, resumo, achados, ordens_atendidas, link_sessao)
  values (p_slug, coalesce(p_inicio, now()), coalesce(p_fim, now()), p_status, left(coalesce(p_resumo,''), 4000), coalesce(p_achados,'[]'::jsonb), coalesce(p_ordens,'{}'), p_link)
  returning id into v_id;
  update public.agentes_ordens set status = 'concluida', atualizada_em = now()
   where id = any(coalesce(p_ordens,'{}')) and agente_slug = p_slug and status in ('pendente','lida');
  return v_id;
end $$;

create function public.ordens_pendentes(p_slug text)
returns table (id uuid, texto text, criada_em timestamptz)
language sql security definer set search_path = public as $$
  update public.agentes_ordens o set status = 'lida', atualizada_em = now()
   where o.agente_slug = p_slug and o.status = 'pendente'
  returning o.id, o.texto, o.criada_em;
$$;

revoke all on function public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text) from public, anon, authenticated;
revoke all on function public.ordens_pendentes(text) from public, anon, authenticated;
grant execute on function public.registrar_ronda(text,timestamptz,timestamptz,text,text,jsonb,uuid[],text) to service_role;
grant execute on function public.ordens_pendentes(text) to service_role;

insert into public.agentes (slug, nome, cargo, esquadrao, rotina_texto, trigger_id, status, ordem, briefing) values
('moacir','Moacir','Gerente geral','comando','Sempre ativo no Cowork · relatório 9h Texas',null,'ativo',1,'Gerente geral. Coordena os agentes, revisa PRs do Claude Code, escreve prompts e aplica migrações com aprovação do Daniel.'),
('otavio','Otávio','Supervisor e dono da fila de correções','comando','Todo dia 06:13 Brasília','trig_01V2ZUJH8oZkJHbG9YK8ZCq1','ativo',2,'Supervisor. Confere em produção o que foi corrigido, registra achados e monta o próximo pacote de até 5 itens para o Claude Code.'),
('helena','Helena','Chefe de gabinete','operacoes','Todo dia 07:22 Texas','trig_01Mx8qsBF6gtMJZy8a6q2iHz','ativo',3,'Chefe de gabinete. Mantém as Pendências do Daniel e lembra o que só ele pode fazer: seguradoras, CNPJ, contador, advogada, configurações.'),
('carla','Carla','Relatório do dia','operacoes','Todo dia 06:52 Brasília','trig_011dCgptzyngbzB1Fw4M3dGA','ativo',4,'Relatório do dia. Junta números do banco e do site, separando dados reais de dados de teste.'),
('bruno','Bruno','TI e QA noturno','tecnologia','Todo dia 02:52 Brasília','trig_01QXnGbD2CwZTE2mzsJxH7tM','ativo',5,'TI e QA noturno. Varre site, banco, avisos de segurança e erros da Vercel; manda achados para a fila de correções.'),
('marina','Marina','Estado do produto','tecnologia','Quintas 07:39 Brasília','trig_01HVwzpbDFbuVAz5UQP41eGp','ativo',6,'Estado do produto. Telas prontas e faltando, APIs, integrações e saldos dos serviços.'),
('luana','Luana','Marketing','crescimento','Segundas 07:47 Brasília','trig_01C3anpHqoDoBWezCbvzRuUk','ativo',7,'Marketing. Calendário de posts, roteiros e custos. Nunca publica sem aprovação do Daniel.'),
('rafael','Rafael','SEO','crescimento','Quartas 03:37 Brasília','trig_0161A7aJ5FSdjQaXefL6xQjB','ativo',8,'SEO. Títulos, descrições, páginas de cidade, buscas e concorrentes.'),
('thiago','Thiago','Parcerias e oportunidades','crescimento','Terças 07:41 Brasília','trig_01DHqnGkFtohD8pq5GMV67fR','ativo',9,'Parcerias. Seguradoras (EasyCover, Chubb, Pottencial, Porto), parceiros e oportunidades. Prepara contatos; não envia.'),
('sergio','Sérgio','Contador e jurídico','financas','Sextas 07:43 Brasília','trig_01NKcDe1X68k2o9Z5kNNBvSh','ativo',10,'Contabilidade e jurídico. CNPJ, impostos, Lei 8.245 e perguntas para a Dra. Beatriz. Não dá parecer definitivo.'),
('viva','Viva','Copiloto e suporte','plataforma',null,null,'planejado',11,'Copiloto e suporte dentro do app.'),
('vitoria','Vitória','Vistoria','plataforma',null,null,'planejado',12,'Vistoria de entrada e saída.'),
('caio','Caio','Manutenção e Caução','plataforma',null,null,'planejado',13,'Ordens de manutenção e devolução do Caução.'),
('fernanda','Fernanda','Antifraude','plataforma',null,null,'planejado',14,'Antifraude de cadastros e pagamentos.'),
('igor','Igor','Financeiro','plataforma',null,null,'planejado',15,'Financeiro da plataforma.'),
('rita','Rita','Saúde do sistema','plataforma',null,null,'planejado',16,'Saúde do sistema e alertas técnicos.');
