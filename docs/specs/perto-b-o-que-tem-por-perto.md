# PERTO-B — "O que tem por perto" automático

## 1. Diagnóstico: por que `proximidades_cep` ficou vazia em produção
Evidência lida em produção (24/10, só leitura):
- **A rota foi chamada e passou do limite:** `limites_uso` tem **10** registros `osm:*`. São dias 22/10 (3) e 23/10 (7). A rota só registra o limite depois do cache; portanto essas 10 chamadas foram ao OpenStreetMap.
- **Nenhuma deu certo:** `proximidades_cep` tem **0 linhas**. O código só gravava o cache quando havia lugares, então todas as 10 terminaram sem lugar nenhum.
- **Sem log nenhum:** a rota engolia o erro e não escrevia nada. Os logs do Vercel nesses horários (por exemplo 23/10 17:10 e 23:22 UTC) não têm nenhuma linha, e o motivo não pode ser lido depois do fato.
- **Teste daqui:** o ambiente deste trabalho não alcança `nominatim.openstreetmap.org` nem `overpass-api.de` (proxy 403). Por isso o teste direto no preview fica para o QA, com o log novo (abaixo).

Causa mais provável, pelo código:
- A geocodificação era UMA consulta em texto único: `"Rua A, 10, Bairro, Cidade, UF, 38400100, Brasil"`.
- No OSM do Brasil, o CEP só com dígitos e o bairro no meio quase nunca casam. O Nominatim devolve lista vazia, e o resultado é `sem_ponto`.
- O Mapbox, que é a reserva, está desligado em produção (sem token).
- O cadastro também só buscava com o número preenchido, e a **edição nunca buscava**: o publicado não tem o rascunho, que guarda CEP e número. Por isso a tela mostrava "Achamos pelo endereço…" e "Não achamos lugares…" ao mesmo tempo.

Correção:
- **Geocodificação estruturada** (`tentativasNominatim`), da mais precisa para a mais larga:
  1. `street` (número + rua), `city`, `state` e `postalcode` com hífen;
  2. o mesmo sem o CEP;
  3. rua + cidade em texto;
  4. só o CEP.
- **Overpass com espelho:** se o principal (`overpass-api.de`) recusar (429/5xx) ou não responder, a busca usa `overpass.kumi.systems`. É o espelho público da Kumi Systems, cuja política aceita uso público sem chave, com o mesmo cuidado de volume.
- **Política de uso do OSM:** User-Agent com a Viva e o e-mail de contato, no máximo 1 pedido por segundo, e cache por CEP (30 dias). O ponto fica no cache mesmo sem lugares, para servir de origem dos lugares manuais.
- **Log de cada busca:** uma linha `"[proximidades] <fonte> <etapas>"`. As etapas são, por exemplo, `nominatim:200:vazio nominatim:200:ponto overpass-api.de:429 overpass.kumi.systems:200:9`. Nunca entram endereço nem CEP.
- **`fonte` na resposta e no log:** `osm`, `mapbox`, `cache`, `lab`, `sem_ponto`, `sem_lugares`, `limite` ou `sem_cep`.

**Para confirmar no preview, depois do deploy:**
1. Abrir um anúncio em edição com CEP real.
2. Ler no Vercel a linha `[proximidades]`. A `fonte` e as etapas dizem onde parou, se ainda parar.

## 2. Onde a busca roda
- **Cadastro novo:** com CEP e rua. O número não é mais obrigatório.
- **Edição:** ao abrir, pelo endereço guardado no servidor (`propertyId`). Para rascunho, vem do CEP do rascunho; para publicado, do CEP guardado na coluna **privada** `properties.cep_proximidades`, da 0238.
- **Busca de novo:** sempre que CEP, rua ou número mudam (`chaveBuscaPerto`). "Não mostrar" é mantido entre as buscas.
- **Mesmo caminho:** rascunho e publicado usam a mesma rota e o mesmo salvamento.

## 3. Categorias
Saúde (hospital, farmácia, academia), Educação (universidade, **escola**: `amenity=school`, tipo novo), Trabalho (coworking), Mercado (supermercado) e Transporte (parada de ônibus). Até **3 por categoria**, os mais próximos primeiro. Isso troca o teto antigo de 8 no total.

## 4. Tempo e distância
- Os minutos vêm do motor do Prompt 37 (`rotas.ts`), a pé até 1 km e de carro acima. São calculados ao salvar e guardados como cache (`tempo_min`, `tempo_modo`).
- Sem provedor de rotas (hoje, em produção), a tela mostra a **distância** arredondada: "a 600 m", "a 1,4 km".
- As fórmulas de minuto estimado saíram de `osm.ts`, e a nota antiga em texto livre não vai mais à tela.
- Nunca entra minuto digitado pelo dono.

## 5. Curadoria por anúncio (migração 0238)
- **"Não mostrar":** o lugar fica guardado como `oculto`.
- **"Está errado":** motivo curto, guardado em `proximidades_reportes`. O dono cria e lê os seus; a página pública não lê; o admin vê em **/admin/destinos → "Lugares por perto marcados como errados"**, com "Resolvido".
- **Lugar à mão:** só o que faltou, com nome, categoria e **endereço do lugar**. O endereço é geocodificado pelo mesmo caminho e a distância é **calculada**; endereço não encontrado mostra "Não achamos este endereço." O campo "Distância" em texto livre saiu.
- **Distância só calculada no servidor:** ao salvar, o servidor recalcula tudo. Um lugar do OSM só entra se estiver na busca guardada para o CEP do anúncio, e a distância vem de lá. Do lugar manual, o servidor geocodifica o endereço. Distância ou minuto vindos do navegador nunca são gravados.
- **Manual antigo** (só "Distância" em texto): fica fora da página pública até o dono informar o endereço. Aparece como pendência na prontidão ("Endereço dos lugares por perto"), sem travar a publicação.

## 6. Fonte única
- A regra pura é `proximidadesVisiveis()`, em `src/lib/anuncio/proximidades.ts`. No servidor, `proximidadesDoAnuncio(id)`, em `src/lib/data/proximidades.ts`.
- Leem da mesma lista: "O que tem por perto", os 3 chips de "Serviços por perto", os destaques ("Perto de …") e a página da estadia.
