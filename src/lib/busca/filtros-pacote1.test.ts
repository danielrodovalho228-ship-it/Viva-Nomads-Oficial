/*
  Filtros pacote 1 — "Ambiente silencioso" (?silencioso=1), "Contas incluídas" (?contas=1) e o chip "Ar-condicionado".
  Regras puras, a folha, a URL, a contagem e a faceta (o número do chip = os cartões que a lista mostra com ele ligado).
  Roda: node --test src/lib/busca/filtros-pacote1.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ambienteSilencioso, contasIncluidas, ROTULO_CONTAS_INCLUIDAS, ROTULO_SILENCIOSO } from "./filtros-pacote1.ts";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel, resumoFiltros, type FiltrosPainel } from "./painel-filtros.ts";
import { facetaComodidade, facetaInterruptor } from "./facetas.ts";
import { COMODIDADES_FILTRAVEIS, ROTULOS_FILTRAVEIS, chavesFiltroDe, comodidadesDaUrl } from "./filtro-comodidades.ts";
import { avisoCurtoDoTotal, AVISO_TUDO_INCLUIDO } from "../precos.ts";
import { AMENITY_LABEL } from "../amenities.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
type Imovel = Parameters<typeof passaNoPainel>[0];
const base = { id: "a", monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false, utilitiesMode: "real", utilitiesEstimate: 0 } as unknown as Imovel;
const com = (x: Partial<Imovel> & Record<string, unknown>) => ({ ...base, ...x }) as Imovel;

test("silencioso: baixo passa; médio/alto só com isolamento; sem classe (não declarado) fica de fora", () => {
  assert.equal(ambienteSilencioso({ ruidoClasse: "baixo" }), true);
  assert.equal(ambienteSilencioso({ ruidoClasse: "baixo", isolamentoAcustico: false }), true);
  assert.equal(ambienteSilencioso({ ruidoClasse: "medio" }), false);
  assert.equal(ambienteSilencioso({ ruidoClasse: "medio", isolamentoAcustico: true }), true);
  assert.equal(ambienteSilencioso({ ruidoClasse: "alto" }), false);
  assert.equal(ambienteSilencioso({ ruidoClasse: "alto", isolamentoAcustico: true }), true);
  assert.equal(ambienteSilencioso({ ruidoClasse: null, isolamentoAcustico: true }), false);
  assert.equal(ambienteSilencioso({}), false);
});

test("contas incluídas: só com o modo fixo E a estimativa no total — a MESMA regra do aviso 'tudo incluído' do cartão", () => {
  const casos = [
    { utilitiesMode: "fixed", utilitiesEstimate: 250 },
    { utilitiesMode: "fixed", utilitiesEstimate: 0 },
    { utilitiesMode: "real", utilitiesEstimate: 250 },
    { utilitiesMode: "real", utilitiesEstimate: 0 },
  ] as const;
  assert.deepEqual(casos.map((c) => contasIncluidas(c)), [true, false, false, false]);
  // Nunca diverge do cartão: passa no filtro ⇔ o cartão diz "tudo incluído".
  for (const c of casos) assert.equal(contasIncluidas(c), avisoCurtoDoTotal(c) === AVISO_TUDO_INCLUIDO, JSON.stringify(c));
});

test("ar-condicionado: chip da lista de comodidades, ligado ao rótulo cadastrado (amenityKey ar_condicionado)", () => {
  const ar = COMODIDADES_FILTRAVEIS.find((c) => c.chave === "ar");
  assert.ok(ar, "o chip está na folha");
  assert.equal(ar!.amenityKey, "ar_condicionado");
  assert.ok(ROTULOS_FILTRAVEIS.includes(AMENITY_LABEL.ar_condicionado), "a busca carrega o rótulo do imóvel");
  assert.deepEqual(chavesFiltroDe([AMENITY_LABEL.ar_condicionado]), ["ar"]);
  assert.deepEqual(comodidadesDaUrl("ar,garagem"), ["ar", "garagem"]);
  const f = { ...FILTROS_PAINEL_VAZIOS, comodidades: ["ar" as const] };
  assert.equal(passaNoPainel(com({ comodidadesFiltro: ["ar"] }), f), true);
  assert.equal(passaNoPainel(com({ comodidadesFiltro: ["garagem"] }), f), false);
  assert.equal(passaNoPainel(base, f), false);
});

test("painel: os dois interruptores filtram, contam 1 cada e aparecem no resumo; desligados não tiram ninguém", () => {
  const silencioso = com({ ruidoClasse: "baixo" });
  const barulhento = com({ ruidoClasse: "alto" });
  const incluido = com({ utilitiesMode: "fixed", utilitiesEstimate: 300 });
  for (const p of [base, silencioso, barulhento, incluido]) assert.equal(passaNoPainel(p, FILTROS_PAINEL_VAZIOS), true);
  const fs: FiltrosPainel = { ...FILTROS_PAINEL_VAZIOS, silenciosoOnly: true };
  assert.deepEqual([base, silencioso, barulhento, incluido].map((p) => passaNoPainel(p, fs)), [false, true, false, false]);
  const fc: FiltrosPainel = { ...FILTROS_PAINEL_VAZIOS, contasOnly: true };
  assert.deepEqual([base, silencioso, barulhento, incluido].map((p) => passaNoPainel(p, fc)), [false, false, false, true]);
  assert.equal(contarFiltrosPainel({ ...FILTROS_PAINEL_VAZIOS, silenciosoOnly: true, contasOnly: true, comodidades: ["ar"] }), contarFiltrosPainel(FILTROS_PAINEL_VAZIOS) + 3);
  const r = resumoFiltros({ ...FILTROS_PAINEL_VAZIOS, silenciosoOnly: true, contasOnly: true, comodidades: ["ar"] });
  assert.match(r, new RegExp(ROTULO_SILENCIOSO));
  assert.match(r, new RegExp(ROTULO_CONTAS_INCLUIDAS));
  assert.match(r, /Ar-condicionado/);
});

test("faceta = cartões: o número de cada chip novo é exatamente quantos cartões a lista mostra com ele ligado", () => {
  const lista: Imovel[] = [
    com({ id: "1", ruidoClasse: "baixo", utilitiesMode: "fixed", utilitiesEstimate: 200, comodidadesFiltro: ["ar"] }),
    com({ id: "2", ruidoClasse: "medio", isolamentoAcustico: true, comodidadesFiltro: ["ar", "garagem"] }),
    com({ id: "3", ruidoClasse: "alto", utilitiesMode: "fixed", utilitiesEstimate: 0 }),
    com({ id: "4", utilitiesMode: "fixed", utilitiesEstimate: 150, monthlyPrice: 9000 }),
    com({ id: "5" }),
  ];
  const agora = new Date("2026-11-15T12:00:00Z");
  for (const r of [FILTROS_PAINEL_VAZIOS, { ...FILTROS_PAINEL_VAZIOS, maxPrice: 5000 }, { ...FILTROS_PAINEL_VAZIOS, comodidades: ["ar" as const] }]) {
    const contar = (f: FiltrosPainel) => lista.filter((p) => passaNoPainel(p, f, agora)).length;
    const cartoes = (f: FiltrosPainel) => lista.filter((p) => passaNoPainel(p, f, agora)).map((p) => (p as unknown as { id: string }).id);
    assert.equal(facetaInterruptor(contar, r, "silenciosoOnly").n, cartoes({ ...r, silenciosoOnly: true }).length);
    assert.equal(facetaInterruptor(contar, r, "contasOnly").n, cartoes({ ...r, contasOnly: true }).length);
    assert.equal(facetaComodidade(contar, r, "ar").n, cartoes({ ...r, comodidades: [...new Set([...r.comodidades, "ar" as const])] }).length);
  }
  const contar = (f: FiltrosPainel) => lista.filter((p) => passaNoPainel(p, f, agora)).length;
  assert.equal(facetaInterruptor(contar, FILTROS_PAINEL_VAZIOS, "silenciosoOnly").n, 2);
  assert.equal(facetaInterruptor(contar, FILTROS_PAINEL_VAZIOS, "contasOnly").n, 2);
  assert.equal(facetaComodidade(contar, FILTROS_PAINEL_VAZIOS, "ar").n, 2);
});

test("folha e URL: os chips estão na folha com a faceta; ?silencioso=1 e ?contas=1 vão e voltam; o Limpar zera", () => {
  const folha = ler("../../components/busca/painel-filtros-celular.tsx");
  assert.match(folha, /facetaInterruptor\(contar, rascunho, "silenciosoOnly"\)/);
  assert.match(folha, /testId="faceta-silencioso"/);
  assert.match(folha, /facetaInterruptor\(contar, rascunho, "contasOnly"\)/);
  assert.match(folha, /testId="faceta-contas"/);
  assert.match(folha, /COMODIDADES_FILTRAVEIS\.map/); // o chip "Ar-condicionado" (faceta-comodidade-ar) sai daqui
  const busca = ler("../../app/(public)/buscar/search-client.tsx");
  assert.match(busca, /if \(on\("silencioso"\)\) setSilenciosoOnly\(true\)/);
  assert.match(busca, /put\("silencioso", silenciosoOnly, "1"\)/);
  assert.match(busca, /if \(on\("contas"\)\) setContasOnly\(true\)/);
  assert.match(busca, /put\("contas", contasOnly, "1"\)/);
  assert.match(busca, /setSilenciosoOnly\(f\.silenciosoOnly \?\? false\)/);
  assert.match(busca, /setContasOnly\(f\.contasOnly \?\? false\)/);
  // A busca carrega o ruído (classe + isolamento) junto com o nível, para todos os anúncios da lista.
  const dados = ler("../data/properties.ts");
  assert.match(dados, /from\("imovel_nivel"\)\.select\("property_id, ruido_classe"\)/);
  assert.equal((dados.match(/await attachRuido\(supabase, mapped\)|attachRuido\(supabase, lista\)/g) ?? []).length, (dados.match(/await attachNivel\(supabase, mapped\)|attachNivel\(supabase, lista\)/g) ?? []).length, "onde a busca carrega o nível, carrega o ruído");
  assert.match(dados, /from\("imovel_ruido"\)\.select\("property_id, isolamento_acustico"\)/);
});
