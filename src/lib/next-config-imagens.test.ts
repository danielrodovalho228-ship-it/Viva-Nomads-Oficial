import { test } from "node:test";
import assert from "node:assert/strict";

/*
  Laboratório: AVIF de foto larga estoura o tempo das specs de desktop (t119, t48). Só o
  laboratório (INTEGRACOES_SIMULADAS=on) usa WebP puro; sem a chave, a produção mantém AVIF + WebP.
*/
async function formatos(simulado: boolean): Promise<string[]> {
  const antes = process.env.INTEGRACOES_SIMULADAS;
  if (simulado) process.env.INTEGRACOES_SIMULADAS = "on";
  else delete process.env.INTEGRACOES_SIMULADAS;
  try {
    const m = await import(`../../next.config.ts?${simulado ? "lab" : "prod"}`);
    return m.default.images.formats;
  } finally {
    if (antes === undefined) delete process.env.INTEGRACOES_SIMULADAS;
    else process.env.INTEGRACOES_SIMULADAS = antes;
  }
}

test("laboratório serve só WebP (sem AVIF lento)", async () => {
  assert.deepEqual(await formatos(true), ["image/webp"]);
});

test("produção mantém AVIF e WebP", async () => {
  assert.deepEqual(await formatos(false), ["image/avif", "image/webp"]);
});
