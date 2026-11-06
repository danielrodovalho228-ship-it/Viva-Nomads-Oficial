/*
  E628 (complemento do E564): o simulador logado do dono nomeia a própria faixa, inclusive o Gestor (20+ imóveis), com o MESMO texto da /simulacao.
  Roda: node --test src/lib/cobranca/e628-faixa-do-dono.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FAIXAS_COMISSAO_PADRAO, faixaPorImoveisAtivos } from "./regra.ts";
import { faixaDoDono } from "./faixa-do-dono.ts";
import { TAXA_FAIXAS } from "../../config/premissas-financeiras.ts";

const ler = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");

test("E628: cada faixa do dono tem nome; só a do Gestor traz o detalhe", () => {
  const nomes = FAIXAS_COMISSAO_PADRAO.map((f) => faixaDoDono(f).nome);
  assert.deepEqual(nomes, ["1–2 imóveis", "3–5 imóveis", "6–15 imóveis", "16–19 imóveis", "20+ imóveis · Plano Gestor"]);
  for (const f of FAIXAS_COMISSAO_PADRAO) assert.equal(faixaDoDono(f).gestor !== null, f.gestor === true, String(f.minImoveis));
});

test("E628: com 20 imóveis ativos (o fim do controle) o dono vê o Gestor, 4%, com o texto da /simulacao", () => {
  const f = faixaPorImoveisAtivos(20);
  const d = faixaDoDono(f);
  assert.equal(f.taxa, 0.04);
  assert.equal(d.nome, "20+ imóveis · Plano Gestor");
  assert.deepEqual(d.gestor, { carteira: "Gestor: 20+ imóveis ou administradora", detalhe: "cadastro assistido e contato direto" });
  // o mesmo texto que a /simulacao pública usa (TAXA_FAIXAS), não uma cópia
  const publica = TAXA_FAIXAS[TAXA_FAIXAS.length - 1];
  assert.equal(d.gestor!.carteira, publica.carteira);
  assert.equal(d.gestor!.detalhe, publica.detalhe);
  assert.equal(faixaDoDono(faixaPorImoveisAtivos(19)).gestor, null); // 19 ainda é a faixa de 6%
});

test("E628: a tela do dono usa a função e o destaque nomeia o Plano Gestor", () => {
  const t = ler("src/app/(dashboard)/dashboard/simulador/page.tsx");
  assert.match(t, /import \{ faixaDoDono \} from "@\/lib\/cobranca\/faixa-do-dono"/);
  assert.match(t, /const faixaNome = faixaDoDono\(faixa\);/);
  assert.match(t, /data-testid="faixa-nome"/);
  assert.match(t, /data-testid="faixa-gestor-detalhe"/);
  assert.match(t, /faixa\.gestor \? `\$\{taxaTexto\} · \$\{ROTULO_FAIXA_GESTOR\}` : taxaTexto/);
  // o controle de imóveis ativos termina na faixa do Gestor
  assert.match(t, /max=\{FAIXAS_COMISSAO_PADRAO\[FAIXAS_COMISSAO_PADRAO\.length - 1\]\.minImoveis\}/);
});
