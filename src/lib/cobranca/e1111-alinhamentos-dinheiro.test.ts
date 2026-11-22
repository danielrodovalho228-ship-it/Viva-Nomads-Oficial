/*
  E1111 (ORDEM-DUET-494; achados D2–D6 e a família da taxa de parceiro da auditoria da ORDEM-493): cópias à mão da
  escada de taxas (12/10/8/6, Gestor 4%) e da taxa de serviço dos parceiros (10%, 90/10) fora das fontes.
  Fontes: lib/cobranca/regra.ts (FAIXAS_COMISSAO_PADRAO, escadaTaxasTexto, pctTexto, TEXTO_REGRA_UNICA, FAIXA_GESTOR,
  comissaoSobreContrato) e, para os parceiros, TAXA_SERVICO_PARCEIRO (lib/parceiros/regras.ts) com os textos de
  config/taxa-servico-parceiros.ts. Nas superfícies varridas não sobra nenhum percentual destes escrito à mão.
  Roda: node --test src/lib/cobranca/e1111-alinhamentos-dinheiro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TEXTO_REGRA_UNICA, escadaTaxasTexto } from "./regra.ts";
import { ROTULO_TAXA_SERVICO_VIVA, TEXTO_DIVISAO_NA_ORIGEM, TEXTO_REGRA_90_10 } from "../../config/taxa-servico-parceiros.ts";

const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ [^\n"`]*$/gm, "");
const LITERAL = /(?<![\d,.])(?:4|6|8|10|12|90) ?%|12\/10\/8\/6/g;

const SUPERFICIES = [
  "src/app/(public)/page.tsx", // D2 (home)
  "src/lib/atendimento/viva-prompt.ts", // D3, D4 (assistente)
  "src/lib/atendimento/faq.ts", // D4 (FAQ)
  "src/lib/atendimento/parceiros-texto.ts", // D5
  "src/app/(dashboard)/dashboard/servicos/pedidos/[id]/pedido-tela.tsx", // parceiros
  "src/components/parceiros/pedidos-do-parceiro.tsx",
  "src/app/(dashboard)/dashboard/parceiro/painel-parceiro.tsx",
  "src/lib/conta/tela-pagamentos.ts",
  "src/lib/parceiros/pedido.ts",
];

test("E1111: nenhuma cópia à mão da escada nem da taxa de parceiro nas superfícies varridas", () => {
  for (const f of SUPERFICIES) {
    const achados = semComentarios(readFileSync(f, "utf8")).match(LITERAL) ?? [];
    assert.deepEqual(achados, [], `${f}: ${achados.join(", ")}`);
  }
});

test("E1111 (D6): o corpo de /precos tira o 12% da fonte (o título fica literal para os testes de SEO)", () => {
  const p = readFileSync("src/app/(public)/precos/page.tsx", "utf8");
  const corpo = semComentarios(p.slice(p.indexOf("export default")));
  assert.deepEqual(corpo.match(LITERAL) ?? [], []);
  assert.match(corpo, /\{pctTexto\(TAXA_COMISSAO_PADRAO\)\} sobre o valor total do contrato fechado/);
});

test("E1111: as frases derivam das fontes — a regra única no assistente, a escada no FAQ e no assistente", () => {
  const prompt = readFileSync("src/lib/atendimento/viva-prompt.ts", "utf8");
  assert.match(prompt, /const REGRA_PRECO_TEXTO = TEXTO_REGRA_UNICA;/);
  assert.match(prompt, /\$\{escadaTaxasTexto\(\)\}/);
  assert.match(readFileSync("src/lib/atendimento/faq.ts", "utf8"), /\$\{escadaTaxasTexto\(\)\}/);
  assert.ok(escadaTaxasTexto().includes("16–19 imóveis: 6%"));
  assert.ok(TEXTO_REGRA_UNICA.length > 0);
});

test("E1111: os textos da taxa de parceiro saem da fonte do valor (TAXA_SERVICO_PARCEIRO)", () => {
  assert.equal(ROTULO_TAXA_SERVICO_VIVA, "Taxa de serviço da Viva (10%)");
  assert.equal(TEXTO_REGRA_90_10, "Regra 90/10: de cada serviço, 90% ficam com você e 10% são a taxa de serviço da Viva.");
  assert.match(TEXTO_DIVISAO_NA_ORIGEM, /^Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: 90% vai direto para você e 10% para a Viva\.$/);
  const cfg = semComentarios(readFileSync("src/config/taxa-servico-parceiros.ts", "utf8"));
  assert.deepEqual(cfg.match(LITERAL) ?? [], [], "a config deriva os números de TAXA_SERVICO_PARCEIRO");
});
