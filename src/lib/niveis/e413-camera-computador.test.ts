/*
  E413 — provas da Qualificação no computador: além do QR para o celular, a câmera do PRÓPRIO computador (foto ao vivo,
  na hora). A regra antifraude do FOTO-NA-HORA não muda: nada de arquivo nem galeria; o token de uso único segue igual.
  Roda: node --test src/lib/niveis/e413-camera-computador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BOTAO_CAMERA_COMPUTADOR, temCameraNaLista } from "./prova-camera.ts";

const tela = readFileSync(new URL("../../components/niveis/camera-prova.tsx", import.meta.url), "utf8");

test("câmera do computador só aparece quando a lista de aparelhos tem uma câmera", () => {
  assert.equal(temCameraNaLista([{ kind: "audioinput" }, { kind: "videoinput" }]), true);
  assert.equal(temCameraNaLista([{ kind: "audioinput" }]), false);
  assert.equal(temCameraNaLista([]), false);
  assert.equal(temCameraNaLista(null), false);
  assert.equal(BOTAO_CAMERA_COMPUTADOR, "Usar a câmera deste computador");
});

test("no computador, a caixa do QR oferece a câmera deste computador e ela abre a MESMA câmera da prova (CameraProva)", () => {
  assert.match(tela, /const celular = \(modo === "celular" \|\| cameraComputador\) && !semCamera;/);
  assert.match(tela, /onUsarCameraDoComputador=\{semCamera \? undefined : \(\) => setCameraComputador\(true\)\}/);
  assert.match(tela, /\{temCamera && onUsarCameraDoComputador && \([\s\S]*?data-testid="prova-camera-computador-botao"/);
  // Sem câmera de verdade (permissão negada, sem aparelho), volta para o QR.
  assert.match(tela, /onSemCamera=\{\(\) => \{\s*setSemCamera\(true\);\s*setCameraComputador\(false\);/);
  // A câmera aceita a webcam do computador (facingMode "ideal", nunca "exact").
  assert.match(tela, /facingMode: \{ ideal:/);
  assert.doesNotMatch(tela, /facingMode: \{ exact:/);
});

test("regra antifraude intacta: nenhum campo de arquivo, a foto sai do vídeo ao vivo e vai com o token", () => {
  assert.doesNotMatch(tela, /type="file"|type=\{"file"\}|showOpenFilePicker|<input[^>]*accept=/);
  assert.match(tela, /corpo\.append\("token", token\.current\);/);
  assert.match(tela, /salvarItemNivel\(propertyId, chave, true, j\.path, token\.current\)/);
});
