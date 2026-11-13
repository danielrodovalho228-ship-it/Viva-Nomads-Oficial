/*
  E830 — o atalho do HC-UFU tinha nome de proximidade ("Perto do HC-UFU/Umuarama") e critério de BAIRRO (?local=Umuarama).
  Agora o critério é um só (casaLocal, o mesmo da /buscar e da contagem), vem do polo e o nome diz bairro.
  Roda: node --test src/lib/busca/e830-atalho-hc-ufu.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ATALHOS_CATEGORIA, BAIRRO_HC, ROTULO_ATALHO_HC } from "../../config/atalhos-home.ts";
import { POLOS } from "../polos.ts";
import { SAMPLE_PROPERTIES } from "../properties.ts";
import { casaLocal } from "./local-busca.ts";
import { contarAtalho } from "./atalhos-contagem.ts";

const atalho = ATALHOS_CATEGORIA.find((a) => a.rotulo === ROTULO_ATALHO_HC)!;
const polo = POLOS.find((p) => p.slug === "hc-ufu-umuarama")!;
const localDoAtalho = new URL(atalho.href, "https://x").searchParams.get("local") ?? "";

test("o nome diz o critério: bairro (do polo do HC-UFU), sem prometer proximidade", () => {
  assert.ok(atalho, "atalho existe");
  assert.equal(ROTULO_ATALHO_HC, "Bairro Umuarama (HC-UFU)");
  assert.doesNotMatch(atalho.rotulo, /^Perto|próximo/i);
  assert.equal(BAIRRO_HC, polo.bairros[0]);
  assert.equal(localDoAtalho, polo.bairros[0]);
});

test("o atalho pega exatamente os anúncios dos bairros do polo — e mais nenhum", () => {
  const pegos = SAMPLE_PROPERTIES.filter((p) => casaLocal(p, localDoAtalho)).map((p) => p.id);
  const doPolo = SAMPLE_PROPERTIES.filter((p) => polo.bairros.includes(p.neighborhood)).map((p) => p.id);
  assert.deepEqual(pegos, doPolo);
  assert.ok(pegos.includes("ube-004"), "Umuarama entra");
  assert.ok(!pegos.includes("ube-011"), "Osvaldo Rezende ('próximo à UFU') não é do bairro: fica fora, e o nome não promete o contrário");
  for (const b of polo.bairros) assert.ok(casaLocal({ neighborhood: b, city: "Uberlândia" }, localDoAtalho), `${b} casa`);
  // A contagem da home usa a MESMA regra que a /buscar.
  assert.equal(contarAtalho(atalho.href, SAMPLE_PROPERTIES), pegos.length);
});

test("um critério só: /buscar e contagem dos atalhos usam casaLocal (nada de regra copiada)", () => {
  const busca = readFileSync(new URL("../../app/(public)/buscar/search-client.tsx", import.meta.url), "utf8");
  const contagem = readFileSync(new URL("./atalhos-contagem.ts", import.meta.url), "utf8");
  for (const fonte of [busca, contagem]) {
    assert.match(fonte, /casaLocal\(p, loc(al)?\)/);
    assert.doesNotMatch(fonte, /`\$\{p\.neighborhood\} \$\{p\.city\}`\.toLowerCase\(\)\.includes/);
  }
});
