/*
  Filtro "Aceita pet" com porte (ordem 022afabb, item 3).
  Roda: node --test src/lib/busca/pets-filtro-porte.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { aceitaPorte } from "../anuncio/pets-regras.ts";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel, resumoFiltros } from "./painel-filtros.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const regras = (porteMax: "P" | "M" | "G") => ({ especies: ["cao" as const], porteMax, qtdMax: 1, reforcoCaucao: 0, regrasCondominio: "" });
const imovel = (o: Record<string, unknown> = {}) => ({
  monthlyPrice: 3000, bedrooms: 2, petsAllowed: true, tagHomeOffice: false, readyToLiveBadge: false, ...o,
});

test("aceitaPorte: porte máximo do imóvel manda; sem regras vale o aceite geral", () => {
  assert.equal(aceitaPorte(true, regras("P"), "P"), true);
  assert.equal(aceitaPorte(true, regras("P"), "M"), false);
  assert.equal(aceitaPorte(true, regras("M"), "M"), true);
  assert.equal(aceitaPorte(true, regras("M"), "G"), false);
  assert.equal(aceitaPorte(true, regras("G"), "G"), true);
  assert.equal(aceitaPorte(true, null, "G"), true);
  assert.equal(aceitaPorte(undefined, null, "P"), false);
  assert.equal(aceitaPorte(false, regras("G"), "P"), false);
});

test("painel: porte do pet filtra junto com 'Aceita pets' (lista e contagem)", () => {
  const f = { ...FILTROS_PAINEL_VAZIOS, petsOnly: true, petPorte: "G" as const };
  assert.equal(passaNoPainel(imovel({ petsRegras: regras("P") }), f), false);
  assert.equal(passaNoPainel(imovel({ petsRegras: regras("G") }), f), true);
  assert.equal(passaNoPainel(imovel(), f), true);
  assert.equal(passaNoPainel(imovel({ petsAllowed: false }), f), false);
  // Sem "Aceita pets" ligado o porte não filtra.
  assert.equal(passaNoPainel(imovel({ petsRegras: regras("P") }), { ...f, petsOnly: false }), true);
  assert.equal(resumoFiltros(f), "Aceita pets · pet grande");
  assert.equal(contarFiltrosPainel(f), 1);
});

test("busca lê e grava o porte na URL e o painel mostra a escolha", () => {
  const s = ler("app/(public)/buscar/search-client.tsx");
  assert.match(s, /put\("porte", petsOnly && !!petPorte, petPorte\)/);
  // Prompt 40: o porte saiu da faixa do computador e mora só na folha de filtros (celular e computador).
  assert.match(s, /setPetPorte\(f\.petsOnly \? f\.petPorte : ""\)/);
  const p = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(p, /data-testid="painel-porte-pet"/);
  const d = ler("lib/data/properties.ts");
  assert.match(d, /attachPetsRegras\(supabase, mapped\)/);
});
