/*
  Lentidão (ordem 0f66a754, item 5): nenhuma foto fixa do site (home, busca, login, painéis, galeria-modelo)
  passa de 200 KB. Foto pesada na primeira tela atrasa o LCP no celular.
  Roda: node --experimental-strip-types --test src/lib/peso-imagens.test.ts
*/
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { test } from "node:test";

const LIMITE = 200 * 1024;
const fonte = readFileSync(new URL("./media.ts", import.meta.url), "utf8");

test("fotos de src/lib/media.ts pesam até 200 KB", () => {
  const H = "/images/home", A = "/images/auth", B = "/images/busca", D = "/images/dashboard", I = "/images/imoveis", C = "/cadastro";
  const base: Record<string, string> = { H, A, B, D, I, C };
  const caminhos = [...fonte.matchAll(/`\$\{([A-Z])\}(\/[\w./-]+\.webp)`|"(\/images\/[\w./-]+\.webp)"/g)].map((m) =>
    m[3] ?? `${base[m[1]]}${m[2]}`,
  );
  assert.ok(caminhos.length >= 20, `achou só ${caminhos.length} fotos`);
  const pesadas = caminhos
    .map((c) => ({ c, kb: Math.round(statSync(new URL(`../../public${c}`, import.meta.url)).size / 1024) }))
    .filter((x) => x.kb * 1024 > LIMITE);
  assert.deepEqual(pesadas, []);
});
