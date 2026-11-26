/*
  E971 — a foto do chat abria numa aba nova; não havia lightbox. Regra (coordenador): reaproveitar o lightbox EXISTENTE
  da galeria do imóvel (componente único, já com o teste property-gallery.lightbox) — não construir um novo.
  Roda: node --test src/components/mensagens/e971-foto-no-lightbox.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const anexo = readFileSync(new URL("./anexo-conversa.tsx", import.meta.url), "utf8");
const foto = anexo.slice(anexo.indexOf("export function AnexoNaMensagem"), anexo.indexOf('data-testid="anexo-pdf"'));

test("E971 — a foto da conversa abre o Lightbox da galeria, não outra aba", () => {
  assert.match(anexo, /import \{ Lightbox \} from "@\/components\/property-gallery";/);
  assert.match(foto, /<button type="button" onClick=\{\(\) => setAmpliada\(true\)\}[^>]*data-testid="anexo-foto"/);
  assert.match(foto, /<Lightbox photos=\{\[url\]\}[\s\S]*?onClose=\{\(\) => setAmpliada\(false\)\}/);
  assert.doesNotMatch(foto.slice(0, foto.indexOf("<Lightbox")), /target="_blank"/);
});

test("E971 — nenhum lightbox novo: um só componente com o testid da galeria", () => {
  const gal = readFileSync(new URL("../property-gallery.tsx", import.meta.url), "utf8");
  assert.match(gal, /export function Lightbox\(/);
  assert.doesNotMatch(anexo, /role="dialog"|galeria-lightbox/);
});
