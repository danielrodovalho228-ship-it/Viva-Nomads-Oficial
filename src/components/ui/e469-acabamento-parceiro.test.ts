import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("E469 — Pedidos não estica até a altura da coluna de Agenda + Ganhos no computador", () => {
  const s = ler("../parceiros/pedidos-do-parceiro.tsx");
  assert.match(s, /className="mb-6 grid gap-6 lg:grid-cols-\[minmax\(0,1fr\)_320px\] lg:items-start"/);
});

test("E469 — as prévias do cartão de divulgação não nascem brancas: aviso até a imagem chegar", () => {
  const s = ler("../cartoes/cartao-compartilhar.tsx");
  assert.equal((s.match(/<ImagemNitida/g) ?? []).length, 2);
  assert.equal((s.match(/aviso="Gerando a prévia…"/g) ?? []).length, 2);
  assert.doesNotMatch(s, /<img\b/);
  assert.doesNotMatch(s, /bg-surface-2 "/);
});

test("E469 — fotos públicas no editor do parceiro (foto, capa, galeria) entram nítidas, com a mesma URL", () => {
  const s = ler("../../app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx");
  assert.match(s, /<ImagemNitida src=\{avatarUrl\}[^\n]*data-testid="parceiro-avatar-previa"/);
  assert.match(s, /<ImagemNitida\s+src=\{capa\.src\}[\s\S]{0,300}data-testid="parceiro-banner-previa"/);
  assert.match(s, /<ImagemNitida src=\{g\.url\}/);
  assert.doesNotMatch(s, /<img\b/);
});

test("E469 — ImagemNitida: foto invisível até carregar, indicador no lugar e src sem otimizador", () => {
  const s = ler("./imagem-nitida.tsx");
  assert.match(s, /fase === "pronta" \? "opacity-100" : "opacity-0"/);
  assert.match(s, /onLoad=\{\(\) => marcar\("pronta"\)\}/);
  assert.match(s, /onError=\{\(\) => marcar\("erro"\)\}/);
  assert.match(s, /el\.complete && el\.naturalWidth > 0/);
  assert.match(s, /data-imagem-fase=\{fase\}/);
  assert.doesNotMatch(s, /next\/image/);
  assert.doesNotMatch(s, /blur/);
});
