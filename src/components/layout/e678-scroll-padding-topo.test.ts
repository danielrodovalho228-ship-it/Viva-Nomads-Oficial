import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// E678: o cabeçalho preso do assistente (64 px) cobria o título/campo que a rolagem programática (foco, validação,
// scrollIntoView, âncora) levava ao topo da janela: sem scroll-padding-top, o alvo parava a 0 px, atrás do cabeçalho.
const moldura = readFileSync(new URL("./moldura-assistente.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const fotos = readFileSync(new URL("../../app/(dashboard)/dashboard/imoveis/novo/etapa-fotos.tsx", import.meta.url), "utf8");

test("assistente: respiro de topo maior que o cabeçalho preso (h-16 = 4rem)", () => {
  assert.match(moldura, /<header className="sticky top-0 z-30 flex h-16 /);
  const m = moldura.match(/html\{scroll-padding-top:(\d+(?:\.\d+)?)rem;scroll-padding-bottom:8rem\}/);
  assert.ok(m, "respiro de topo e de baixo juntos");
  assert.ok(Number(m[1]) > 4, "maior que os 4rem do cabeçalho");
});

test("modo app: respiro de topo maior que o AppHeader (h-12 = 3rem)", () => {
  const app = readFileSync(new URL("../app/app-header.tsx", import.meta.url), "utf8");
  assert.match(app, /sticky top-0 z-30 h-12/);
  const m = css.match(/html\[data-app\] \{\s*scroll-padding-top: (\d+(?:\.\d+)?)rem;/);
  assert.ok(m && Number(m[1]) > 3);
});

test("a âncora do vídeo não soma um segundo espaço (o respiro do assistente já cobre)", () => {
  assert.match(fotos, /<section id=\{ANCORA_VIDEO_ASSISTENTE\} className="mt-6" data-testid="bloco-video">/);
});
