/*
  Pacote Otávio 09/10 (#36, #37, #38): SEO e rótulos das páginas públicas.
  Roda: node --test src/lib/paginas-publicas-seo.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paginaInstitucional } from "./seo/estruturados.ts";

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("#38: /excluir-conta não é indexada", () => {
  const s = ler("app/(public)/excluir-conta/page.tsx");
  assert.match(s, /robots:\s*\{\s*index:\s*false/);
});

test("#38: /como-funciona e /empresas têm JSON-LD válido e seguro", () => {
  for (const p of ["app/(public)/como-funciona/page.tsx", "app/(public)/empresas/page.tsx"]) {
    assert.match(ler(p), /<JsonLd dados=\{paginaInstitucional\(/, p);
  }
  const d = paginaInstitucional("https://vivanomads.com.br", { caminho: "/empresas", nome: "Para empresas", descricao: "Texto" });
  assert.equal(d["@type"], "WebPage");
  assert.equal(d.url, "https://vivanomads.com.br/empresas");
  assert.equal(d.isPartOf.url, "https://vivanomads.com.br");
});

test("#36: /cidades existe e redireciona 308; title de /precos é descritivo (<= 60)", () => {
  const c = ler("app/(public)/cidades/page.tsx");
  assert.match(c, /permanentRedirect\(["'`]\/cidades\/uberlandia["'`]\)/);
  const p = ler("app/(public)/precos/page.tsx");
  const m = p.match(/title:\s*"([^"]+)"/);
  assert.ok(m);
  assert.match(m![1], /imóveis mobiliados/i);
  assert.ok(m![1].length <= 60, `title com ${m![1].length} caracteres`);
});

test("#37: botões que levam a /qualificar dizem que vão entrar antes (visitante)", () => {
  const nav = ler("components/layout/navbar.tsx");
  assert.match(nav, /Entrar para anunciar/);
  const foot = ler("components/layout/footer.tsx");
  assert.match(foot, /Anunciar imóvel \(com login\)/);
});
