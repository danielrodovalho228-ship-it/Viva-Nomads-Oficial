import { test } from "node:test";
import assert from "node:assert/strict";
import {
  squareCrop,
  outputSize,
  validarArquivoAvatar,
  avatarPath,
  MAX_AVATAR_PX,
  MAX_AVATAR_BYTES,
} from "./avatar-image.ts";

test("squareCrop: paisagem recorta laterais (centro)", () => {
  const c = squareCrop(1000, 600);
  assert.equal(c.size, 600);
  assert.equal(c.sx, 200); // (1000-600)/2
  assert.equal(c.sy, 0);
});

test("squareCrop: retrato recorta topo/baixo (centro)", () => {
  const c = squareCrop(600, 1000);
  assert.equal(c.size, 600);
  assert.equal(c.sx, 0);
  assert.equal(c.sy, 200);
});

test("squareCrop: já quadrado não recorta", () => {
  const c = squareCrop(800, 800);
  assert.deepEqual(c, { sx: 0, sy: 0, size: 800 });
});

test("outputSize: limita a MAX_AVATAR_PX", () => {
  assert.equal(outputSize(2000), MAX_AVATAR_PX);
  assert.equal(outputSize(300), 300); // menor que o teto passa direto
  assert.equal(outputSize(0), 0);
});

test("validarArquivoAvatar: aceita imagem dentro do limite", () => {
  assert.equal(validarArquivoAvatar({ type: "image/jpeg", size: 1_000_000 }), null);
  assert.equal(validarArquivoAvatar({ type: "image/webp", size: 500 }), null);
});

test("validarArquivoAvatar: rejeita não-imagem, vazio e grande demais", () => {
  assert.match(validarArquivoAvatar({ type: "application/pdf", size: 100 }) ?? "", /imagem/i);
  assert.match(validarArquivoAvatar({ type: "image/png", size: 0 }) ?? "", /vazio/i);
  assert.match(
    validarArquivoAvatar({ type: "image/png", size: MAX_AVATAR_BYTES + 1 }) ?? "",
    /grande/i
  );
});

test("avatarPath: 1ª pasta é o dono (casa com a RLS)", () => {
  assert.equal(avatarPath("abc-123"), "abc-123/avatar.webp");
});
