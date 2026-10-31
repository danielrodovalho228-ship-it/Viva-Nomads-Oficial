import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IDIOMAS, IDIOMA_PADRAO } from "./idiomas.ts";
import { CHAVES_AMBIENTE } from "./chaves-ambiente.ts";

test("PUBLICO-A: o globo tem PT (padrão, disponível) e EN só 'em breve' — nada promete idioma que as telas não têm", () => {
  assert.deepEqual(IDIOMAS.map((i) => i.sigla), ["PT", "EN"]);
  assert.equal(IDIOMA_PADRAO.codigo, "pt");
  assert.deepEqual(IDIOMAS.filter((i) => i.disponivel).map((i) => i.codigo), ["pt"]);
});

test("PUBLICO-A: o globo fica atrás da chave SELETOR_IDIOMA, desligada por padrão e listada em /admin/sistema", () => {
  const flags = readFileSync("src/lib/flags.ts", "utf8");
  assert.match(flags, /export const SELETOR_IDIOMA = process\.env\.NEXT_PUBLIC_SELETOR_IDIOMA === "on";/);
  assert.ok(CHAVES_AMBIENTE.some((c) => c.nome === "SELETOR_IDIOMA" && c.variavel === "NEXT_PUBLIC_SELETOR_IDIOMA"));
  const navbar = readFileSync("src/components/layout/navbar.tsx", "utf8");
  assert.match(navbar, /SELETOR_IDIOMA && <SeletorIdioma/);
});
