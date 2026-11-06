/* Roda: node --test src/lib/fotos/rotulo-placeholder.test.ts — E374: o placeholder não mostra nome de arquivo nem texto de QA. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rotuloSeguroDaFoto } from "./rotulo-placeholder.ts";

test("E374: texto de QA e nome de arquivo nunca aparecem", () => {
  for (const t of ["Foto QA Premium 1 - Sala", "[TESTE QA] Carteira 3", "sala-ampla.webp", "IMG_0042.jpg", "ube-001-sala.webp", "/images/imoveis/ube-001-sala.webp", "https://x.com/a.jpg", "teste qa sala"]) {
    assert.equal(rotuloSeguroDaFoto(t), undefined, t);
  }
});

test("E374: a descrição legítima da foto segue aparecendo; vazio e nulo, nada", () => {
  assert.equal(rotuloSeguroDaFoto("Sala ampla com varanda"), "Sala ampla com varanda");
  assert.equal(rotuloSeguroDaFoto("  Quarto   com   janela "), "Quarto com janela");
  assert.equal(rotuloSeguroDaFoto(""), undefined);
  assert.equal(rotuloSeguroDaFoto(null), undefined);
});

test("E374: o PhotoPlaceholder passa o rótulo pelo filtro", () => {
  const c = readFileSync("src/components/ui/photo-placeholder.tsx", "utf8");
  assert.match(c, /rotuloSeguroDaFoto\(label\) && \(/);
  assert.match(c, /import \{ rotuloSeguroDaFoto \} from "@\/lib\/fotos\/rotulo-placeholder";/);
});
