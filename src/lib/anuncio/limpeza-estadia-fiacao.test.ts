import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 4c74ac38, item 3: o pacote é validado no servidor e aparece no editor, no anúncio, na proposta e no contrato.
const f = (p: string) => readFileSync(p, "utf8");

test("a Server Action valida o pacote no servidor antes de gravar", () => {
  const a = f("src/lib/data/actions.ts");
  assert.match(a, /normalizarLimpezaEstadia\(input\.limpezaEstadia\)/);
  assert.match(a, /update\(\{ limpeza_estadia: pacote \}\)\.eq\("id", id\)\.eq\("owner_id", user\.id\)/);
});

test("leitura do anúncio é à parte (sem a migração a página abre igual)", () => {
  assert.match(f("src/lib/data/properties.ts"), /select\("limpeza_estadia"\)/);
});

test("editor e página do anúncio usam o pacote", () => {
  assert.match(f("src/app/(dashboard)/dashboard/imoveis/[id]/editar/editar-client.tsx"), /<LimpezaEstadiaCampos/);
  assert.match(f("src/components/property/stay-rules.tsx"), /textoLimpezaEstadia\(property\.limpezaEstadia\)/);
});
