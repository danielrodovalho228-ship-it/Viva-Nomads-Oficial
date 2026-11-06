/*
  E413 (reprova: "Unable to play media." na câmera do computador) — a câmera não pode "abrir" com tela preta:
  • se o play() do vídeo falha, tenta de novo uma vez (AbortError por troca de fluxo) e, falhando, mostra erro com saída;
  • a imagem só conta como ao vivo quando o vídeo tem largura (videoWidth > 0) dentro do prazo;
  • se a webcam recusa a restrição de frente/trás, tenta de novo com a câmera simples (video: true) antes de desistir.
  Roda: node --test src/lib/niveis/e413-camera-play.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { deveTentarCameraSimples, ERRO_IMAGEM_CAMERA, ESPERA_IMAGEM_MS, restricoesDaCamera } from "./prova-camera.ts";

const tela = readFileSync(new URL("../../components/niveis/camera-prova.tsx", import.meta.url), "utf8");

test("restrições: a 1ª tentativa prefere frente/trás (ideal, nunca exact); a 2ª é a câmera simples", () => {
  assert.deepEqual(restricoesDaCamera(false, 0), { video: { facingMode: { ideal: "environment" } }, audio: false });
  assert.deepEqual(restricoesDaCamera(true, 0), { video: { facingMode: { ideal: "user" } }, audio: false });
  assert.deepEqual(restricoesDaCamera(false, 1), { video: true, audio: false });
});

test("só erros de restrição/compatibilidade pedem a câmera simples; permissão e câmera ocupada, não", () => {
  for (const n of ["OverconstrainedError", "TypeError", "AbortError", "NotSupportedError"]) assert.equal(deveTentarCameraSimples(n), true, n);
  for (const n of ["NotAllowedError", "SecurityError", "NotFoundError", "NotReadableError", ""]) assert.equal(deveTentarCameraSimples(n), false, n);
});

test("o texto de erro da imagem tem saída clara e o prazo é curto", () => {
  assert.match(ERRO_IMAGEM_CAMERA, /Feche e tente de novo/);
  assert.ok(ESPERA_IMAGEM_MS >= 2000 && ESPERA_IMAGEM_MS <= 8000);
});

test("a tela não engole mais o erro do play() e confere a imagem antes de dizer 'ao vivo'", () => {
  assert.doesNotMatch(tela, /play\(\)\.catch\(\(\) => undefined\)/);
  assert.match(tela, /restricoesDaCamera\(frente, tentativa\)/);
  assert.match(tela, /deveTentarCameraSimples\(/);
  assert.match(tela, /videoWidth/);
  assert.match(tela, /ERRO_IMAGEM_CAMERA/);
});
