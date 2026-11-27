-- E661 (apoio da Pista B à Pista A): a estrutura do CONDOMÍNIO (Wi-Fi, recepção, fechadura) ganha campos próprios nas
-- instruções de chegada, separados do Wi-Fi do apartamento. Só colunas novas (nulas); nada é lido nem apagado.
-- A tabela tem grant de tabela (não de coluna) e RLS "só o dono": as colunas novas herdam as duas regras.
alter table public.imovel_instrucoes_chegada
  add column if not exists condominio_wifi_rede text check (condominio_wifi_rede is null or char_length(condominio_wifi_rede) <= 100),
  add column if not exists condominio_wifi_senha text check (condominio_wifi_senha is null or char_length(condominio_wifi_senha) <= 100),
  add column if not exists condominio_recepcao text check (condominio_recepcao is null or char_length(condominio_recepcao) <= 500),
  add column if not exists condominio_fechadura text check (condominio_fechadura is null or char_length(condominio_fechadura) <= 500);

comment on column public.imovel_instrucoes_chegada.condominio_fechadura is
  'E661: fechadura/portão/eclusa do condomínio (código, biometria ou chave). Mesma regra das demais instruções: só o dono lê e grava; o morador recebe pelo servidor, liberada 7 dias antes da entrada.';
