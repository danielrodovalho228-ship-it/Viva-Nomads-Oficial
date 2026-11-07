# E695 — A busca vazia não mente sobre a cidade

**Relato (QA Allinne, 07/11):** com imóveis no bairro mas sem disponibilidade na data/filtros (a partir de 20/12), o zero-resultados dizia "A Viva ainda não chegou em Santa Mônica" — falso (há 2 imóveis lá).

**Causa:** `buscar/search-client.tsx` sempre mostrava `<ConviteCidade>` no estado vazio. O convite lê o texto digitado como cidade do IBGE ("Santa Mônica" também é um município do PR, que não está liberado) e diz "ainda não chegou" sem olhar se o lugar tem imóveis.

**Correção (sem migração):** `src/lib/busca-vazia.ts` (puro) decide a situação a partir do que existe no lugar digitado ANTES da data e dos filtros (`baseVisivel`):
- zero imóveis no lugar → continua o convite de cidade ("ainda não chegou…");
- há imóveis → título "Há N imóveis em {lugar}, mas nenhum para essa data e esses filtros." + "O mais próximo fica disponível a partir de dd/mm/aaaa." (só quando a data é conhecida e não passou), e **sem** o convite de cidade.

**Teste:** `src/lib/busca-vazia.test.ts` (visto vermelho antes; 6 ok, inclui a guarda de que o convite só aparece no ramo "sem imóveis"). `tsc` e `eslint` limpos.

**Fora do escopo:** o convite de cidade tratar um bairro como se fosse a cidade homônima (quando de fato não há imóvel no lugar) segue como era.
