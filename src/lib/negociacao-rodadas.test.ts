import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AJUDA_VALOR_CONTRAPROPOSTA, MAX_VERSOES, TEXTO_TETO_RODADAS, TEXTO_ULTIMA_RODADA, ehUltimaRodada, rotuloRodada } from "./propostas/regras.ts";
import { avisoAbaixoDoMinimo } from "./anuncio/negociacao.ts";

/*
  Ajuste de texto do coordenador (reteste do #866): a lógica do piso não muda (servidor, no envio; o piso é privado).
   1. ajuda sob o valor da contraproposta do interessado; 2. teto de rodadas no editor e na tela da proposta;
   3. guarda: o piso nunca chega ao navegador do interessado.
*/
const ler = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const DETALHE = "../app/(dashboard)/dashboard/propostas/[id]/proposta-detalhe.tsx";

test("1. ajuda sob o valor da contraproposta, só para o interessado", () => {
  assert.equal(AJUDA_VALOR_CONTRAPROPOSTA, "Se o valor ficar abaixo do que o proprietário aceita, avisamos quando você enviar.");
  const d = ler(DETALHE);
  assert.match(d, /\{p\.papel === "tenant" && \(\s*<span[^>]*data-testid="contra-valor-ajuda">\s*\{AJUDA_VALOR_CONTRAPROPOSTA\}/);
});

test("2. teto de rodadas: editor do anúncio, 'Rodada N de 3' e 'Última rodada' na tela da proposta", () => {
  assert.equal(MAX_VERSOES, 3);
  assert.equal(TEXTO_TETO_RODADAS, "A negociação tem até 3 rodadas (proposta e duas contrapropostas). Depois, cada lado só aceita ou recusa.");
  assert.match(ler("../components/anuncio/blocos-cadastro.tsx"), /data-testid="negociacao-rodadas">\s*\{TEXTO_TETO_RODADAS\}/);
  assert.equal(rotuloRodada(1), "Rodada 1 de 3");
  assert.equal(rotuloRodada(2), "Rodada 2 de 3");
  assert.equal(rotuloRodada(3), "Rodada 3 de 3");
  assert.equal(TEXTO_ULTIMA_RODADA, "Última rodada: depois desta resposta, só aceitar ou recusar");
  // A próxima resposta é a última contraproposta: versão atual 2, proposta em andamento.
  assert.equal(ehUltimaRodada(1, true), false);
  assert.equal(ehUltimaRodada(2, true), true);
  assert.equal(ehUltimaRodada(3, true), false); // na 3ª já só dá para aceitar ou recusar (bloqueio da contraproposta)
  assert.equal(ehUltimaRodada(2, false), false);
  const d = ler(DETALHE);
  // Para os dois lados: fora do bloco "podeResponder".
  assert.ok(d.indexOf('data-testid="proposta-rodada"') < d.indexOf("{p.podeResponder && ("));
  assert.match(d, /ehUltimaRodada\(atual\.versao, estaAberta\(p\.status\)\)/);
});

test("3. piso: a lógica continua no servidor, no envio; a resposta dá só a próxima centena", () => {
  assert.deepEqual(avisoAbaixoDoMinimo(2500, 2900), { tenteAPartirDe: 3000 });
  // Desconto de longa estadia: a comparação é com o valor FINAL (R$ 3.050 − 6% = R$ 2.867 < R$ 2.900).
  assert.ok(avisoAbaixoDoMinimo(Math.round(3050 * 0.94), 2900));
  const acoes = ler("./data/propostas-actions.ts");
  assert.match(acoes, /avisoAbaixoDoMinimo\(calcularTotais\(nova\)\.valorMensal, lim\?\.valor_minimo/);
  assert.match(acoes, /aviso: `Abaixo do que o proprietário aceita; tente a partir de \$\{brl\(abaixo\.tenteAPartirDe\)\}\.`/);
  // A única leitura do piso nas ações de proposta é a da comparação; nenhuma tela do interessado o conhece.
  // (a leitura e o uso na mesma comparação: duas linhas seguidas)
  assert.equal(acoes.split("\n").filter((l) => l.includes("valor_minimo")).length, 2);
  for (const f of [DETALHE, "../app/(dashboard)/dashboard/propostas/[id]/page.tsx", "./propostas/regras.ts"]) {
    assert.doesNotMatch(ler(f), /valor_minimo|valorMinimo/, f);
  }
});
