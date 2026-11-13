/*
  E829 — /buscar abria com a lista COMPLETA (15) e só depois caía para o resultado filtrado: o estado nascia vazio e a
  URL era lida num useEffect. Agora o servidor passa a query e o estado nasce dela (filtrosDaUrl, pura).
  Roda: node --test src/lib/busca/e829-primeira-pintura-filtrada.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { filtrosDaUrl, type FiltrosDaUrl } from "./filtros-da-url.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const cliente = ler("../../app/(public)/buscar/search-client.tsx");
const pagina = ler("../../app/(public)/buscar/page.tsx");

test("os atalhos da home viram filtro já na leitura da URL", () => {
  assert.equal(filtrosDaUrl("?preco=2500").maxPrice, 2500);
  assert.equal(filtrosDaUrl("orcamento=3000").maxPrice, 3000, "o hero usa ?orcamento=");
  assert.equal(filtrosDaUrl("?pet=1").petsOnly, true);
  assert.equal(filtrosDaUrl("?pet=1&porte=G").petPorte, "G");
  assert.equal(filtrosDaUrl("?quartos=3").minBedrooms, 3);
  assert.equal(filtrosDaUrl("?homeoffice=1").homeOfficeOnly, true);
  assert.equal(filtrosDaUrl("?local=Umuarama").locationQuery, "Umuarama");
  assert.deepEqual(filtrosDaUrl("?comod=garagem").comodidades, ["garagem"]);
  assert.equal(filtrosDaUrl("?seguro=1").garantia, "seguro_fianca", "atalho antigo");
  assert.equal(filtrosDaUrl("?periodo=90").maxPeriod, 120, "legado do hero");
});

test("sem query (ou com valor inválido) = nenhum filtro: os padrões de antes", () => {
  const vazio = filtrosDaUrl("");
  assert.equal(vazio.maxPrice, 0);
  assert.equal(vazio.petsOnly, false);
  assert.equal(vazio.adults, 1);
  assert.equal(vazio.sort, "relevance");
  assert.equal(vazio.geoCenter, null);
  assert.equal(filtrosDaUrl("?preco=50").maxPrice, 0);
  assert.equal(filtrosDaUrl("?quartos=9").minBedrooms, 0);
  assert.equal(filtrosDaUrl("?pet=sim").petsOnly, false);
});

test("o servidor passa a query e o estado da busca NASCE dela (sem restaurar no mount)", () => {
  assert.match(pagina, /const sp = await searchParams;/);
  assert.match(pagina, /buscaInicial=\{busca\.toString\(\)\}/);
  assert.match(cliente, /const \[inicial\] = useState\(\(\) => filtrosDaUrl\(buscaInicial\)\);/);
  const chaves: (keyof FiltrosDaUrl)[] = [
    "locationQuery", "geoCenter", "maxPrice", "minBedrooms", "adults", "children", "maxPeriod", "sort", "estadoDestino",
    "typeFilter", "faixa", "dataEntrada", "datasFlexiveis", "garantia", "petsOnly", "petPorte", "furnishedOnly",
    "readyToLiveOnly", "homeOfficeOnly", "workLocatedOnly", "invoiceOnly", "operatedOnly", "negociaOnly",
    "precoJustoOnly", "comodidades", "internetMin", "soInternetMedida", "nivelMin", "niveis", "exemplosForcados",
  ];
  for (const k of chaves) assert.match(cliente, new RegExp(`useState(<[^>]*>)?\\(inicial\\.${k}\\)`), `estado ${k} nasce da URL`);
  // O efeito que restaurava a URL depois de montar saiu (era ele que pintava a lista sem filtro).
  assert.doesNotMatch(cliente, /restaurarFiltrosDaURL\(\);\n\s*\}, \[restaurarFiltrosDaURL\]\);/);
  // O voltar/avançar segue relendo a URL pela mesma função.
  assert.match(cliente, /const f = filtrosDaUrl\(window\.location\.search\);/);
  assert.match(cliente, /window\.addEventListener\("popstate", onPop\)/);
});
