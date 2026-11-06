/*
  E631 (família do E624): o perfil público do proprietário mostrava "0 imóveis na Viva" enquanto o cartão do anúncio do
  mesmo dono mostrava "10 imóveis na Viva". Causa: duas fontes — o cartão lia `imoveis_ativos` da função do banco (todo
  anúncio ativo, inclusive de teste) e a página contava a lista da vitrine (sem anúncios de teste). Agora as duas saem
  da MESMA lista pública: o cartão conta o que a página lista.
  Roda: node --test src/lib/data/e631-contagem-imoveis-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const props = ler("lib/data/properties.ts");
const perfil = ler("lib/data/perfil-proprietario.ts");
const pagina = ler("app/(public)/proprietario/[id]/page.tsx");

test("a lista pública e a contagem usam a MESMA consulta e o MESMO filtro de vitrine", () => {
  assert.match(props, /async function linhasPublicasDoDono\(/);
  const lista = props.slice(props.indexOf("export async function listPropertiesDoProprietario"));
  assert.match(lista.slice(0, 900), /linhasPublicasDoDono\(/);
  const conta = props.slice(props.indexOf("export async function contarImoveisPublicosDoDono"));
  assert.match(conta.slice(0, 700), /linhasPublicasDoDono\(/);
  // o filtro de vitrine mora na consulta compartilhada, uma vez só
  const comum = props.slice(props.indexOf("async function linhasPublicasDoDono("), props.indexOf("export async function listPropertiesDoProprietario"));
  assert.match(comum, /\.eq\("status", "active"\)/);
  assert.match(comum, /semAnunciosDeTesteNaVitrine\(/);
});

test("o cartão do anúncio não confia na contagem crua do banco: usa a contagem pública", () => {
  assert.match(perfil, /contarImoveisPublicosDoDono\(donoId\)/);
  assert.doesNotMatch(perfil, /imoveisAtivos: l\.imoveis_ativos \?\? 0/);
});

test("a página pública segue contando a lista que ela mesma mostra", () => {
  assert.match(pagina, /\$\{imoveis\.length\} \$\{imoveis\.length === 1 \? "imóvel" : "imóveis"\} na Viva/);
});
