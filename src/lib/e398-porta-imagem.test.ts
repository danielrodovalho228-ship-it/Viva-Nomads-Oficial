/* Roda: node --test src/lib/e398-porta-imagem.test.ts
  E398 (D-ISO8): o painel de imagem do /auth não fica cinza liso enquanto a foto carrega — mostra o borrão da própria
  foto. Na tela: t1665. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { AUTH_LATERAL, AUTH_LATERAL_BLUR, BRAND_BLUR } from "./media.ts";

test("E398: o borrão do painel é uma imagem WebP minúscula, não o cinza neutro", () => {
  assert.notEqual(AUTH_LATERAL_BLUR, BRAND_BLUR);
  assert.match(AUTH_LATERAL_BLUR, /^data:image\/webp;base64,/);
  const bytes = Buffer.from(AUTH_LATERAL_BLUR.split(",")[1], "base64");
  assert.equal(bytes.subarray(0, 4).toString("latin1"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("latin1"), "WEBP");
  assert.ok(bytes.length < 400, `vai dentro do HTML: tem de ser minúsculo (${bytes.length} bytes)`);
});

test("E398: o borrão foi gerado DESTA foto (se a foto mudar, gere o borrão de novo e atualize aqui)", () => {
  const foto = readFileSync(`public${AUTH_LATERAL}`);
  assert.equal(
    createHash("sha256").update(foto).digest("hex"),
    "1f1a9bedb15e775c09dfccaa351b113956a1cd2541c4b7393d65b2170801b67b",
    "public/media/auth-lateral.webp mudou: gere o AUTH_LATERAL_BLUR de novo (a receita está em src/lib/media.ts)",
  );
});

test("E398: a porta passa o borrão ao painel, e o componente usa o que recebeu (padrão: o neutro)", () => {
  const porta = readFileSync("src/app/auth/page.tsx", "utf8");
  assert.match(porta, /src=\{AUTH_LATERAL\}/);
  assert.match(porta, /blur=\{AUTH_LATERAL_BLUR\}/);
  const img = readFileSync("src/components/brand-image.tsx", "utf8");
  assert.match(img, /blur = BRAND_BLUR,/);
  assert.match(img, /blurDataURL=\{blur\}/);
});
