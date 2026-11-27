/**
 * E461 (chat principal): no cartão "Imóveis fixos" do painel do parceiro, "Abrir minha página" levava a
 * /dashboard/parceiro — o próprio painel — e só recarregava a tela. Agora: com a página publicada, abre a página
 * pública (/parceiros/<slug>, em outra aba, como "Ver a página"); sem ela publicada, leva ao editor da página no painel
 * (#editor-pagina, a aba "Página", que já abre por padrão). Mesmo texto do botão. `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { destinoMinhaPagina } from "./minha-pagina.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("publicada → página pública em outra aba; senão → editor no painel", () => {
  assert.deepEqual(destinoMinhaPagina({ status: "publicado", slug: "limpeza-ana" }), { href: "/parceiros/limpeza-ana", novaAba: true });
  for (const status of ["rascunho", "pausado", "suspenso"])
    assert.deepEqual(destinoMinhaPagina({ status, slug: "limpeza-ana" }), { href: "/dashboard/parceiro#editor-pagina", novaAba: false }, status);
  assert.deepEqual(destinoMinhaPagina(null), { href: "/dashboard/parceiro#editor-pagina", novaAba: false });
  assert.equal(destinoMinhaPagina({ status: "publicado", slug: "a b" }).href, "/parceiros/a%20b");
});

test("o cartão usa o destino e nunca mais o painel sem âncora", () => {
  const c = ler("components/automacao/imoveis-fixos.tsx");
  assert.doesNotMatch(c, /href="\/dashboard\/parceiro"/);
  assert.match(c, /destinoMinhaPagina\(pagina\)/);
  assert.match(c, />\s*Abrir minha página\s*</);
  assert.match(ler("app/(dashboard)/dashboard/parceiro/page.tsx"), /<ImoveisFixos pagina=\{\{ status: painel\.status, slug: painel\.slug \}\} \/>/);
  assert.match(ler("app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx"), /id="editor-pagina"/);
});
