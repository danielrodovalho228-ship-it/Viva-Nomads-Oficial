import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("cadastro-imovel-01 (mockup): nome do tipo centrado e um passo maior", () => {
  assert.match(ler("app/(dashboard)/dashboard/imoveis/novo/etapa-tipo.tsx"), /px-3 py-3 text-center text-lg font-semibold text-ink">\{t\.rotulo\}/);
});

test("cadastro-imovel-02: 'Faltam N fotos' uma vez só (a trava embaixo já diz)", () => {
  const f = ler("app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx");
  // E417 (D8): a trava do cartão sai de avisoDaContagem (mesma conta do número); o "Faltam" do topo some quando ela fala.
  assert.match(f, /\{bloqueado && !aviso\.mensagem && \(/);
});
