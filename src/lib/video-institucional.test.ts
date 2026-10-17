/* Roda: node --test src/lib/video-institucional.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { achadosNoTexto } from "./varredura-texto.ts";

const VTT = "public/media/institucional.pt-BR.vtt";

test("legenda do vídeo institucional é WebVTT válido (timestamps com 3 casas de milissegundo)", () => {
  const linhas = readFileSync(VTT, "utf8").replace(/^﻿/, "").split(/\r?\n/);
  assert.equal(linhas[0], "WEBVTT");
  const tempos = linhas.filter((l) => l.includes("-->"));
  assert.ok(tempos.length >= 5);
  const re = /^(\d{2}:)?\d{2}:\d{2}\.\d{3} --> (\d{2}:)?\d{2}:\d{2}\.\d{3}$/;
  for (const t of tempos) assert.match(t, re, t);
  // Em ordem e sem sobreposição.
  const seg = (s: string) => s.split(":").reduce((a, p) => a * 60 + Number(p), 0);
  let fim = 0;
  for (const t of tempos) {
    const [a, b] = t.split(" --> ").map(seg);
    assert.ok(a >= fim && b > a, t);
    fim = b;
  }
});

test("legenda no vocabulário da Viva e arquivos do player no tamanho certo", () => {
  const texto = readFileSync(VTT, "utf8");
  assert.deepEqual(achadosNoTexto(texto, { vocabulario: true, leis: true }), []);
  assert.doesNotMatch(texto, /aluguel|temporada|vistoria|apartamento|comiss[ãa]o/i);
  assert.ok(statSync("public/media/institucional.mp4").size < 6 * 1024 * 1024, "mp4 leve (< 6 MB)");
  assert.ok(statSync("public/media/institucional-poster.webp").size < 200 * 1024, "capa leve (< 200 KB)");
});
