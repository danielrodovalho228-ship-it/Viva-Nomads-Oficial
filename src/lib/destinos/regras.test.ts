import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { maisBuscados, pontoAoSalvar, slugDoDestino, validarDestino } from "./regras.ts";

test("slug do destino a partir do nome", () => {
  assert.equal(slugDoDestino("HC-UFU"), "hc-ufu");
  assert.equal(slugDoDestino("UFU — Campus Santa Mônica"), "ufu-campus-santa-monica");
});

test("cadastro: ponto opcional (cadastra inativo), mas sempre dentro do Brasil", () => {
  const base = { nome: "HC-UFU", tipo: "hospital", artigo: "o", cidade: "Uberlândia", uf: "mg" };
  const r = validarDestino(base);
  assert.ok(r.ok && r.destino.lat === null && r.destino.uf === "MG" && r.destino.slug === "hc-ufu");
  const p = validarDestino({ ...base, lat: "-18,8825", lng: "-48.259" });
  assert.ok(p.ok && p.destino.lat === -18.8825);
  assert.equal(validarDestino({ ...base, lat: "40.7", lng: "-74" }).ok, false);
  assert.equal(validarDestino({ ...base, tipo: "praia" }).ok, false);
  assert.equal(validarDestino({ ...base, slug: "ufu-umuarama" }).ok && (validarDestino({ ...base, slug: "ufu-umuarama" }) as { destino: { slug: string } }).destino.slug, "ufu-umuarama");
});

test("destinos mais buscados: só a soma por destino", () => {
  const nomes = new Map([["a", "HC-UFU"], ["b", "UFU — Campus Umuarama"]]);
  assert.deepEqual(maisBuscados([{ destino_id: "a", n: 3 }, { destino_id: "b", n: 5 }, { destino_id: "a", n: 4 }], nomes), [
    { nome: "HC-UFU", total: 7 },
    { nome: "UFU — Campus Umuarama", total: 5 },
  ]);
});

test("E32: editar só o nome mantém o ponto e o ativo; só 'Remover o ponto' apaga", () => {
  const gravado = { lat: -18.97, lng: -49.46 };
  const vazio = { lat: null, lng: null };
  assert.deepEqual(pontoAoSalvar({ existente: gravado, enviado: vazio, limparPonto: false }), { ...gravado, desativar: false });
  assert.deepEqual(pontoAoSalvar({ existente: gravado, enviado: { lat: -18.9, lng: -48.2 }, limparPonto: false }), { lat: -18.9, lng: -48.2, desativar: false });
  assert.deepEqual(pontoAoSalvar({ existente: gravado, enviado: vazio, limparPonto: true }), { ...vazio, desativar: true });
  assert.deepEqual(pontoAoSalvar({ existente: null, enviado: vazio, limparPonto: false }), { ...vazio, desativar: true }, "novo sem ponto: inativo");
  assert.deepEqual(pontoAoSalvar({ existente: vazio, enviado: vazio, limparPonto: false }), { ...vazio, desativar: true });
  // A ação usa a regra e a tela remonta o formulário por destino (o ponto chega preenchido na edição).
  const acao = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  assert.match(acao, /pontoAoSalvar\(\{[\s\S]*?limparPonto: form\.get\("limpar_ponto"\) === "1"/);
  assert.match(acao, /ponto\.desativar \? \{ ativo: false \} : \{\}/);
  const pagina = readFileSync(new URL("../../app/(dashboard)/admin/destinos/page.tsx", import.meta.url), "utf8");
  // DESTINO-PESSOAL-B: o formulário também remonta para "Promover a âncora" (o ponto da região chega preenchido).
  assert.match(pagina, /<DestinoForm key=\{emEdicao\?\.slug \?\? \(pontoPromover \? `promover-\$\{promover\}` : "novo"\)\} inicial=\{emEdicao\} pontoInicial=\{emEdicao \? null : pontoPromover\} \/>/);
});
