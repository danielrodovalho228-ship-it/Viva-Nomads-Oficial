/*
  E531 — mapa em tela cheia da Localização do anúncio:
   (1) a atribuição do mapa ("© OpenStreetMap © CARTO", obrigatória) ficava cortada na borda direita: a legenda "Área
       aproximada de …" ficava no rodapé (inset-x-3 bottom-3) por cima do controle de atribuição (canto inferior
       direito) — só "CARTO" aparecia. A legenda sobe para o topo, ao lado do botão de fechar;
   (2) o círculo de localização aproximada do anúncio de exemplo do Tibery ficava em Custódio Pereira/Alto Umuarama:
       as coordenadas do exemplo ube-003 (-18,89, -48,24) estão fora do bairro declarado. Os dois exemplos do Tibery
       passam para dentro do bairro (o círculo é centrado nessas coordenadas, borradas em ~100 m).
  Roda: node --test src/components/property/e531-mapa-tela-cheia.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE_PROPERTIES } from "../../lib/properties.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
// Caixa do bairro Tibery (Uberlândia), folgada.
const TIBERY = { latMin: -18.916, latMax: -18.896, lngMin: -48.246, lngMax: -48.226 };

test("os anúncios de exemplo do Tibery ficam dentro do Tibery (o círculo aproximado também)", () => {
  const tibery = SAMPLE_PROPERTIES.filter((p) => p.neighborhood === "Tibery");
  assert.ok(tibery.length >= 2);
  for (const p of tibery) {
    assert.ok(p.lat >= TIBERY.latMin && p.lat <= TIBERY.latMax && p.lng >= TIBERY.lngMin && p.lng <= TIBERY.lngMax, `${p.id}: ${p.lat}, ${p.lng}`);
  }
});

test("tela cheia: a legenda fica no topo, longe da atribuição do mapa no canto inferior direito", () => {
  const t = ler("components/property/location-nearby.tsx");
  const cheio = t.slice(t.indexOf('data-testid="mapa-tela-cheia"'));
  assert.doesNotMatch(cheio.slice(0, cheio.indexOf("</div>\n        </div>")), /absolute inset-x-3 bottom-3/);
  assert.match(cheio, /data-testid="mapa-tela-cheia-legenda"[^>]*className="absolute left-3 right-16 top-3/);
});
