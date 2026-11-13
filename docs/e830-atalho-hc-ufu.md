# E830 — atalho "Perto do HC-UFU/Umuarama" com critério diferente do nome

**Achado:** o atalho da home filtra só o BAIRRO (`?local=Umuarama`) e deixa de fora o anúncio do Osvaldo Rezende, que se diz "próximo à UFU". O nome promete proximidade; o critério é bairro.
**Conferido no código:** `/buscar` casa o texto de local com "bairro cidade" (sem distância); `contarAtalho` (home) repetia a mesma regra copiada. O polo `hc-ufu-umuarama` (`src/lib/polos.ts`) é a lista de bairros do HC-UFU: Umuarama e Jardim Umuarama.

## Decisão (leitura conservadora)
Um critério só, verdadeiro e igual ao nome: **bairro**. A distância não serve como critério porque as coordenadas dos exemplos são aproximadas (o ube-004, do Umuarama, mediria ~5 km do HC e sairia). Os "pontos de interesse do anúncio" são declaração do dono, não critério conferível.

## Correção
1. `casaLocal(p, local)` (`src/lib/busca/local-busca.ts`), única regra do texto de local, usada pela `/buscar` e por `contarAtalho`.
2. O atalho sai do polo: `BAIRRO_HC = polo.bairros[0]`, href `/buscar?local=Umuarama` (casa também "Jardim Umuarama") e **rótulo "Bairro Umuarama (HC-UFU)"**: diz bairro e não promete proximidade.
3. O Osvaldo Rezende continua fora, e agora o nome do atalho não diz o contrário.

## Testes
- `node --test src/lib/busca/e830-atalho-hc-ufu.test.ts`: main pass 0 / fail 1 (o módulo não existe); branch pass 3 / fail 0.
- Escopados (`src/lib/busca`, home, components, polos, massa de filtros do lab): 267 / 0. tsc limpo; consistência OK.
- Lab (build da branch): t66 + t730 (home e atalhos, 390/1280): 7 passed.

## Dúvidas
- O polo da página da cidade ("Perto do HC-UFU e Umuarama", em `/cidades/uberlandia`) usa o mesmo critério de bairro com nome de proximidade. Não mexi (fora do atalho). Se for para alinhar, o nome do polo vira "Bairros Umuarama e Jardim Umuarama (HC-UFU)" ou parecido.
- Se a preferência for distância (raio do HC-UFU), é outro desenho: depende de coordenadas reais dos anúncios.
