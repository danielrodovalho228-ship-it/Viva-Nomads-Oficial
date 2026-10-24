/*
  Lentidão (ordem 0f66a754, item 5): nenhuma foto fixa do site (home, busca, login, painéis, galeria-modelo)
  passa de 200 KB. Foto pesada na primeira tela atrasa o LCP no celular.
  Roda: node --experimental-strip-types --test src/lib/peso-imagens.test.ts
*/
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { test } from "node:test";

const LIMITE = 200 * 1024;
const fonte = readFileSync(new URL("./media.ts", import.meta.url), "utf8");

/**
 * Cadastro 01-b (E87): as fotos dos cartões de tipo que o Daniel sobe no PR. Enquanto o arquivo não chegou, fica fora da
 * pesagem; quando chega, é pesado como as outras (e o teste abaixo pede para tirar daqui).
 */
const FOTOS_A_SUBIR = ["tipo-casa", "tipo-studio", "tipo-loft", "tipo-cobertura", "tipo-casa-condominio", "tipo-flat", "placeholder-imovel-chacara"].map(
  (n) => `/images/imoveis/${n}.webp`,
);
const existe = (c: string) => existsSync(new URL(`../../public${c}`, import.meta.url));

test("fotos a subir (01-b): só ficam na lista enquanto o arquivo não está no repositório", () => {
  assert.deepEqual(FOTOS_A_SUBIR.filter(existe), [], "o arquivo chegou: tire-o de FOTOS_A_SUBIR");
});

test("fotos de src/lib/media.ts pesam até 200 KB", () => {
  const H = "/images/home", A = "/images/auth", B = "/images/busca", D = "/images/dashboard", I = "/images/imoveis", C = "/cadastro";
  const base: Record<string, string> = { H, A, B, D, I, C };
  const caminhos = [...fonte.matchAll(/`\$\{([A-Z])\}(\/[\w./-]+\.webp)`|"(\/images\/[\w./-]+\.webp)"/g)].map((m) =>
    m[3] ?? `${base[m[1]]}${m[2]}`,
  );
  assert.ok(caminhos.length >= 20, `achou só ${caminhos.length} fotos`);
  const pesadas = caminhos
    .filter((c) => !(FOTOS_A_SUBIR.includes(c) && !existe(c)))
    .map((c) => ({ c, kb: Math.round(statSync(new URL(`../../public${c}`, import.meta.url)).size / 1024) }))
    .filter((x) => x.kb * 1024 > LIMITE);
  assert.deepEqual(pesadas, []);
});
