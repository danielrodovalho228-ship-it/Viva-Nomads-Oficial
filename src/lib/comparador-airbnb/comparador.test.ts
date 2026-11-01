/*
  E399-C (PR 1 do selo "Preço justo") — campo do link do Airbnb e motor de comparação com dado SIMULADO, atrás de chave
  desligada. Nenhuma chamada a fornecedor de verdade.
  Roda: node --test src/lib/comparador-airbnb/comparador.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerLinkAirbnb } from "./link-airbnb.ts";
import { compararComAirbnb, cotacaoSimulada, ROTULO_SIMULADO } from "./comparador.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("link: aceita o anúncio do Airbnb e guarda só o número, sem datas nem rastreio", () => {
  for (const url of [
    "https://www.airbnb.com.br/rooms/12345678?check_in=2026-12-01&adults=2&source_impression_id=x",
    "airbnb.com.br/rooms/12345678",
    "https://m.airbnb.com/rooms/12345678/",
    "https://www.airbnb.pt/rooms/plus/12345678",
    "  https://airbnb.com.br/rooms/12345678#fotos  ",
  ]) {
    const r = lerLinkAirbnb(url);
    assert.equal(r.ok, true, url);
    if (r.ok) {
      assert.equal(r.id, "12345678");
      assert.equal(r.url, "https://www.airbnb.com.br/rooms/12345678");
    }
  }
});

test("link: recusa o que não é anúncio do Airbnb (com mensagem curta)", () => {
  for (const url of [
    "https://www.booking.com/hotel/br/x.html",
    "https://airbnb.com.br.golpe.com/rooms/123",
    "https://www.airbnb.com.br/s/Uberlandia/homes",
    "https://www.airbnb.com.br/rooms/abc",
    "javascript:alert(1)",
    "texto qualquer",
  ]) {
    const r = lerLinkAirbnb(url);
    assert.equal(r.ok, false, url);
    if (!r.ok) assert.match(r.erro, /link do anúncio no Airbnb/);
  }
  assert.deepEqual(lerLinkAirbnb(""), { ok: false, vazio: true, erro: "" });
});

test("simulado: a mesma entrada dá sempre o mesmo valor, marcado como simulado", () => {
  const a = cotacaoSimulada("12345678");
  assert.deepEqual(a, cotacaoSimulada("12345678"));
  assert.equal(a.simulado, true);
  assert.ok(a.mensalTotal >= 2000 && a.mensalTotal <= 12000);
  assert.notEqual(cotacaoSimulada("87654321").mensalTotal, a.mensalTotal);
  assert.match(ROTULO_SIMULADO, /Simulação/);
});

test("comparação: mesma regra do selo (total do mês ≤ Airbnb), com a diferença", () => {
  const cot = { idAnuncio: "1", mensalTotal: 5000, simulado: true as const };
  assert.deepEqual(compararComAirbnb(4000, cot), { estado: "justo", diferenca: 1000, simulado: true });
  assert.deepEqual(compararComAirbnb(5000, cot), { estado: "justo", diferenca: 0, simulado: true });
  assert.deepEqual(compararComAirbnb(6000, cot), { estado: "acima", diferenca: 1000, simulado: true });
  assert.deepEqual(compararComAirbnb(0, cot), { estado: "sem_valor", diferenca: 0, simulado: true });
  assert.deepEqual(compararComAirbnb(4000, null), { estado: "sem_cotacao", diferenca: 0, simulado: false });
});

test("chave desligada: o campo só aparece com PRECO_JUSTO_COMPARADOR, e o link nunca vai para o anúncio publicado", () => {
  const flags = ler("src/lib/flags.ts");
  assert.match(flags, /export const PRECO_JUSTO_COMPARADOR = process\.env\.NEXT_PUBLIC_PRECO_JUSTO_COMPARADOR === "on";/);
  const etapa = ler("src/app/(dashboard)/dashboard/imoveis/novo/etapa-preco.tsx");
  assert.match(etapa, /\{PRECO_JUSTO_COMPARADOR && p\.setLinkAirbnb && \(\s*<CampoLinkAirbnb/);
  // Nada de fornecedor de verdade: o motor não faz fetch e o campo só usa a cotação simulada.
  const motor = ler("src/lib/comparador-airbnb/comparador.ts") + ler("src/components/precos/campo-link-airbnb.tsx");
  assert.doesNotMatch(motor, /fetch\(|https?:\/\/(?!www\.airbnb\.com\.br\/rooms)/);
  assert.match(ler("src/components/precos/campo-link-airbnb.tsx"), /cotacaoSimulada\(/);
  // O link fica só no rascunho (draft_data); não entra na gravação do imóvel.
  for (const f of ["src/lib/data/actions.ts", "src/lib/data/properties.ts", "src/lib/types.ts"])
    assert.doesNotMatch(ler(f), /linkAirbnb|airbnb_url|airbnb_link/, f);
});
