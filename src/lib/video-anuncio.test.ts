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

// ── 65-B: vídeo alcançável pelo dono ───────────────────────────────────────────────────────────────────────────────
import { videoDoAnuncio, resumoDoVideo, payloadDoVideo, segundosDoCaminho, formatarDuracao, erroDoLinkDeVideo, TEXTO_LIMITES_VIDEO } from "./video-anuncio.ts";

const DONO = "11111111-1111-4111-8111-111111111111";

test("65-B videoDoAnuncio: arquivo, depois link, depois nada (uma fonte só)", () => {
  const yt = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  assert.deepEqual(videoDoAnuncio({ videoArquivo: `${DONO}/a.mp4`, videoUrl: yt }), { tipo: "arquivo", caminho: `${DONO}/a.mp4` });
  assert.deepEqual(videoDoAnuncio({ videoArquivo: "", videoUrl: yt }), { tipo: "link", url: yt, provedor: "YouTube" });
  assert.equal(videoDoAnuncio({ videoUrl: "https://vimeo.com/123456" }).tipo, "link");
  assert.deepEqual(videoDoAnuncio({ videoUrl: "https://evil.com/x.mp4" }), { tipo: null });
  assert.deepEqual(videoDoAnuncio({}), { tipo: null });
  assert.deepEqual(videoDoAnuncio({ videoArquivo: null, videoUrl: null }), { tipo: null });
});

test("65-B a duração vai no nome do arquivo e volta no resumo da seção", () => {
  const p = caminhoNovoVideo(DONO, "video/mp4", "abc", 42);
  assert.equal(p, `${DONO}/abc-42s.mp4`);
  assert.equal(caminhoNovoVideo(DONO, "video/quicktime", "abc", 10), `${DONO}/abc-10s.mov`);
  assert.equal(caminhoNovoVideo(DONO, "video/mp4", "abc"), `${DONO}/abc.mp4`, "sem duração: nome antigo");
  assert.equal(caminhoNovoVideo(DONO, "video/mp4", "abc", 90), `${DONO}/abc.mp4`, "duração fora do limite não vai no nome");
  assert.ok(caminhoVideoDoDono(p, DONO), "continua na pasta do dono");
  assert.equal(segundosDoCaminho(p), 42);
  assert.equal(segundosDoCaminho(`${DONO}/abc.mp4`), null);
  assert.equal(formatarDuracao(42), "00:42");
  assert.equal(formatarDuracao(60), "01:00");
  assert.equal(resumoDoVideo({ videoArquivo: p }), "Vídeo enviado (00:42)");
  assert.equal(resumoDoVideo({ videoArquivo: `${DONO}/antigo.mp4` }), "Vídeo enviado");
  assert.equal(resumoDoVideo({ videoUrl: "https://youtu.be/dQw4w9WgXcQ" }), "Link do YouTube");
  assert.equal(resumoDoVideo({ videoUrl: "https://vimeo.com/123456" }), "Link do Vimeo");
  assert.equal(resumoDoVideo({}), "Sem vídeo (opcional)");
});

test("65-B payload do editor grava o videoArquivo e o videoUrl NOVOS (não repete o antigo)", () => {
  assert.deepEqual(payloadDoVideo({ videoArquivo: `${DONO}/novo-12s.mp4`, videoUrl: " https://youtu.be/dQw4w9WgXcQ " }), {
    videoArquivo: `${DONO}/novo-12s.mp4`,
    videoUrl: "https://youtu.be/dQw4w9WgXcQ",
  });
  // Remover: "" vai ao servidor e a coluna vira null; link vazio também grava null.
  const vazio = payloadDoVideo({ videoArquivo: "", videoUrl: "" });
  assert.deepEqual(vazio, { videoArquivo: "", videoUrl: undefined });
  assert.deepEqual(colunaVideoArquivo(vazio.videoArquivo, DONO), { video_arquivo: null });
});

test("65-B mensagens: texto fixo dos limites, link que não é YouTube/Vimeo e os negativos chegam com o texto certo", () => {
  assert.equal(TEXTO_LIMITES_VIDEO, "Até 60 segundos e 50 MB, em MP4 ou MOV. Grave pelo celular mostrando o imóvel por dentro. Sem pessoas no vídeo.");
  assert.equal(erroDoLinkDeVideo(""), null);
  assert.equal(erroDoLinkDeVideo("https://youtu.be/dQw4w9WgXcQ"), null);
  assert.equal(erroDoLinkDeVideo("https://evil.com/v"), "Use um link do YouTube ou do Vimeo.");
  // .avi renomeado para .mp4: o navegador acredita na extensão, a leitura dos bytes não.
  const avi = new Uint8Array([...txt("RIFF"), 0, 0, 0, 0, ...txt("AVI LIST"), ...Array(32).fill(0)]);
  assert.equal(validarVideoNoNavegador({ type: "video/mp4", size: avi.length }), null);
  assert.deepEqual(validarVideoNoServidor(avi), { ok: false, erro: "Envie o vídeo em MP4 ou MOV." });
  assert.deepEqual(validarVideoNoServidor(video({ segundos: 70 })), { ok: false, erro: "O vídeo deve ter no máximo 60 segundos." });
  assert.deepEqual(validarVideoNoServidor(video(), 55 * 1024 * 1024), { ok: false, erro: "O vídeo deve ter no máximo 50 MB." });
  const semMoov = new Uint8Array(box("ftyp", [...txt("isom"), ...u32(0), ...txt("isom")]));
  assert.match((validarVideoNoServidor(semMoov) as { erro: string }).erro, /duração/);
});
