import { test } from "node:test";
import assert from "node:assert/strict";
import { filtroNivelDaUrl, filtroNivelNaUrl } from "./filtro-nivel.ts";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel, passaNoPainel } from "./painel-filtros.ts";

const imovel = (nivel: "em_adequacao" | "essencial" | "conforto" | "premium" | null) => ({ monthlyPrice: 3000, bedrooms: 1, tagHomeOffice: false, nivel });

test("59.1: ?nivel=conforto mostra Conforto e Premium; ?nivel=premium só Premium; desligado não tira ninguém", () => {
  const todos = [imovel(null), imovel("essencial"), imovel("conforto"), imovel("premium")];
  const filtra = (nivelMin: "" | "conforto" | "premium") => todos.filter((p) => passaNoPainel(p, { ...FILTROS_PAINEL_VAZIOS, nivelMin })).map((p) => p.nivel);
  assert.deepEqual(filtra(""), [null, "essencial", "conforto", "premium"]);
  assert.deepEqual(filtra("conforto"), ["conforto", "premium"]);
  assert.deepEqual(filtra("premium"), ["premium"]);
  assert.equal(contarFiltrosPainel({ ...FILTROS_PAINEL_VAZIOS, nivelMin: "conforto" }), 1);
});

test("59.1: o filtro vai e volta pela URL; valor estranho é ignorado", () => {
  assert.equal(filtroNivelDaUrl(new URLSearchParams("nivel=conforto")), "conforto");
  assert.equal(filtroNivelDaUrl(new URLSearchParams("nivel=essencial")), "");
  assert.equal(filtroNivelDaUrl(new URLSearchParams("nivel=hack")), "");
  const p = new URLSearchParams("q=centro");
  filtroNivelNaUrl(p, "premium");
  assert.equal(p.toString(), "q=centro&nivel=premium");
  filtroNivelNaUrl(p, "");
  assert.equal(p.toString(), "q=centro");
});
