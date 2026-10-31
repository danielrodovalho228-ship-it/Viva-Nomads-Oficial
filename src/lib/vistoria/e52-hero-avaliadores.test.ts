/* E52 — o topo da página de avaliadores (/parceiros/avaliadores) no padrão das páginas institucionais.
   Roda: node --test src/lib/vistoria/e52-hero-avaliadores.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const PAGINA = "src/app/(public)/parceiros/avaliadores/page.tsx";

test("E52: BannerTopo com foto do acervo, rótulo, título e o Pedir credenciamento no banner", () => {
  const c = readFileSync(PAGINA, "utf8");
  const banner = c.match(/<BannerTopo[\s\S]*?<\/BannerTopo>/)?.[0] ?? "";
  assert.ok(banner, "a página abre com o BannerTopo");
  const foto = banner.match(/foto="([^"]+)"/)![1];
  assert.ok(existsSync(`public${foto}`), `foto do acervo: ${foto}`);
  assert.match(banner, /alt="[^"]{10,}"/);
  assert.match(banner, /eyebrow="Parceiros"/);
  assert.match(banner, /titulo="Seja avaliador credenciado"/);
  assert.match(banner, /variant="inverse" size="lg" data-testid="pedir-credenciamento"/);
  // O título não se repete fora do banner (um h1 só).
  assert.doesNotMatch(c.replace(banner, ""), /<h1\b/);
});
