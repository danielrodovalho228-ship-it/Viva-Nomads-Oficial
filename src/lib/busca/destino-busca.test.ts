import { test } from "node:test";
import assert from "node:assert/strict";
import { corpoDoDestino, destinoDaUrl, destinoNaUrl } from "./destino-busca.ts";

test("URL do destino cadastrado: ?destino=hc-ufu&modo=carro&ate=20", () => {
  const e = destinoDaUrl(new URLSearchParams("destino=hc-ufu&modo=carro&ate=20"));
  assert.deepEqual(e, { destino: { slug: "hc-ufu" }, modo: "carro", ate: 20 });
  const p = new URLSearchParams("local=Uberl%C3%A2ndia");
  destinoNaUrl(p, e);
  assert.equal(p.toString(), "local=Uberl%C3%A2ndia&destino=hc-ufu&modo=carro&ate=20");
});

test("endereço digitado: ponto com 3 casas (E94) e nunca o número da casa na URL", () => {
  const p = new URLSearchParams();
  destinoNaUrl(p, { destino: { lat: -18.918734, lng: -48.259876, rot: "Av. Pará, 1720 - Umuarama, Uberlândia" }, modo: "a_pe", ate: 0 });
  assert.equal(p.get("dlat"), "-18.919");
  assert.equal(p.get("dlng"), "-48.260");
  assert.equal(p.get("drot"), "Av. Pará — Umuarama");
  assert.doesNotMatch(p.toString(), /1720|\d\.\d{4}/);
  const volta = destinoDaUrl(p);
  assert.deepEqual(volta.destino, { lat: -18.919, lng: -48.26, rot: "Av. Pará — Umuarama" });
  assert.deepEqual(corpoDoDestino({ lat: -18.918734, lng: -48.259876, rot: "Rua X, 45" }), { dlat: "-18.919", dlng: "-48.260", drot: "Rua X" });
});

test("valores fora da lista são ignorados (modo e 'até')", () => {
  assert.deepEqual(destinoDaUrl(new URLSearchParams("destino=hc-ufu&modo=aviao&ate=25")), { destino: { slug: "hc-ufu" }, modo: "carro", ate: 0 });
  assert.equal(destinoDaUrl(new URLSearchParams("destino=HC_UFU!")).destino, null);
  assert.equal(destinoDaUrl(new URLSearchParams("")).destino, null);
});
