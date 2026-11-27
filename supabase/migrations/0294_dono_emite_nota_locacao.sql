-- E574 — o proprietário PJ (MEI conta como PJ) declara se emite nota fiscal da LOCAÇÃO para o morador; espelha o E24
-- dos parceiros (0243). Desenho fiscal aprovado (não muda aqui): dono PF não emite nota de locação — a plataforma gera
-- o Recibo de Locação; a Viva emite NFS-e só sobre a própria taxa.
--
--   profiles.emite_nota_locacao: boolean null (null = não respondeu). PF fica SEMPRE null (check). PJ que já tem o
--     documento completo fica null e vê a pergunta como pendência na Conta, sem bloquear nada do que já está no ar;
--     o PJ que vai concluir o documento responde (portão no servidor, salvarMeuDocumento).
--     O filtro "Emite nota fiscal" da busca de imóveis lê esta coluna pelo servidor (cliente de serviço) — nada novo é
--     exposto ao público além do booleano do selo.
--   denuncias_anuncio.motivo ganha 'nota_nao_emitida' ("Não emitiu a nota fiscal declarada").
--   properties.issues_invoice não muda (o selo antigo do cartão segue atrás da chave SELO_NF_UI).

alter table public.profiles add column if not exists emite_nota_locacao boolean;
alter table public.profiles drop constraint if exists profiles_emite_nota_locacao_so_pj;
alter table public.profiles add constraint profiles_emite_nota_locacao_so_pj check (person_type = 'pj' or emite_nota_locacao is null);

alter table public.denuncias_anuncio drop constraint if exists denuncias_anuncio_motivo_check;
alter table public.denuncias_anuncio add constraint denuncias_anuncio_motivo_check
  check (motivo in ('fotos_falsas', 'imovel_nao_existe', 'pagamento_fora', 'conteudo_improprio', 'nota_nao_emitida', 'outro'));
