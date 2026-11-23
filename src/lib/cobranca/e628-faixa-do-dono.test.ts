// ORDEM-DUET-534 (Gerente, 22/11/2026): a última faixa PUBLICADA passa de "16 ou mais" / "16+" a "16–19" (a partir de 20, a linha de carteiras, sem percentual). As asserções deste arquivo que cobravam "16 ou mais" foram ajustadas por essa decisão; o cálculo não mudou.
/*
  E628 (complemento do E564): o simulador logado do dono nomeia a própria faixa, inclusive o Gestor (20+ imóveis), com o MESMO texto da /simulacao.
  Roda: node --test src/lib/cobranca/e628-faixa-do-dono.test.ts
  Asserções alteradas pelo prompt 078 (Daniel, 16/11/2026): a faixa do Gestor saiu da escada — são 4 faixas, a última é "16–19 imóveis"
  (6%); faixaDoDono devolve só { nome } (sem o detalhe do Gestor); a tela do simulador não tem mais "faixa-gestor-detalhe" nem o
  rótulo do Plano Gestor no destaque; a /simulacao (TAXA_FAIXAS) também não tem detalhe de Gestor.
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXAS_COMISSAO_PADRAO, faixaPorImoveisAtivos } from "./regra.ts";
import { faixaDoDono } from "./faixa-do-dono.ts";
import { TAXA_FAIXAS } from "../../config/premissas-financeiras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E628/078: cada faixa do dono tem nome; nenhuma traz detalhe de Gestor", () => {
  const nomes = FAIXAS_COMISSAO_PADRAO.map((f) => faixaDoDono(f).nome);
  // 078 (Daniel, 16/11/2026): antes […, "16–19 imóveis", "20+ imóveis · Plano Gestor"] — a escada termina em "16–19 imóveis".
  assert.deepEqual(nomes, ["1–2 imóveis", "3–5 imóveis", "6–15 imóveis", "16–19 imóveis"]);
  // 078 (Daniel, 16/11/2026): antes "só a faixa gestor traz o detalhe" (gestor !== null ⇔ f.gestor); agora NENHUMA faixa traz:
  // a resposta inteira é só { nome }, e nenhuma faixa padrão é marcada como Gestor.
  for (const f of FAIXAS_COMISSAO_PADRAO) {
    assert.deepEqual(faixaDoDono(f), { nome: nomes[FAIXAS_COMISSAO_PADRAO.indexOf(f)] }, String(f.minImoveis));
    assert.equal("gestor" in f, false, String(f.minImoveis));
  }
});

test("E628/078: com 20 imóveis ativos o dono vê a última faixa da escada (16–19 imóveis, 6%), sem Gestor — como na /simulacao", () => {
  const f = faixaPorImoveisAtivos(20);
  const d = faixaDoDono(f);
  // 078 (Daniel, 16/11/2026): antes 0.04 (Plano Gestor); 20 imóveis estão na faixa de 16–19 = 6%.
  assert.equal(f.taxa, 0.06);
  // 078 (Daniel, 16/11/2026): antes "20+ imóveis · Plano Gestor".
  assert.equal(d.nome, "16–19 imóveis");
  // 078 (Daniel, 16/11/2026): antes d.gestor = { carteira: "Gestor: 20+ imóveis ou administradora", detalhe: "cadastro assistido e
  // contato direto" }; o detalhe do Gestor saiu — a faixa do dono é só o nome.
  assert.deepEqual(d, { nome: "16–19 imóveis" });
  // 078 (Daniel, 16/11/2026): antes o detalhe era o MESMO texto da última linha da /simulacao (TAXA_FAIXAS); agora a última linha
  // pública é a mesma faixa (mesma taxa), por extenso, e também sem detalhe de Gestor.
  const publica = TAXA_FAIXAS[TAXA_FAIXAS.length - 1];
  // ORDEM-DUET-534: a /simulacao dos sócios é interna e mostra a faixa do CÁLCULO ("16 ou mais"); o nome que o dono vê é o
  // da faixa publicada ("16–19"). A taxa é a mesma.
  assert.deepEqual(publica, { taxa: f.taxa, carteira: "16 ou mais imóveis" });
  assert.equal(TAXA_FAIXAS.length, FAIXAS_COMISSAO_PADRAO.length);
  // 078 (Daniel, 16/11/2026): antes "19 ainda é a faixa de 6%, sem Gestor" (gestor === null); 19 e 20 agora são a MESMA faixa,
  // e a fronteira que sobrou é 15 → 16.
  assert.deepEqual(faixaDoDono(faixaPorImoveisAtivos(19)), d);
  assert.deepEqual(faixaDoDono(faixaPorImoveisAtivos(16)), d);
  assert.deepEqual(faixaDoDono(faixaPorImoveisAtivos(15)), { nome: "6–15 imóveis" });
});

test("E628/078: a tela do dono usa a função e o destaque diz só a taxa (sem o Plano Gestor)", () => {
  const t = ler("src/app/(dashboard)/dashboard/simulador/page.tsx");
  assert.match(t, /import \{ faixaDoDono \} from "@\/lib\/cobranca\/faixa-do-dono"/);
  assert.match(t, /const faixaNome = faixaDoDono\(faixa\);/);
  assert.match(t, /data-testid="faixa-nome"/);
  // 078 (Daniel, 16/11/2026): antes a tela TINHA o parágrafo data-testid="faixa-gestor-detalhe"; ele saiu com a faixa do Gestor.
  assert.doesNotMatch(t, /faixa-gestor-detalhe|faixaNome\.gestor/);
  // 078 (Daniel, 16/11/2026): antes /faixa\.gestor \? `${taxaTexto} · ${ROTULO_FAIXA_GESTOR}` : taxaTexto/ — o destaque é só a taxa.
  assert.match(t, /\{ label: "Taxa de serviço da sua faixa", valor: taxaTexto \},/);
  assert.doesNotMatch(t, /ROTULO_FAIXA_GESTOR|faixa\.gestor/);
  // o controle de imóveis ativos termina na última faixa
  assert.match(t, /max=\{FAIXAS_COMISSAO_PADRAO\[FAIXAS_COMISSAO_PADRAO\.length - 1\]\.minImoveis\}/);
  // 078 (Daniel, 16/11/2026): a última faixa começa em 16 (antes em 20, a do Gestor): o controle vai de 1 a 16.
  assert.equal(FAIXAS_COMISSAO_PADRAO[FAIXAS_COMISSAO_PADRAO.length - 1].minImoveis, 16);
});
