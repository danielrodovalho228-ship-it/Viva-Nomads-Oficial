import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");
const pagina = ler("../../app/(dashboard)/admin/usuarios/page.tsx");

test("E338 — as duas ações da linha são recusadas sempre ao observador (sem alvo)", () => {
  assert.match(ler("../data/conta-teste-actions.ts"), /recusaObservador\(\(await supabase\.auth\.getUser\(\)\)\.data\.user\?\.id\)/);
  assert.match(ler("../data/planos-actions.ts"), /recusaObservador\(user\.id\)/);
});

test("E338 — Admin → Usuários: o observador vê tipo e marca de teste em leitura, sem os controles (390 e 1280)", () => {
  assert.match(pagina, /observador = await ehObservadorQa\(user\.id\);/);
  assert.match(pagina, /\{observador && <SoLeituraQa className="mb-4" \/>\}/);
  // Celular (lista) e computador (tabela): os controles só fora do modo observador.
  assert.equal((pagina.match(/<TipoConta /g) ?? []).length, 2);
  assert.equal((pagina.match(/<BotaoContaTeste /g) ?? []).length, 2);
  assert.match(pagina, /\{observador \? \(\s+<p className="text-sm text-ink" data-testid="tipo-conta-leitura">/);
  assert.match(pagina, /observador \? \(\s+<span data-testid="tipo-conta-leitura">/);
  assert.match(pagina, /observador \? \(\s+<span data-testid="conta-teste-leitura">/);
});
