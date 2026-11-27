/*
  E697 — o anúncio de exemplo ube-015 mostrava a galeria com fotos repetidas: a grade de 5 quadros tinha só 2 fotos únicas
  (sala/cozinha alternadas) e a galeria de 10 repetia (foto 4 = foto 2), porque galleryFor() CICLAVA as 2 fotos reais para
  encher 10 posições. Agora (1) o exemplo só lista as fotos distintas que existem e (2) a galeria nunca exibe a mesma foto
  duas vezes (dedup por endereço), mesmo que o anúncio traga repetidas.
  Roda: node --test src/lib/e697-fotos-unicas.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { galleryFor, fotosUnicas, PROPERTY_PHOTOS } from "./media.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("E697: galleryFor não cicla — só devolve as fotos distintas do anúncio, até n", () => {
  const g = galleryFor("ube-015", 10);
  assert.equal(new Set(g).size, g.length, "sem repetição");
  assert.equal(g.length, PROPERTY_PHOTOS["ube-015"].length);
  assert.equal(galleryFor("ube-001", 4).length, 4, "respeita o limite n");
  for (const id of Object.keys(PROPERTY_PHOTOS)) {
    const x = galleryFor(id, 12);
    assert.equal(new Set(x).size, x.length, id);
    assert.equal(x[0], PROPERTY_PHOTOS[id][0], `${id}: a capa continua primeiro`);
  }
});

test("E697: os arquivos de cada exemplo são distintos (conteúdo, não só endereço)", () => {
  for (const [id, urls] of Object.entries(PROPERTY_PHOTOS)) {
    const hashes = urls.map((u) => createHash("sha256").update(readFileSync(new URL(`../../public${u}`, import.meta.url))).digest("hex"));
    assert.equal(new Set(hashes).size, hashes.length, `${id} tem arquivos repetidos`);
  }
});

test("E697: fotosUnicas tira repetidas preservando a ordem; vazio e sem repetição ficam como estão", () => {
  assert.deepEqual(fotosUnicas(["a", "b", "a", "c", "b"]), ["a", "b", "c"]);
  assert.deepEqual(fotosUnicas([]), []);
  const l = ["x", "y"];
  assert.equal(fotosUnicas(l), l, "sem repetição devolve a mesma lista");
});

test("E697: a galeria exibe só fotos únicas (mosaico, carrossel e lightbox leem a lista deduplicada)", () => {
  const g = ler("src/components/property-gallery.tsx");
  assert.match(g, /const fotos = photos\.length \? fotosUnicas\(photos\) : \[""\];/);
  assert.match(g, /import \{[^}]*fotosUnicas[^}]*\} from "@\/lib\/media"/);
});
