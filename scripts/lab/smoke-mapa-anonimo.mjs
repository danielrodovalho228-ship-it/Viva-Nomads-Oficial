#!/usr/bin/env node
/**
 * Ordem 64005753 — confere o mapa da /buscar numa sessão ANÔNIMA (navegador
 * limpo, sem cookies): todo tile da CARTO tem que sair com ?key= e nenhum pode
 * ser o tile carimbado "API KEY REQUIRED" (sempre o mesmo PNG de 2049 bytes).
 *
 * Uso: node scripts/lab/smoke-mapa-anonimo.mjs [url]   (padrão: https://vivanomads.com.br/buscar)
 * Precisa de internet. Sai com código 1 se achar tile sem chave ou carimbado.
 */
import { chromium } from "@playwright/test";

const URL_BUSCA = process.argv[2] ?? "https://vivanomads.com.br/buscar";
const TAMANHO_TILE_CARIMBADO = 2049;

const navegador = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
const pagina = await ctx.newPage();
const tiles = [];
pagina.on("response", async (r) => {
  const u = r.url();
  if (!/cartocdn\.com/.test(u)) return;
  let bytes = -1;
  try {
    bytes = (await r.body()).length;
  } catch {}
  tiles.push({ comChave: /[?&]key=/.test(u), bytes });
});
await pagina.goto(URL_BUSCA, { waitUntil: "networkidle" });
await pagina.waitForTimeout(3000);
const cookies = (await ctx.cookies()).length;
await navegador.close();

const semChave = tiles.filter((t) => !t.comChave).length;
const carimbados = tiles.filter((t) => t.bytes === TAMANHO_TILE_CARIMBADO).length;
console.log(`${URL_BUSCA}: ${tiles.length} tiles · sem chave: ${semChave} · carimbados: ${carimbados} · cookies na sessão: ${cookies}`);
if (tiles.length === 0 || semChave > 0 || carimbados > 0) {
  console.error("FALHOU: o mapa anônimo não está limpo.");
  process.exit(1);
}
console.log("OK: mapa anônimo limpo (todos os tiles com chave, nenhum carimbado).");
