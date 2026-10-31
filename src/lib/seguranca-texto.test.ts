import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Ordem 404cd213: página pública /seguranca sem "aluguel", "comissão" ou "vistoria".
test("/seguranca não usa aluguel, comissão nem vistoria em texto público", () => {
  const fonte = readFileSync(new URL("../app/(public)/seguranca/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(fonte, /alugu[eé]l|comiss[ãa]o|vistoria|corretagem|intermedia/i);
  assert.match(fonte, /valor mensal/);
});

test("conformidade (mockup publico-seguranca): /seguranca abre com o BannerTopo das institucionais, foto do acervo", async () => {
  const { existsSync } = await import("node:fs");
  const fonte = readFileSync(new URL("../app/(public)/seguranca/page.tsx", import.meta.url), "utf8");
  const banner = fonte.match(/<BannerTopo[\s\S]*?\/>/)?.[0] ?? "";
  assert.match(banner, /eyebrow="Sua segurança"/);
  assert.match(banner, /titulo="Morar com segurança na Viva Nomads"/);
  const foto = banner.match(/foto="([^"]+)"/)![1];
  assert.ok(existsSync(new URL(`../../public${foto}`, import.meta.url)), foto);
  assert.doesNotMatch(fonte.replace(banner, ""), /<h1\b/, "um h1 só");
});
