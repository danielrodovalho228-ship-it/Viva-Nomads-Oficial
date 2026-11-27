/* Roda: node --test src/lib/data/e416-meus-anuncios.test.ts — E416 (retrabalho, 01/11): Meus anúncios sem o selo de nível.
   Causa raiz: a tela lê listMyProperties, que não buscava o nível (o #2064 o pôs em listPropertiesDoProprietario), e o
   cartão de Meus anúncios nem desenhava o selo. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("Meus anúncios lê listMyProperties, e ela busca o nível", () => {
  assert.match(ler("../../app/(dashboard)/dashboard/imoveis/page.tsx"), /listMyProperties\(\{ exigir: true \}\)/);
  const src = ler("./properties.ts");
  const fn = src.slice(src.indexOf("export async function listMyProperties"), src.indexOf("export async function listMyProperties") + 2500);
  assert.match(fn, /attachNivel\(supabase, lista\)/);
});

test("o cartão de Meus anúncios desenha o selo com o texto da vitrine (sem selo abaixo do Essencial)", () => {
  const c = ler("../../app/(dashboard)/dashboard/imoveis/imoveis-client.tsx");
  assert.match(c, /data-testid="meu-anuncio"\n\s*data-imovel=\{p\.id\}/);
  // E416 (05/11): o nível vai nos selos da foto, junto dos outros (o "em adequação" não vira selo: selosDaFoto).
  assert.match(c, /<SelosFoto[\s\S]{0,120}selos=\{selosDaFoto\(\{[^}]*nivel: p\.nivel, nivelVistoriado: p\.nivelVistoriado/);
});
