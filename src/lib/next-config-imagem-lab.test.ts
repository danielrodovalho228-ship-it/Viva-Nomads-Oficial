import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cfg = readFileSync("next.config.ts", "utf8");

// Next 16 devolve 400 no otimizador (/_next/image) para imagem em IP local. No laboratório as fotos
// ficam no Supabase local (127.0.0.1:54321): sem liberar, /cidades/uberlandia (imóveis de exemplo) gera
// console.error no t48. Em produção (host público) a liberação NUNCA pode existir.
test("IP local no otimizador de imagens só é liberado no laboratório", () => {
  assert.match(cfg, /dangerouslyAllowLocalIP:\s*LABORATORIO\b/);
});

test("não há liberação incondicional de IP local", () => {
  assert.doesNotMatch(cfg, /dangerouslyAllowLocalIP:\s*true/);
});
