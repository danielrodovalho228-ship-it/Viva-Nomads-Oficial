/* Roda: node --test src/lib/admin/paginas.test.ts — E281: contagens do admin sem o corte de 1.000 linhas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LINHAS_POR_PAGINA, todasAsPaginas } from "./paginas.ts";

/** Banco falso que corta cada resposta em `teto` linhas, como o PostgREST com max_rows. */
function bancoFalso(total: number, teto = 1000) {
  const linhas = Array.from({ length: total }, (_, i) => ({ id: i + 1, tipo: i % 30 === 0 ? "ver_anuncio" : "busca" }));
  const pedidos: [number, number][] = [];
  const pagina = async (de: number, ate: number) => {
    pedidos.push([de, ate]);
    return { data: linhas.slice(de, Math.min(ate + 1, de + teto)), error: null };
  };
  return { linhas, pedidos, pagina };
}

test("E281: lê todas as páginas (6.529 buscas não viram 1.000)", async () => {
  const b = bancoFalso(6750);
  const todas = await todasAsPaginas<{ id: number; tipo: string }>(b.pagina);
  assert.equal(todas.length, 6750);
  assert.deepEqual(todas.map((l) => l.id), b.linhas.map((l) => l.id));
  assert.equal(b.pedidos.length, 7);
  assert.deepEqual(b.pedidos[0], [0, LINHAS_POR_PAGINA - 1]);
  assert.deepEqual(b.pedidos[6], [6000, 6999]);
  assert.equal(LINHAS_POR_PAGINA, 1000);
  // O teto da página bate com o max_rows do servidor (se o max_rows mudar, a página muda junto).
  assert.match(readFileSync("supabase/config.toml", "utf8"), /^max_rows = 1000$/m);
});

test("E281: exato múltiplo de 1.000, vazio e erro", async () => {
  const b = bancoFalso(2000);
  assert.equal((await todasAsPaginas(b.pagina)).length, 2000);
  assert.equal(b.pedidos.length, 3);
  assert.deepEqual(await todasAsPaginas(bancoFalso(0).pagina), []);
  let n = 0;
  const comErro = async () => (n++ === 0 ? { data: Array.from({ length: 1000 }, (_, i) => i), error: null } : { data: null, error: { message: "x" } });
  assert.equal((await todasAsPaginas(comErro)).length, 1000);
});

test("E281: /admin/eventos e /admin/funil contam pela MESMA leitura paginada, em ordem estável", () => {
  const ind = readFileSync("src/lib/data/admin-indicadores.ts", "utf8");
  const fn = ind.slice(ind.indexOf("export async function eventosDoPeriodoComFora"));
  assert.match(fn, /\.order\("id", \{ ascending: true \}\)\.range\(de, ate\)/);
  assert.match(fn, /todasAsPaginas</);
  assert.doesNotMatch(fn.slice(0, fn.indexOf("\n}\n")), /\.limit\(/);
  // As duas telas passam pela mesma leitura (a lista por dia, com os de teste contados à parte — E288-B — e os x_ev_* do funil).
  assert.match(readFileSync("src/app/(dashboard)/admin/eventos/page.tsx", "utf8"), /eventosDoPeriodoComFora\(admin, intervaloBRT\(p\.inicio, p\.fim\), cidade, \[tipo\]\)/);
  assert.match(ind, /eventosDoPeriodo\(admin, periodo, cidade, Object\.keys\(EVENTOS_HOME\)\)/);
});
