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

test("endereço digitado: nunca mais de 2 casas nem número de casa na URL", () => {
  const p = new URLSearchParams();
  destinoNaUrl(p, { destino: { lat: -18.918734, lng: -48.259876, rot: "Av. Pará, 1720 - Umuarama, Uberlândia" }, modo: "a_pe", ate: 0 });
  assert.equal(p.get("dlat"), "-18.92");
  assert.equal(p.get("dlng"), "-48.26");
  assert.equal(p.get("drot"), "Av. Pará, Umuarama, Uberlândia");
  assert.doesNotMatch(p.toString(), /1720|\d\.\d{3}/);
  const volta = destinoDaUrl(p);
  assert.deepEqual(volta.destino, { lat: -18.92, lng: -48.26, rot: "Av. Pará, Umuarama, Uberlândia" });
  assert.deepEqual(corpoDoDestino({ lat: -18.918734, lng: -48.259876, rot: "Rua X, 45" }), { dlat: "-18.92", dlng: "-48.26", drot: "Rua X" });
});

test("valores fora da lista são ignorados (modo e 'até')", () => {
  assert.deepEqual(destinoDaUrl(new URLSearchParams("destino=hc-ufu&modo=aviao&ate=25")), { destino: { slug: "hc-ufu" }, modo: "carro", ate: 0 });
  assert.equal(destinoDaUrl(new URLSearchParams("destino=HC_UFU!")).destino, null);
  assert.equal(destinoDaUrl(new URLSearchParams("")).destino, null);
});
