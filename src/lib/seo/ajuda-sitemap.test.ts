import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEMAS_AJUDA, hrefDoTema } from "../ajuda/temas.ts";

const sitemap = readFileSync(new URL("../../app/sitemap.ts", import.meta.url), "utf8");

// E84 (resíduo de SEO): cada tema da Central tem página própria, canonical e FAQPage — e precisa estar no sitemap.
test("o sitemap lista a página de cada tema da Central de ajuda", () => {
  assert.ok(TEMAS_AJUDA.length > 0);
  assert.match(sitemap, /TEMAS_AJUDA\.map\(\(t\) => hrefDoTema\(t\.id\)\)/);
  for (const t of TEMAS_AJUDA) assert.match(hrefDoTema(t.id), /^\/ajuda\/[a-z0-9-]+$/);
});
