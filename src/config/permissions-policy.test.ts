/*
  Permissions-Policy: microfone e câmera liberados só para o próprio site
  (Caixa dos Sócios grava áudio; vistoria/fotos usam a câmera).
  Roda: node --test src/config/permissions-policy.test.ts
*/
import assert from "node:assert/strict";
import { test } from "node:test";

import nextConfig from "../../next.config.ts";

async function permissionsPolicy(): Promise<string> {
  const blocos = (await nextConfig.headers?.()) ?? [];
  for (const bloco of blocos) {
    const h = bloco.headers.find((x) => x.key === "Permissions-Policy");
    if (h) return h.value;
  }
  return "";
}

test("microfone liberado para o próprio site (Gravar áudio)", async () => {
  const p = await permissionsPolicy();
  assert.match(p, /microphone=\(self\)/);
  assert.doesNotMatch(p, /microphone=\(\)/);
});

test("câmera liberada para o próprio site e geolocalização mantida", async () => {
  const p = await permissionsPolicy();
  assert.match(p, /camera=\(self\)/);
  assert.match(p, /geolocation=\(self\)/);
});

test("nunca libera para terceiros (sem *)", async () => {
  assert.doesNotMatch(await permissionsPolicy(), /\*/);
});
