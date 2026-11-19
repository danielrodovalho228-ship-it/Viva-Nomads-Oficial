import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * E1027 (Gerente, ORDEM-DUET-119, 18/11/2026) — t197, caso do sitemap: o teto do teste era menor do que a espera que o
 * próprio teste pede.
 *
 * O sitemap tem cache de 60 s. O caso cria um anúncio e espera-o aparecer no sitemap, pedindo até 120 s de espera. Mas
 * corria com o teto padrão dos testes (45 s): se alguém tivesse lido o sitemap menos de 60 s antes, a cache só vencia
 * depois do teto e o teste morria a meio da espera ("Test timeout of 45000ms exceeded").
 *
 * A correção só dá ao teste o tempo que ele já pede. Nenhuma cobrança muda: o anúncio normal tem de entrar no sitemap
 * e o de teste tem de ficar de fora.
 */
const spec = readFileSync("tests/e2e/specs/t197-anuncio-teste-oculto.spec.ts", "utf8");
const inicio = spec.indexOf('test("sitemap.xml sem o anúncio de teste e com o anúncio normal"');
const fim = spec.indexOf('\n  test("', inicio + 1);
const caso = spec.slice(inicio, fim === -1 ? undefined : fim);
const ms = (texto: string) => Number(texto.replaceAll("_", ""));
const FOLGA_MS = 20_000; // o que o caso gasta fora da espera: os pedidos ao sitemap e a conferência final

test("o caso do sitemap existe e é um só", () => {
  assert.ok(inicio > 0, "não achei o caso do sitemap no t197");
  assert.equal(spec.split('test("sitemap.xml sem o anúncio de teste e com o anúncio normal"').length - 1, 1);
});

test("o teto do caso é maior do que a espera que ele pede", () => {
  const espera = caso.match(/\.poll\([\s\S]*?timeout: ([\d_]+)/);
  assert.ok(espera, "o caso deixou de esperar o anúncio normal com expect.poll");
  const teto = caso.match(/test\.setTimeout\(([\d_]+)\)/);
  assert.ok(teto, "o caso do sitemap corre com o teto padrão dos testes, menor do que a espera que ele pede");
  assert.ok(
    ms(teto[1]) >= ms(espera[1]) + FOLGA_MS,
    `teto de ${ms(teto[1])} ms para uma espera de ${ms(espera[1])} ms: o teste morre antes de a espera acabar`,
  );
});

test("a espera cobre a cache do sitemap", () => {
  const cache = readFileSync("src/app/sitemap.ts", "utf8").match(/export const revalidate = (\d+);/);
  assert.ok(cache, "não achei o tempo de cache do sitemap");
  const espera = caso.match(/\.poll\([\s\S]*?timeout: ([\d_]+)/);
  assert.ok(espera);
  assert.ok(ms(espera[1]) > Number(cache[1]) * 1000, "a espera é menor do que a cache do sitemap");
});

test("as duas cobranças do caso continuam: o anúncio normal entra e o de teste fica de fora", () => {
  assert.match(caso, /\.poll\(async \(\) => \(await lerLocs\(\)\)\.includes\(`\/imoveis\/\$\{ids\.normal\}`\)/);
  assert.match(caso, /\.toBe\(true\);/);
  assert.match(caso, /expect\(await lerLocs\(\)\)\.not\.toContain\(`\/imoveis\/\$\{ids\.teste\}`\);/);
  assert.doesNotMatch(caso, /test\.(skip|fixme|fail)\(/);
});
