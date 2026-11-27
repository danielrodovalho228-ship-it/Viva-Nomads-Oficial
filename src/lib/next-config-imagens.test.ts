import { test } from "node:test";
import assert from "node:assert/strict";

/*
  Laboratório: AVIF de foto larga estoura o tempo das specs de desktop (t119, t48).
  E768 (reprova de 11/11, carga fria com fotos pendentes no anúncio, na /buscar, em /empresas e no catálogo): a produção
  também passa a WebP puro. A 1ª geração de cada foto pelo otimizador custava em média 2,74 s em AVIF contra 0,39 s em
  WebP (foto de 1920 px, medido com o acervo: docs/e768-fotos-carga-fria.md); numa página com várias fotos a fila de
  codificação deixava fotos pendentes na 1ª abertura e só o reload (já em cache) carregava tudo.
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

test("E768: produção também serve só WebP (a 1ª geração em AVIF deixava fotos pendentes na carga fria)", async () => {
  assert.deepEqual(await formatos(false), ["image/webp"]);
});
