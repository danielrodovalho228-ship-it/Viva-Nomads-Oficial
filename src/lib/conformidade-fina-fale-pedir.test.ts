import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("pagina-fale-com-a-viva (mockup): títulos dos cartões laterais em verde, um passo maior", () => {
  const f = ler("app/(public)/ajuda/fale-com-a-viva/page.tsx");
  assert.equal((f.match(/<h2 className="flex items-center gap-2 font-title text-xl font-semibold text-forest">/g) ?? []).length, 2);
});

test("morador-pedir (mockup): título do formulário em verde", () => {
  assert.match(ler("app/(public)/pedidos/novo/page.tsx"), /font-title text-2xl font-semibold text-forest md:text-\[1\.75rem\]">\{editarId \? "Editar seu pedido" : "Publique seu pedido"\}/);
});
