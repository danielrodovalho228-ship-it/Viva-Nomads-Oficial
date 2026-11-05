/*
  E556 (reprova de 05/11, rascunho "[TESTE QA] 1379 Studio no Santa Mônica", 31e6ce6d) — o card de Meus imóveis dizia
  "Anúncio 50% completo" com "Garantia aceita" entre as faltas; a revisão do MESMO rascunho, "57% pronto" sem ela; e a
  lista do card mudava entre dois carregamentos. Em produção (leitura): garantias_aceitas = [] na coluna e
  draft_data.garantias.caucao_avista = true. O card lia as COLUNAS (algumas só gravadas ao publicar) e corrigia só a
  internet e a privacidade pelo draft_data; quando a leitura do draft_data falhava, caía calado nas colunas — daí a
  lista que mudava. Correção (uma fonte):
    • fatosDoRascunho lê do draft_data TODOS os itens que o editor lê do próprio estado (endereço, detalhes, período,
      fotos, título, preço, garantia, privacidade, descrição, selo, vídeo, tipo de entrada, internet, proximidades);
      chave ausente = rascunho antigo → fica o que veio do banco;
    • o editor calcula a prontidão pela MESMA função, a partir do mesmo objeto que grava no draft_data;
    • sem conseguir ler o draft_data, o card não mostra um percentual de outra fonte (nada aparece até a próxima leitura).
  Roda: node --test src/lib/anuncio/e556-fonte-unica.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fatosDoRascunho } from "./fatos-do-rascunho.ts";
import { prontidaoAnuncio, type FatosAnuncio } from "./prontidao.ts";

// Fatos das COLUNAS do 31e6ce6d: garantias_aceitas = [], internet_mbps = null, sem_cameras_interior = false.
const colunas = (): FatosAnuncio => ({
  enderecoOk: true, detalhesOk: true, periodoOk: true, fotos: 8, titulo: "[TESTE QA] 1379 Studio no Santa Mônica", preco: 3200,
  garantiaOk: false, sublocacaoOk: true, privacidadeOk: false, operacao: "own", documento: "none",
  descricao: "x".repeat(154), selo: false, video: false, internetOk: false, tipoEntradaOk: false,
});
// O draft_data do mesmo rascunho (as chaves que o editor grava).
const rascunho = {
  title: "[TESTE QA] 1379 Studio no Santa Mônica", street: "Rua A", numero: "10", neighborhood: "Santa Mônica", city: "Uberlândia",
  bathrooms: "2", areaM2: "90", minPeriod: "30", monthlyPrice: "3200", description: "x".repeat(154),
  garantias: { caucao_avista: true, caucao_parcelada: false, seguro_fianca: false },
  privacidade: { semCamerasInterior: false }, internetMbps: "", qual: { baseBadge: false },
  videoUrl: "", videoArquivo: "", photos: Array.from({ length: 8 }, (_, i) => ({ url: `https://x/${i}.jpg` })), manualProximities: [],
};

test("31e6ce6d: a garantia marcada no rascunho conta no card (como na revisão)", () => {
  const p = prontidaoAnuncio(fatosDoRascunho(rascunho, colunas()));
  assert.ok(p.obrigatorios.find((i) => i.key === "garantia")?.ok, "garantia aceita no draft_data");
  assert.ok(!p.faltam.some((x) => /garantia/i.test(x)), p.faltam.join(" | "));
});

test("cada item que o editor lê do estado sai do draft_data (chave presente vence a coluna)", () => {
  const f = fatosDoRascunho(
    { ...rascunho, street: "", bathrooms: "0", minPeriod: "", monthlyPrice: "0", title: "Ti", description: "curta", photos: [], garantias: {}, qual: { baseBadge: true }, videoUrl: "https://youtu.be/dQw4w9WgXcQ", tipoEntrada: "fechadura_com_codigo" },
    { ...colunas(), garantiaOk: true, selo: false },
  );
  assert.equal(f.enderecoOk, false);
  assert.equal(f.detalhesOk, false);
  assert.equal(f.periodoOk, false);
  assert.equal(f.preco, 0);
  assert.equal(f.titulo, "Ti");
  assert.equal(f.descricao, "curta");
  assert.equal(f.fotos, 0);
  assert.equal(f.garantiaOk, false);
  assert.equal(f.selo, true);
  assert.equal(f.video, true);
  assert.equal(f.tipoEntradaOk, true);
});

test("rascunho antigo (sem as chaves): fica o que veio do banco", () => {
  assert.deepEqual(fatosDoRascunho({}, colunas()), colunas());
});

test("o editor calcula pela MESMA função, a partir das chaves que grava no draft_data", () => {
  const ed = readFileSync("src/app/(dashboard)/dashboard/imoveis/novo/page.tsx", "utf8");
  assert.match(ed, /const prontidao = prontidaoAnuncio\(\s*fatosDoRascunho\(/);
  assert.match(ed, /import \{ fatosDoRascunho \} from "@\/lib\/anuncio\/fatos-do-rascunho";/);
});

test("sem ler o draft_data, o card não mostra um percentual de outra fonte (estável entre carregamentos)", () => {
  const s = readFileSync("src/lib/anuncio/prontidao-servidor.ts", "utf8");
  assert.match(s, /if \(e\) \{\s*semRascunho\.add\(p\.id\);/);
  assert.match(s, /if \(e\) \(\{ data: priv, error: e \} = await lerRascunho\(p\.id\)\);/);
  assert.match(s, /for \(const id of semRascunho\) mapa\.delete\(id\);/);
});
