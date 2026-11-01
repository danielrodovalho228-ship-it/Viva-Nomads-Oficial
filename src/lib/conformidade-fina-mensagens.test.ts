import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contarPorFiltro } from "./mensagens-filtros.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("morador-mensagens: o imóvel da conversa em destaque (foto maior, título maior)", () => {
  const m = ler("app/(dashboard)/dashboard/mensagens/messages-client.tsx");
  assert.match(m, /className="h-16 w-20 shrink-0 rounded-lg object-cover" data-testid="conversa-contexto-foto"/);
  assert.match(m, /<p className="truncate font-title text-base font-semibold text-ink">\{active\.property\}<\/p>/);
});

test("varredura: as conversas de exemplo têm papel — as abas somam o total", () => {
  const src = ler("lib/data/messages.ts");
  const bloco = src.slice(src.indexOf("SAMPLE_CONVERSATIONS"), src.indexOf("interface MsgRow"));
  assert.equal((bloco.match(/papel: "proprietario"/g) ?? []).length, 2);
  const c = contarPorFiltro([{ papel: "proprietario" }, { papel: "proprietario" }]);
  assert.equal(c.todas, c.proprietario + c.inquilino + c.parceiros + c.suporte);
});
