/*
  E589 (relato do Daniel, uso real em 05/11, celular): "Mais filtros (1)" preso — limpar os filtros não voltava o
  contador a zero e a lista seguia com 1 imóvel. Reproduzido (390 e 1280 px, /buscar?local=Uberlândia): aplicar
  "Gestor profissional" (1 imóvel), abrir a folha, tocar "Limpar tudo" e FECHAR a folha (X, toque fora, Esc) — o "Limpar
  tudo" só zerava o RASCUNHO; sem tocar em "Mostrar N imóveis", a busca, a URL (?gestor=1) e o contador seguiam
  filtrados. Correção: "Limpar tudo" limpa a BUSCA na hora (mesma função do aplicar, sem fechar a folha) e a folha segue
  aberta, vazia, para escolher de novo. O "Mostrar N imóveis" continua aplicando o rascunho.
  Roda: node --test src/lib/busca/e589-limpar-tudo-aplica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILTROS_PAINEL_VAZIOS, contarFiltrosPainel } from "./painel-filtros.ts";

const ler = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("o estado limpo não tem filtro nenhum (contador zero)", () => {
  assert.equal(contarFiltrosPainel(FILTROS_PAINEL_VAZIOS), 0);
});

test("folha: 'Limpar tudo' zera o rascunho E avisa a busca (onLimpar)", () => {
  const f = ler("components/busca/painel-filtros-celular.tsx");
  assert.match(f, /onLimpar\?: \(\) => void;/);
  assert.match(f, /onClick=\{\(\) => \{\s*setRascunho\(FILTROS_PAINEL_VAZIOS\);\s*onLimpar\?\.\(\);\s*\}\}\s*data-testid="limpar-tudo"/);
});

test("busca: o limpar aplica o estado vazio na hora, sem fechar a folha; o aplicar segue fechando", () => {
  const s = ler("app/(public)/buscar/search-client.tsx");
  assert.match(s, /onLimpar=\{\(\) => definirFiltrosDoPainel\(FILTROS_PAINEL_VAZIOS\)\}/);
  assert.match(s, /function aplicarPainel\(f: FiltrosPainel\) \{\s*definirFiltrosDoPainel\(f\);\s*setPainelAberto\(false\);/);
  const corpo = s.slice(s.indexOf("function definirFiltrosDoPainel("), s.indexOf("function aplicarPainel("));
  assert.doesNotMatch(corpo, /setPainelAberto/);
  // Todos os filtros que o contador "Mais filtros" soma são definidos aqui (nenhum fica de fora do limpar).
  for (const set of ["setGarantia", "setMinBedrooms", "setMaxPeriod", "setInternetMin", "setSoInternetMedida", "setNiveis", "setReadyToLiveOnly", "setHomeOfficeOnly", "setPetsOnly", "setInvoiceOnly", "setOperatedOnly", "setNegociaOnly", "setPrecoJustoOnly", "setComodidades"]) {
    assert.match(corpo, new RegExp(`${set}\\(`), set);
  }
});
