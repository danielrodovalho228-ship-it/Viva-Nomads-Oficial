import { test } from "node:test";
import assert from "node:assert/strict";
import {
  VIDEO_MAX_BYTES,
  VIDEO_MAX_SEGUNDOS,
  validarVideoNoNavegador,
  tipoRealVideoPorMagicBytes,
  duracaoDoVideoSegundos,
  validarVideoNoServidor,
  caminhoVideoDoDono,
  caminhoNovoVideo,
  colunaVideoArquivo,
} from "./video-anuncio.ts";

const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const txt = (s: string) => [...s].map((c) => c.charCodeAt(0));
const box = (tipo: string, corpo: number[]) => [...u32(8 + corpo.length), ...txt(tipo), ...corpo];

/** MP4/MOV mínimo: ftyp + (moov com mvhd) — moov depois do mdat, como em vídeos de celular. */
function video({ marca = "isom", segundos = 30, timescale = 1000, v1 = false, moovAntes = false } = {}) {
  const ftyp = box("ftyp", [...txt(marca), ...u32(0), ...txt(marca)]);
  const dur = segundos * timescale;
  const mvhd = v1
    ? box("mvhd", [1, 0, 0, 0, ...Array(16).fill(0), ...u32(timescale), 0, 0, 0, 0, ...u32(dur)])
    : box("mvhd", [0, 0, 0, 0, ...u32(0), ...u32(0), ...u32(timescale), ...u32(dur)]);
  const moov = box("moov", mvhd);
  const mdat = box("mdat", Array(64).fill(7));
  return new Uint8Array(moovAntes ? [...ftyp, ...moov, ...mdat] : [...ftyp, ...mdat, ...moov]);
}

test("navegador: MP4 e MOV até 50 MB passam", () => {
  assert.equal(validarVideoNoNavegador({ type: "video/mp4", size: 10 * 1024 * 1024 }), null);
  assert.equal(validarVideoNoNavegador({ type: "video/quicktime", size: VIDEO_MAX_BYTES }), null);
});

test("navegador, negativo: passou de 50 MB, formato errado e arquivo vazio", () => {
  assert.match(validarVideoNoNavegador({ type: "video/mp4", size: VIDEO_MAX_BYTES + 1 }) ?? "", /50 MB/);
  assert.match(validarVideoNoNavegador({ type: "video/webm", size: 1000 }) ?? "", /MP4 ou MOV/);
  assert.match(validarVideoNoNavegador({ type: "application/pdf", size: 1000 }) ?? "", /MP4 ou MOV/);
  assert.ok(validarVideoNoNavegador({ type: "video/mp4", size: 0 }));
});

test("tipo real pelos primeiros bytes: mp4 e mov; texto, PDF e executável renomeados não", () => {
  assert.equal(tipoRealVideoPorMagicBytes(video()), "video/mp4");
  assert.equal(tipoRealVideoPorMagicBytes(video({ marca: "qt  " })), "video/quicktime");
  assert.equal(tipoRealVideoPorMagicBytes(new Uint8Array(txt("%PDF-1.7 não sou vídeo, só digo ser"))), null);
  assert.equal(tipoRealVideoPorMagicBytes(new Uint8Array(txt("MZ\u0090 executável"))), null);
  assert.equal(tipoRealVideoPorMagicBytes(new Uint8Array(3)), null);
});

test("duração lida do mvhd, com moov no fim ou no começo, versão 0 ou 1", () => {
  assert.equal(duracaoDoVideoSegundos(video({ segundos: 45 })), 45);
  assert.equal(duracaoDoVideoSegundos(video({ segundos: 12, moovAntes: true })), 12);
  assert.equal(duracaoDoVideoSegundos(video({ segundos: 59, v1: true, timescale: 600 })), 59);
});

test("duração, negativo: sem moov, moov truncado ou escala zero devolvem null", () => {
  const semMoov = new Uint8Array([...box("ftyp", txt("isom\0\0\0\0isom")), ...box("mdat", [1, 2, 3])]);
  assert.equal(duracaoDoVideoSegundos(semMoov), null);
  assert.equal(duracaoDoVideoSegundos(video().slice(0, 40)), null);
  assert.equal(duracaoDoVideoSegundos(video({ timescale: 0 })), null);
});

test("servidor: 60 s exatos passam; 61 s, arquivo falso e arquivo grande são recusados com mensagem em português", () => {
  const ok = validarVideoNoServidor(video({ segundos: VIDEO_MAX_SEGUNDOS }));
  assert.deepEqual(ok, { ok: true, tipo: "video/mp4", segundos: VIDEO_MAX_SEGUNDOS });

  const longo = validarVideoNoServidor(video({ segundos: VIDEO_MAX_SEGUNDOS + 1 }));
  assert.equal(longo.ok, false);
  assert.match(longo.ok ? "" : longo.erro, /60 segundos/);

  const falso = validarVideoNoServidor(new Uint8Array(txt("isto é texto renomeado para .mp4")));
  assert.equal(falso.ok, false);
  assert.match(falso.ok ? "" : falso.erro, /MP4 ou MOV/);

  const sem = validarVideoNoServidor(new Uint8Array([...box("ftyp", txt("isom\0\0\0\0isom")), ...box("mdat", [1])]));
  assert.equal(sem.ok, false);
  assert.match(sem.ok ? "" : sem.erro, /duração/);

  const grande = validarVideoNoServidor(video(), VIDEO_MAX_BYTES + 1);
  assert.equal(grande.ok, false);
  assert.match(grande.ok ? "" : grande.erro, /50 MB/);
});

test("caminho do vídeo do anúncio: só arquivo direto na pasta do próprio dono", () => {
  const dono = "11111111-1111-4111-8111-111111111111";
  assert.equal(caminhoVideoDoDono(`${dono}/abc.mp4`, dono), true);
  assert.equal(caminhoVideoDoDono(`${dono}/abc.mp4`, "22222222-2222-4222-8222-222222222222"), false); // terceiro
  assert.equal(caminhoVideoDoDono(`${dono}/sub/abc.mp4`, dono), false);
  assert.equal(caminhoVideoDoDono(`${dono}/../x.mp4`, dono), false);
  assert.equal(caminhoVideoDoDono(`${dono}/`, dono), false);
  assert.equal(caminhoVideoDoDono(undefined, dono), false);
  assert.equal(caminhoVideoDoDono(`${dono}/${"a".repeat(200)}`, dono), false);
  assert.match(caminhoNovoVideo(dono, "video/quicktime"), new RegExp(`^${dono}/[0-9a-f-]{36}\\.mov$`));
  assert.equal(caminhoNovoVideo(dono, "video/mp4", "x"), `${dono}/x.mp4`);
});

test("coluna video_arquivo: grava só do dono, '' remove, ausente/alheio não mexe", () => {
  const dono = "11111111-1111-4111-8111-111111111111";
  assert.deepEqual(colunaVideoArquivo(`${dono}/a.mp4`, dono), { video_arquivo: `${dono}/a.mp4` });
  assert.deepEqual(colunaVideoArquivo("", dono), { video_arquivo: null });
  assert.deepEqual(colunaVideoArquivo(undefined, dono), {});
  assert.deepEqual(colunaVideoArquivo("22222222-2222-4222-8222-222222222222/a.mp4", dono), {}); // pasta de outro
  assert.deepEqual(colunaVideoArquivo("https://x.com/v.mp4", dono), {});
});
