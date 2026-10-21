import { test } from "node:test";
import assert from "node:assert/strict";
import { maisBuscados, slugDoDestino, validarDestino } from "./regras.ts";

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
