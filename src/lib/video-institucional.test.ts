/* Roda: node --test src/lib/video-institucional.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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

test("varredura 31/10: sem arcos escuros nos cantos arredondados (a caixa não tem fundo escuro)", () => {
  const c = readFileSync("src/components/institucional/video-institucional.tsx", "utf8");
  assert.doesNotMatch(c, /rounded-xl[^"]*bg-night"/);
});

test("E295: a capa é um quadro do meio do vídeo (16:9), nunca o cartão final branco", () => {
  const b = readFileSync("public/media/institucional-poster.webp");
  assert.equal(b.subarray(0, 4).toString(), "RIFF");
  assert.equal(b.subarray(8, 12).toString(), "WEBP");
  // VP8 (lossy): largura e altura em 14 bits a partir do byte 26.
  const w = b.readUInt16LE(26) & 0x3fff, h = b.readUInt16LE(28) & 0x3fff;
  assert.equal(w * 9, h * 16, `${w}x${h} é 16:9`);
  // A capa é o quadro de 12,5 s (ffmpeg -ss 12.5 -i institucional.mp4 -frames:v 1). O cartão final branco (a capa
  // antiga) nunca volta; trocar a capa pede revisão (o hash muda).
  const sha = createHash("sha256").update(b).digest("hex");
  assert.notEqual(sha, "dfc9ea5803074aabff9a3b89b933f6728c98db7b8814c49e170fab798a7fa79a", "a capa voltou a ser o cartão final branco");
  assert.equal(sha, "7631ec43a9010be4b37846260837c4a59f297e935f432f2f9af7f6be1fdb3fd5", "capa aprovada (E295)");
});

test("E295: moldura, play grande no verde com anel de contraste, selo da duração, 16:9 — só apresentação", () => {
  const c = readFileSync("src/components/institucional/video-institucional.tsx", "utf8");
  assert.match(c, /className="relative mt-4 aspect-video overflow-hidden rounded-xl border-2 border-line bg-white"\s+data-testid="video-institucional-caixa"/);
  assert.match(c, /data-testid="video-institucional-play"/);
  assert.match(c, /rounded-full bg-forest text-white ring-4 ring-white[^"]*h-16 w-16|h-16 w-16 place-items-center rounded-full bg-forest text-white ring-4 ring-white/);
  assert.match(c, /data-testid="video-institucional-duracao"/);
  assert.match(c, /duracao: "0:33"/);
  // O vídeo em si não muda: mesmos arquivos, sem autoplay, preload none, legenda padrão.
  assert.match(c, /preload="none"/);
  assert.match(c, /controls=\{tocou\}/, "controles nativos só depois do play");
  assert.doesNotMatch(c, /autoPlay/);
  assert.match(c, /mp4: "\/media\/institucional\.mp4"/);
});
