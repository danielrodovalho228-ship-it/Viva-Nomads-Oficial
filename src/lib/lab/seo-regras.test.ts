import { test } from "node:test";
import assert from "node:assert/strict";
import { caminhosDoSitemap, extrairMeta, linksInternos, pesoExcedido, problemasDaPagina, repetidos } from "./seo-regras.ts";

const html = `<html><head><title>Preços | Viva</title><meta name="description" content="Taxa por faixa"/><link rel="canonical" href="https://x.com.br/precos"/></head><body><h1>Quanto <b>custa</b></h1><a href="/buscar?cidade=x#topo">a</a><a href="/api/x">b</a><a href="/img/a.webp">c</a><a href="https://fora.com/">d</a><a href="/termos/">e</a></body></html>`;

test("extrairMeta lê título, descrição, H1 e canonical", () => {
  const m = extrairMeta(html);
  assert.equal(m.titulo, "Preços | Viva");
  assert.equal(m.descricao, "Taxa por faixa");
  assert.deepEqual(m.h1, ["Quanto custa"]);
  assert.equal(m.canonical, "https://x.com.br/precos");
});

test("problemasDaPagina aponta o que falta e H1 duplicado", () => {
  assert.deepEqual(problemasDaPagina("/precos", extrairMeta(html)), []);
  const ruim = problemasDaPagina("/x", { titulo: "", descricao: "", h1: ["a", "b"], canonical: "" });
  assert.equal(ruim.length, 4);
});

test("repetidos acha título, descrição e H1 iguais entre rotas", () => {
  const m = (t: string, d: string, h: string) => ({ titulo: t, descricao: d, h1: [h], canonical: "c" });
  assert.deepEqual(repetidos({ "/a": m("t1", "d1", "h1"), "/b": m("t2", "d2", "h2") }), []);
  const r = repetidos({ "/a": m("t", "d1", "h1"), "/b": m("t", "d2", "h1") });
  assert.equal(r.length, 2);
  assert.match(r[0], /titulo repetido em \/a, \/b/);
});

test("caminhosDoSitemap tira o domínio e a barra final", () => {
  const xml = "<urlset><url><loc>https://x.com.br</loc></url><url><loc>https://x.com.br/buscar/</loc></url></urlset>";
  assert.deepEqual(caminhosDoSitemap(xml), ["/", "/buscar"]);
});

test("linksInternos ignora api, arquivos, externos e âncoras", () => {
  assert.deepEqual(linksInternos(html).sort(), ["/buscar", "/termos"]);
});

test("pesoExcedido só reclama acima do limite", () => {
  assert.equal(pesoExcedido("/", 1_000_000), "");
  assert.match(pesoExcedido("/", 3_000_000), /acima do limite/);
});
