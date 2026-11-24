/*
  E1051 — trava: a busca logada (conta de teste, com os anúncios de teste) devolvia conjuntos diferentes entre
  carregamentos — contagem igual, posições 6–12 trocando, um anúncio existente fora do 1.º carregamento.
  Causa: as fotos de TODOS os anúncios da busca vinham numa consulta só (`property_photos ... .in(ids).order(sort_order)`),
  e o PostgREST corta em `max_rows = 1000`. Com a lista da conta de teste (centenas de anúncios × ~8 fotos) o corte
  caía a meio, e QUAIS anúncios ficavam sem fotos dependia da ordem do heap (sort_order empata entre anúncios). Com
  menos fotos, o anúncio cai de faixa na relevância (comparaRelevancia usa photos.length) e troca de posição.
  Correção: a leitura das fotos vai em páginas, numa ordem total (property_id, sort_order, url), até a última página.
  Roda: node --test src/lib/data/e1051-busca-fotos-completas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerTodasAsLinhas } from "./leitura-paginada.ts";
import { comparaRelevancia } from "../busca/ordem-estavel.ts";

const MAX_ROWS = 1000;
type Foto = { property_id: string; url: string; sort_order: number };

// 300 anúncios × 8 fotos = 2400 linhas (> max_rows), como a lista da conta de teste.
const ids = Array.from({ length: 300 }, (_, i) => `p${String(i).padStart(3, "0")}`);
const todas: Foto[] = ids.flatMap((id) => Array.from({ length: 8 }, (_, k) => ({ property_id: id, url: `${id}-${k}.jpg`, sort_order: k })));

function embaralhar<T>(xs: T[], semente: number): T[] {
  const a = [...xs];
  let s = semente;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const ordemTotal = (x: Foto, y: Foto) =>
  x.property_id.localeCompare(y.property_id) || x.sort_order - y.sort_order || x.url.localeCompare(y.url);

/** Um PostgREST falso: ordem total pedida → páginas estáveis; sem pedido de faixa, corta em max_rows. */
function bancoFalso(semente: number) {
  const heap = embaralhar(todas, semente); // a ordem física muda entre carregamentos
  return async (de: number, ate: number) => {
    const ordenadas = [...heap].sort(ordemTotal);
    return { data: ordenadas.slice(de, Math.min(ate + 1, de + MAX_ROWS)), error: null };
  };
}

function vitrine(fotos: Foto[]) {
  const por = new Map<string, string[]>();
  for (const f of fotos) por.set(f.property_id, [...(por.get(f.property_id) ?? []), f.url]);
  return ids.map((id) => ({ id, photos: por.get(id) ?? [] })).sort(comparaRelevancia).map((p) => p.id);
}

test("E1051 — a leitura paginada traz TODAS as fotos, mesmo acima de max_rows", async () => {
  const linhas = await lerTodasAsLinhas<Foto>(bancoFalso(1));
  assert.equal(linhas.length, todas.length);
  for (const id of ids) assert.equal(linhas.filter((f) => f.property_id === id).length, 8, id);
});

test("E1051 — o mesmo conjunto e a mesma ordem em carregamentos repetidos (heap diferente a cada vez)", async () => {
  const primeira = vitrine(await lerTodasAsLinhas<Foto>(bancoFalso(1)));
  for (const semente of [2, 3, 4, 5, 6]) {
    assert.deepEqual(vitrine(await lerTodasAsLinhas<Foto>(bancoFalso(semente))), primeira, `carregamento ${semente}`);
  }
});

test("E1051 — a consulta de fotos da busca usa a leitura paginada, numa ordem total", () => {
  const props = readFileSync(new URL("./properties.ts", import.meta.url), "utf8");
  const capa = props.slice(props.indexOf("async function attachCoverPhotos("));
  const corpo = capa.slice(0, capa.indexOf("\n}\n"));
  assert.match(corpo, /lerTodasAsLinhas/);
  assert.match(corpo, /\.order\("property_id"\)\s*\.order\("sort_order"\)\s*\.order\("url"\)/);
  assert.match(corpo, /\.range\(de, ate\)/);
});
