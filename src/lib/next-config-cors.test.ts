import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem "Missão 15→16/10 · Faixa A" item 3 (#126): /llms.txt, /llms-full.txt e /sitemap.xml
// saíam com "Access-Control-Allow-Origin: *" (a Vercel põe isso em saída estática).
const cfg = readFileSync("next.config.ts", "utf8");

test("llms.txt, llms-full.txt e sitemap.xml fixam a origem do site no CORS", () => {
  const fonte = cfg.match(/source: "\/:arquivo\(([^"]*)\)"/);
  assert.ok(fonte, "regra de cabeçalho dos arquivos estáticos ausente");
  assert.match(fonte[1], /llms\\\\\.txt/);
  assert.match(fonte[1], /llms-full\\\\\.txt/);
  assert.match(fonte[1], /sitemap\\\\\.xml/);
  assert.match(cfg, /Access-Control-Allow-Origin", value: "https:\/\/vivanomads\.com\.br"/);
});

test("nenhuma regra libera CORS '*'", () => {
  assert.doesNotMatch(cfg, /Access-Control-Allow-Origin",\s*value:\s*"\*"/);
});
