import { test } from "node:test";
import assert from "node:assert/strict";
import { videoTourPermitido, resolverVideoTour, itensDaGaleria, ITEM_VIDEO } from "./video-tour.ts";
import { ROTULO_SELO_VIDEO } from "./card-selos.ts";

test("só provedores permitidos (YouTube e Vimeo, https) passam", () => {
  assert.equal(videoTourPermitido("https://www.youtube.com/watch?v=abc123"), true);
  assert.equal(videoTourPermitido("https://youtu.be/abc123"), true);
  assert.equal(videoTourPermitido("https://vimeo.com/123456"), true);
});

test("caso negativo: outros domínios, http, javascript: e texto solto são recusados", () => {
  assert.equal(videoTourPermitido("http://youtu.be/abc123"), false);
  assert.equal(videoTourPermitido("javascript:alert(1)"), false);
  assert.equal(videoTourPermitido("https://evil.com/video.mp4"), false);
  assert.equal(videoTourPermitido("https://youtube.com.evil.com/watch?v=a"), false);
  assert.equal(videoTourPermitido("meu video"), false);
  assert.equal(videoTourPermitido(""), false);
});

test("resolverVideoTour devolve o endereço de incorporação", () => {
  assert.equal(resolverVideoTour("https://youtu.be/abc123"), "https://www.youtube.com/embed/abc123");
  assert.equal(resolverVideoTour("https://www.youtube.com/watch?v=xyz"), "https://www.youtube.com/embed/xyz");
  assert.equal(resolverVideoTour("https://vimeo.com/987"), "https://player.vimeo.com/video/987");
  assert.equal(resolverVideoTour("https://evil.com/a"), null);
});

test("o vídeo é a 1ª peça da galeria; sem vídeo (ou vídeo inválido) a lista não muda", () => {
  assert.deepEqual(itensDaGaleria(["a", "b"], "https://youtu.be/abc123"), [ITEM_VIDEO, "a", "b"]);
  assert.deepEqual(itensDaGaleria(["a", "b"], undefined), ["a", "b"]);
  assert.deepEqual(itensDaGaleria(["a"], "https://evil.com/x"), ["a"]);
});

test("o selo do cartão se chama 'Tour em vídeo'", () => {
  assert.equal(ROTULO_SELO_VIDEO, "Tour em vídeo");
});
