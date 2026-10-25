/* Roda: node --test src/lib/busca/base-da-busca-e131.test.ts
   E131 (crítico): a /buscar mostrava "1 imóvel" e as pílulas contavam 14. Guarda permanente: a lista sem filtro e as
   contagens partem da MESMA base; nenhuma contagem passa do total da lista sem filtro. A regra do Prompt 30 (com imóvel
   real na busca, os exemplos saem) continua igual — só é decidida uma vez, sobre a base. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseDaBusca, contarNaBase, semExemplosQuandoHaReal } from "./exemplos-e-pedido.ts";
import { contarAtalho } from "./atalhos-contagem.ts";
import type { passaNoPainel } from "./painel-filtros.ts";

type Im = { id: string; pronto: boolean; quartos: number };
const ehEx = (p: { id: string }) => p.id.startsWith("ube-");
const real: Im = { id: "real-1", pronto: false, quartos: 2 };
const exemplos: Im[] = Array.from({ length: 14 }, (_, i) => ({ id: `ube-${i}`, pronto: true, quartos: 1 + (i % 3) }));
const FACETAS: Array<(p: Im) => boolean> = [(p) => p.pronto, (p) => p.quartos >= 3, (p) => p.quartos >= 2, () => true];

function conferir(base: Im[], forcar = false) {
  const visivel = baseDaBusca(base, ehEx, forcar);
  const totalLista = contarNaBase(visivel, () => true);
  for (const f of FACETAS) assert.ok(contarNaBase(visivel, f) <= totalLista, "nenhuma contagem passa do total da lista sem filtro");
  return { visivel, totalLista };
}

test("com 1 imóvel real: a lista e todas as contagens ficam no real (antes: lista 1 × pílula 14)", () => {
  const { totalLista } = conferir([real, ...exemplos]);
  assert.equal(totalLista, 1);
  const visivel = baseDaBusca([real, ...exemplos], ehEx);
  assert.equal(contarNaBase(visivel, (p) => p.pronto), 0);
});

test("sem imóvel real (ex.: o RETESTE marcado '[TESTE]'): a demonstração inteira, na lista e nas contagens", () => {
  const { totalLista } = conferir(exemplos);
  assert.equal(totalLista, 14);
  assert.equal(contarNaBase(baseDaBusca(exemplos, ehEx), (p) => p.pronto), 14);
});

test("a regra do Prompt 30 continua a mesma; ?exemplos=1 mantém tudo", () => {
  assert.deepEqual(baseDaBusca([real, ...exemplos], ehEx), semExemplosQuandoHaReal([real, ...exemplos], ehEx));
  assert.equal(conferir([real, ...exemplos], true).totalLista, 15);
});

test("a /buscar usa a MESMA base na lista e em todas as contagens (pílulas, facetas, 'Mostrar N', internet)", () => {
  const s = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  assert.match(s, /const baseVisivel = useMemo\(\(\) => baseDaBusca\(base, \(p\) => isExemplo\(p\.id\), exemplosForcados\)/);
  assert.match(s, /const contarComPainel = useCallback\(\(f: FiltrosPainel\) => contarNaBase\(baseVisivel, \(p\) => passaNoPainel\(p, f\)\), \[baseVisivel\]\);/);
  assert.match(s, /let list = baseVisivel\.filter\(\(p\) => passaNoPainel\(p, filtrosPainel\)\);/);
  assert.match(s, /medicoesDaBusca\(baseVisivel\)/);
  assert.doesNotMatch(s, /semExemplosQuandoHaReal/, "a regra não é reaplicada por recorte");
});

test("atalhos da home: a mesma sequência (com 1 real fora do atalho, os exemplos não voltam no atalho)", () => {
  const im = (id: string, monthlyPrice: number, bedrooms: number) =>
    ({ id, monthlyPrice, bedrooms, neighborhood: "Centro", city: "Uberlândia", maxGuests: 2 }) as unknown as Parameters<typeof passaNoPainel>[0] & { id: string; neighborhood: string; city: string };
  const lista = [im("real-1", 5000, 2), ...Array.from({ length: 5 }, (_, i) => im(`ube-${i}`, 2500, 1))];
  assert.equal(contarAtalho("/buscar?preco=3000", lista, ehEx), 0);
  assert.equal(contarAtalho("/buscar?preco=3000", lista.slice(1), ehEx), 5);
});
