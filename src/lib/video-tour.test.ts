import { test } from "node:test";
import assert from "node:assert/strict";
import { videoTourPermitido, resolverVideoTour, itensDaGaleria, ITEM_VIDEO } from "./video-tour.ts";
import { SAMPLE_PROPERTIES as exemplos } from "./properties.ts";
import { ROTULO_SELO_VIDEO } from "./card-selos.ts";

test("só provedores permitidos (YouTube e Vimeo, https) passam", () => {
  assert.equal(videoTourPermitido("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), true);
  assert.equal(videoTourPermitido("https://youtu.be/dQw4w9WgXcQ"), true);
  assert.equal(videoTourPermitido("https://vimeo.com/123456"), true);
});

test("caso negativo: outros domínios, http, javascript: e texto solto são recusados", () => {
  assert.equal(videoTourPermitido("http://youtu.be/dQw4w9WgXcQ"), false);
  assert.equal(videoTourPermitido("javascript:alert(1)"), false);
  assert.equal(videoTourPermitido("https://evil.com/video.mp4"), false);
  assert.equal(videoTourPermitido("https://youtube.com.evil.com/watch?v=a"), false);
  assert.equal(videoTourPermitido("meu video"), false);
  assert.equal(videoTourPermitido(""), false);
});

test("resolverVideoTour devolve o endereço de incorporação", () => {
  assert.equal(resolverVideoTour("https://youtu.be/dQw4w9WgXcQ"), "https://www.youtube.com/embed/dQw4w9WgXcQ");
  assert.equal(resolverVideoTour("https://www.youtube.com/watch?v=abcDEF_-123"), "https://www.youtube.com/embed/abcDEF_-123");
  assert.equal(resolverVideoTour("https://vimeo.com/987"), "https://player.vimeo.com/video/987");
  assert.equal(resolverVideoTour("https://evil.com/a"), null);
});

test("o vídeo é a 1ª peça da galeria; sem vídeo (ou vídeo inválido) a lista não muda", () => {
  assert.deepEqual(itensDaGaleria(["a", "b"], "https://youtu.be/dQw4w9WgXcQ"), [ITEM_VIDEO, "a", "b"]);
  assert.deepEqual(itensDaGaleria(["a", "b"], undefined), ["a", "b"]);
  assert.deepEqual(itensDaGaleria(["a"], "https://evil.com/x"), ["a"]);
});

test("o selo do cartão se chama 'Tour em vídeo'", () => {
  assert.equal(ROTULO_SELO_VIDEO, "Tour em vídeo");
});

test("trava: id do YouTube precisa ter 11 caracteres [A-Za-z0-9_-]; Vimeo, só dígitos", () => {
  assert.equal(videoTourPermitido("https://www.youtube.com/embed/demo-walkthrough"), false);
  assert.equal(videoTourPermitido("https://www.youtube.com/watch?v=demo-walkthrough"), false);
  assert.equal(videoTourPermitido("https://youtu.be/curto"), false);
  assert.equal(videoTourPermitido("https://youtu.be/dQw4w9WgXcQx"), false);
  assert.equal(videoTourPermitido("https://youtu.be/dQw4w9Wg.cQ"), false);
  assert.equal(videoTourPermitido("https://vimeo.com/abc"), false);
  assert.equal(videoTourPermitido("https://vimeo.com/123456789"), true);
  assert.deepEqual(itensDaGaleria(["a"], "https://www.youtube.com/watch?v=demo-walkthrough"), ["a"]);
});

test("nenhum anúncio de exemplo traz vídeo inventado (regra: nenhuma imagem que minta)", () => {
  for (const e of exemplos) {
    assert.ok(!e.videoUrl || videoTourPermitido(e.videoUrl), `${e.id} tem vídeo inválido`);
  }
  assert.equal(exemplos.find((e) => e.id === "ube-001")?.videoUrl, undefined);
});

test("galeria: vídeo enviado como arquivo também vira a 1ª peça", () => {
  assert.deepEqual(itensDaGaleria(["a"], undefined, true), [ITEM_VIDEO, "a"]);
  assert.deepEqual(itensDaGaleria(["a"], undefined, false), ["a"]);
});
