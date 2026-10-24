# TIPO-CHACARA-B — tipo "Chácara/Sítio"

Pista B · sem migração. Usa `detalhes_anuncio` (0235) e as colunas privadas `lat_exata`/`lng_exata` (0066).

Decisão do Daniel (24/10): só chácara/sítio. Fazenda e rancho ficam fora até o parecer jurídico.

## O que entra
1. **Tipo `chacara`** com o rótulo "Chácara/Sítio".
   - Aparece no catálogo (`PROPERTY_TYPES`), em "Outros tipos" do cadastro, no `tipoCanonico` da busca, no filtro "Tipo de imóvel" (com a contagem do E16) e na URL `?tipo=chacara`.
   - O importador reconhece "chácara" e "sítio".
2. **Campos só deste tipo, obrigatórios para publicar:**
   - acesso: `asfalto`, `terra` ou `misto`;
   - tipo de internet: `fibra`, `radio`, `satelite` ou `movel`. A velocidade segue sendo o item "internet informada";
   - **ponto no mapa marcado pelo dono**: toque no mapa, arraste o pino, use "Usar minha localização" ou cole as coordenadas.
   - Na prontidão, sem os três aparece o item "Dados da chácara/sítio" (passo Detalhes). O servidor usa a mesma regra no portão do Publicar.
3. **O ponto marcado vale no lugar da geocodificação do endereço** (`aplicarPontoChacara`).
   - O banco guarda o exato em `lat_exata`/`lng_exata`; o público continua sendo o aproximado (0066).
   - A distância até o centro da cidade é **calculada no servidor** a partir desse ponto e guardada como `distanciaCidadeKm`. O centro vem dos conhecidos (Uberlândia) ou do OSM pelo nome da cidade.
   - Os tempos até os destinos saem do mesmo ponto, pelo motor do Prompt 37.
   - O formulário nunca manda a distância: se mandar, é descartada.
4. **Linha fixa no cadastro do tipo:** "Anuncie só a casa para morar. Uso da terra para plantio ou criação não entra no anúncio."
5. **Andar e elevador** não aparecem para casa nem para chácara/sítio, nem no anúncio nem no editor. Níveis, mínimos, taxa e contrato não mudam.

## Testes
- **`src/lib/anuncio/chacara.test.ts`:**
  - o tipo aparece no cadastro, na busca, no filtro e na URL (fazenda e rancho fora);
  - publicar sem os 3 campos é recusado;
  - a distância vem do ponto marcado, nunca do formulário;
  - editar sem marcar de novo mantém o ponto;
  - valores fora da lista caem;
  - o anúncio não mostra andar para este tipo.
- **E2E `t392-tipo-chacara`:**
  - filtro com contagem e `?tipo=chacara`;
  - linha fixa e os 3 campos no cadastro, com o item da prontidão sumindo quando preenchidos;
  - na edição, o ponto marcado vira o exato e a distância (≈15 km) é calculada dele.
