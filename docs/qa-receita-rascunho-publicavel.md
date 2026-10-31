# Receita: rascunho de anúncio 100% publicável (massa de QA)

E273/E275 (30/10). A 0263 nasceu incompleta: sem endereço completo, sem garantia aceita, sem o padrão mínimo e com a
contagem da descrição zerada na lista de rascunhos. Os dois anúncios também mostravam o mesmo código público. A **0264**
(`supabase/migrations/0264_qa_rascunhos_publicaveis.sql`) é a receita corrigida. Ela serve de modelo para toda massa
nova de anúncio.

O editor (`/dashboard/imoveis/novo?draft=<id>`) lê o **`draft_data`**. A lista de rascunhos e a prontidão lêem as
**colunas** e as tabelas ao lado. Por isso a massa precisa preencher os dois lugares.

| Item que o editor confere | `draft_data` | Coluna / tabela |
|---|---|---|
| Endereço completo | `street`, `numero`, `cep`, `neighborhood`, `city`, `uf` | `exact_address`, `address` (bairro), `city`, `state`, `cep_proximidades`, `lat`/`lng`, `lat_exata`/`lng_exata` |
| Garantia aceita | `garantias.caucao_avista = true` | `garantias_aceitas = {caucao_avista}` |
| Faixa de estadia | `faixas.media_estadia = true` | `faixas_aceitas = {media_estadia}` |
| Disponibilidade | `availableFrom` (data) | `available_from` |
| Padrão mínimo de conforto | `qualificacaoConforto` (status) | `conforto_declaracoes`: os 12 itens da lista v2, `confirmado = true`, `versao_lista = 2` |
| Declarações do Passo 10 | `declaracoesPasso10 = {iptuOk, habitavel, convencao: "yes"}` | — |
| Descrição | `description` | `description` (a lista de rascunhos conta por ela) |
| Fotos (8) | `photos` (url + path na pasta do dono) | `property_photos` |
| Documento aprovado | — | `qualification_checklists` com o arquivo aprovado de um anúncio de teste do mesmo dono |
| Tipo de entrada, câmeras, internet | `tipoEntrada` (a resposta do Passo 6, que o assistente lê), `privacidade.tipoAcesso`, `privacidade.semCamerasInterior`, `internetMbps` | `tipo_entrada`, `sem_cameras_interior`, `internet_mbps` |

## Código público único (E275)
O código público ("Código VN-XXXXXX") não é gravado no banco. Ele é calculado com os **6 primeiros caracteres do id**
(`codigoDoImovel`, em `src/lib/imovel-pagina.ts`). Por isso os ids fixos de uma massa precisam diferir já nesses 6
caracteres. Use `a0264a00-…` e `a0264b00-…`, nunca `a0263000-…01` e `…02`, que viram os dois `VN-A02630`.

Em produção, a única colisão entre os 35 anúncios é o par da 0263. Ids gerados (UUID aleatório) colidem raramente:
cerca de 3% de chance de existir algum par repetido com 1.000 anúncios. Isso não é defeito da massa; é um limite do
formato do código, a decidir à parte.

## O que não dá para semear
Nada do que o editor confere ficou de fora. O termo de uso da IA, quando o assistente pede, é um aceite da pessoa
na tela e não entra na massa. A publicação também não: quem publica é o QA, pela tela, porque é a publicação que
dispara os avisos.
