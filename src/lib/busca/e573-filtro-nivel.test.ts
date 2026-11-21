/*
  E573 — filtro por NÍVEL na busca de imóveis (decisão do Daniel, 04/11): o grupo "Nível" (Essencial · Conforto ·
  Premium) devolve os anúncios com AQUELE nível definido, com um contador por nível no padrão dos demais filtros;
  anúncio sem nível definido (nulo ou "em adequação") não entra em filtro de nível nenhum. Dados/regra da Pista B; o
  rótulo e a posição no painel são da Pista A.
  Roda: node --test src/lib/busca/e573-filtro-nivel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTROS_PAINEL_VAZIOS, contagensPorNivel, contarFiltrosPainel, passaNoPainel, resumoFiltros } from "./painel-filtros.ts";
import { niveisDaUrl, niveisNaUrl, passaNiveis, rotuloFiltroNiveis } from "./filtro-nivel.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
type Imovel = Parameters<typeof passaNoPainel>[0] & { id: string };
const im = (id: string, nivel: unknown, extra: Partial<Imovel> = {}) =>
  ({ id, monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false, nivel, ...extra }) as unknown as Imovel;

const LISTA: Imovel[] = [
  im("e1", "essencial"),
  im("c1", "conforto"),
  im("c2", "conforto", { petsAllowed: true }),
  im("p1", "premium", { petsAllowed: true }),
  im("sem", null),
  im("adeq", "em_adequacao"),
];

test("nível EXATO: Conforto devolve só Conforto (não Premium); mais de um nível soma", () => {
  const conforto = { ...FILTROS_PAINEL_VAZIOS, niveis: ["conforto" as const] };
  assert.deepEqual(LISTA.filter((p) => passaNoPainel(p, conforto)).map((p) => p.id), ["c1", "c2"]);
  const dois = { ...FILTROS_PAINEL_VAZIOS, niveis: ["conforto" as const, "premium" as const] };
  assert.deepEqual(LISTA.filter((p) => passaNoPainel(p, dois)).map((p) => p.id), ["c1", "c2", "p1"]);
});

test("sem nível definido (nulo ou em adequação) não entra em filtro de nível nenhum; filtro desligado não tira ninguém", () => {
  for (const v of ["essencial", "conforto", "premium"] as const) {
    assert.equal(passaNiveis(null, [v]), false);
    assert.equal(passaNiveis(undefined, [v]), false);
    assert.equal(passaNiveis("em_adequacao", [v]), false);
  }
  assert.equal(LISTA.filter((p) => passaNoPainel(p, FILTROS_PAINEL_VAZIOS)).length, LISTA.length);
});

test("contador por nível no padrão dos demais filtros: conta com o resto do painel", () => {
  assert.deepEqual(contagensPorNivel(LISTA, FILTROS_PAINEL_VAZIOS), { essencial: 1, conforto: 2, premium: 1 });
  // Com "Aceita pets" ligado, o contador já considera o pet.
  assert.deepEqual(contagensPorNivel(LISTA, { ...FILTROS_PAINEL_VAZIOS, petsOnly: true }), { essencial: 0, conforto: 1, premium: 1 });
  // Os anúncios sem nível não somam em contador nenhum.
  const total = Object.values(contagensPorNivel(LISTA, FILTROS_PAINEL_VAZIOS)).reduce((a, b) => a + b, 0);
  assert.equal(total, 4);
});

test("contagem do botão Filtros, resumo e URL (?niveis=)", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, niveis: ["premium" as const, "conforto" as const] };
  assert.equal(contarFiltrosPainel(f), contarFiltrosPainel(FILTROS_PAINEL_VAZIOS) + 1);
  assert.match(resumoFiltros(f), /Nível Conforto ou Premium/);
  assert.equal(rotuloFiltroNiveis([]), null);
  assert.deepEqual(niveisDaUrl(new URLSearchParams("niveis=premium,xx,conforto,premium")), ["conforto", "premium"]);
  const params = new URLSearchParams();
  niveisNaUrl(params, ["premium", "essencial"]);
  assert.equal(params.get("niveis"), "essencial,premium");
  niveisNaUrl(params, []);
  assert.equal(params.has("niveis"), false);
});

test("o 'a partir de' do Adendo 59.1 (?nivel=) segue como era", () => {
  const aPartir = { ...FILTROS_PAINEL_VAZIOS, nivelMin: "conforto" as const };
  assert.deepEqual(LISTA.filter((p) => passaNoPainel(p, aPartir)).map((p) => p.id), ["c1", "c2", "p1"]);
});

test("/buscar: o estado niveis vai à URL, à lista, às contagens e aos dois Limpar", () => {
  const busca = ler("src/app/(public)/buscar/search-client.tsx") + ler("src/lib/busca/filtros-da-url.ts"); // E829: a leitura da URL mora em filtros-da-url.ts (o estado nasce dela)
  assert.match(busca, /niveis: niveisDaUrl\(sp\)/);
  assert.match(busca, /niveisNaUrl\(params, niveis\);/);
  assert.match(busca, /entrada: dataEntrada, datasFlexiveis, nivelMin, niveis,/);
  assert.match(busca, /setNiveis\(f\.niveis \?\? \[\]\);/);
  assert.ok((busca.match(/setNiveis\(\[\]\)/g) ?? []).length >= 2, "os dois 'Limpar' zeram o filtro");
  assert.ok((busca.match(/\(niveis\.length \? 1 : 0\)/g) ?? []).length >= 2, "conta nos filtros ativos e na folha");
  // A lista da /buscar carrega o nível gravado pelo servidor (imovel_nivel).
  assert.match(ler("src/lib/data/properties.ts"), /from\("imovel_nivel"\)\.select\("property_id, nivel, nivel_vistoriado_em"\)/);
});
