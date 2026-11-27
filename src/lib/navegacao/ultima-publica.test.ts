import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoVoltarAoSite, ehRotaPublica } from "./ultima-publica.ts";

test("E784: vindo de um anúncio, volta ao mesmo anúncio (com a busca de origem preservada)", () => {
  assert.equal(destinoVoltarAoSite("/imoveis/ube-003"), "/imoveis/ube-003");
  assert.equal(destinoVoltarAoSite("/imoveis/ube-003?entrada=2026-12-01"), "/imoveis/ube-003?entrada=2026-12-01");
});
test("E784: vindo da home, volta à home; vindo da busca, volta à busca (só se ela era a página anterior)", () => {
  assert.equal(destinoVoltarAoSite("/"), "/");
  assert.equal(destinoVoltarAoSite("/buscar?q=uberlandia"), "/buscar?q=uberlandia");
});
test("E784: entrada direta no admin (nada guardado) sai para a home, nunca /buscar", () => {
  for (const v of [null, undefined, ""]) assert.equal(destinoVoltarAoSite(v), "/");
});
test("E784: rotas do painel, do admin, da porta de entrada e de API nunca viram destino; nem URL de outro site", () => {
  for (const r of ["/admin/avaliadores", "/dashboard", "/auth", "/api/x", "//evil.com", "https://evil.com", "buscar"]) {
    assert.equal(ehRotaPublica(r), false, r);
    assert.equal(destinoVoltarAoSite(r), "/", r);
  }
});
test("o admin usa o componente novo, o site público grava a rota, e o link fixo '/' saiu do shell", () => {
  const shell = readFileSync(new URL("../../components/layout/dashboard-shell.tsx", import.meta.url), "utf8");
  assert.match(shell, /<VoltarAoSite \/>/);
  assert.doesNotMatch(shell, /<Link href="\/"[^>]*admin-voltar-site/);
  assert.match(readFileSync(new URL("../../app/(public)/layout.tsx", import.meta.url), "utf8"), /<RastroPublico \/>/);
});
