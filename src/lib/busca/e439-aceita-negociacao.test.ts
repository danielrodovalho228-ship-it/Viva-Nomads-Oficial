/*
  E439 — selo e filtro "Aceita negociação" a partir do properties.negociacao que já existe (prompt 17 §8).
  O filtro entra na folha (passaNoPainel), na URL (?negocia=1), na contagem e no resumo; a lista da /buscar carrega a
  negociação de cada anúncio; o cartão mostra o selo só quando o dono aceita negociar. Sem migração.
  Roda: node --test src/lib/busca/e439-aceita-negociacao.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel, resumoFiltros } from "./painel-filtros.ts";

const ler = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

const base = { id: "a", monthlyPrice: 3000, bedrooms: 1, petsAllowed: false } as unknown as Parameters<typeof passaNoPainel>[0];
const com = (negociacao: unknown) => ({ ...base, negociacao }) as Parameters<typeof passaNoPainel>[0];

test("filtro: só passa quem aceita negociar; sem dado de negociação não passa; desligado não tira ninguém", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, negociaOnly: true };
  assert.equal(passaNoPainel(com({ aceita: true, itens: ["valor_mensal"], descontos: [] }), f), true);
  assert.equal(passaNoPainel(com({ aceita: false, itens: [], descontos: [] }), f), false);
  assert.equal(passaNoPainel(base, f), false);
  assert.equal(passaNoPainel(base, FILTROS_PAINEL_VAZIOS), true);
  assert.equal(passaNoPainel(com({ aceita: false, itens: [], descontos: [] }), FILTROS_PAINEL_VAZIOS), true);
});

test("contagem e resumo: o filtro conta 1 e aparece como 'Aceita negociação'", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, negociaOnly: true };
  assert.equal(contarFiltrosPainel(f), contarFiltrosPainel(FILTROS_PAINEL_VAZIOS) + 1);
  assert.match(resumoFiltros(f), /Aceita negociação/);
});

test("busca: a folha tem o chip, a URL guarda ?negocia=1 e o Limpar zera", () => {
  const folha = ler("../../components/busca/painel-filtros-celular.tsx");
  assert.match(folha, /facetaInterruptor\(contar, rascunho, "negociaOnly"\)/);
  assert.match(folha, /testId="faceta-negocia"/);
  const busca = ler("../../app/(public)/buscar/search-client.tsx");
  assert.match(busca, /if \(on\("negocia"\)\) setNegociaOnly\(true\)/);
  assert.match(busca, /put\("negocia", negociaOnly, "1"\)/);
  assert.match(busca, /negociaOnly,/);
  assert.match(busca, /setNegociaOnly\(f\.negociaOnly \?\? false\)/);
  assert.ok((busca.match(/setNegociaOnly\(false\)/g) ?? []).length >= 2, "os dois 'Limpar' zeram o filtro");
});

test("lista da /buscar carrega a negociação (best-effort) e o cartão mostra o selo só quando aceita", () => {
  const dados = ler("../data/properties.ts");
  assert.match(dados, /await attachNegociacao\(supabase, mapped\)/);
  assert.match(dados, /select\("id, negociacao"\)/);
  // E416 (05/11): "Aceita negociação" virou selo da foto (mesmo dado, mesmo test id).
  const cartao = ler("../../components/property-card.tsx");
  // E811: o cartão lê a fonte única dos selos (a mesma da página).
  assert.match(cartao, /\.\.\.simbolosDoImovel\(property\)/);
  assert.match(ler("../cartao-selos-foto.ts"), /negocia: !!p\.negociacao\?\.aceita/);
  assert.match(ler("../../components/property/selos-foto.tsx"), /negocia: "cartao-negocia"/);
  assert.match(ler("../cartao-selos-foto.ts"), /ROTULO_NEGOCIA = "Aceita negociação"/);
});
