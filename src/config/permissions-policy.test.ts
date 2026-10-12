import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const fonte = readFileSync("next.config.ts", "utf8");
const linha = fonte.split("\n").find((l) => l.includes('"Permissions-Policy"')) ?? "";

test("Permissions-Policy libera microfone e câmera para o próprio site", () => {
  assert.match(linha, /microphone=\(self\)/);
  assert.match(linha, /camera=\(self\)/);
});

test("Permissions-Policy não bloqueia mais microfone/câmera", () => {
  assert.doesNotMatch(linha, /microphone=\(\)/);
  assert.doesNotMatch(linha, /camera=\(\)/);
});
