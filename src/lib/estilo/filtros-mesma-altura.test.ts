import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (rel: string) => readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");

test("varredura 01/11: busca de parceiros — lista e campo de texto na mesma altura; Buscar na altura deles no computador", () => {
  const p = ler("app/(public)/parceiros/buscar/page.tsx");
  assert.match(p, /const campo = "mt-1 h-11 w-full rounded-lg/);
  assert.match(p, /lg:col-span-1 lg:h-11 lg:w-auto/);
});

test("varredura 01/11: filtros do admin (Usuários e Imóveis) — lista e campo de texto na mesma altura", () => {
  const u = ler("app/(dashboard)/admin/usuarios/page.tsx");
  assert.equal((u.match(/className="h-10 rounded-xl border border-line px-3 py-2 text-ink"/g) ?? []).length, 4);
  assert.doesNotMatch(u, /className="rounded-xl border border-line px-3 py-2 text-ink"/);
  assert.match(ler("app/(dashboard)/admin/imoveis/page.tsx"), /const campo = "h-10 rounded-xl border border-line px-3 py-2 text-sm text-ink";/);
});
