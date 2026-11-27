/*
  E1111 (ORDEM-DUET-494; achados D2–D6 e a família da taxa de parceiro da auditoria da ORDEM-493): cópias à mão da
  escada de taxas (12/10/8/6; desde o Prompt 078, sem Gestor e com a linha das carteiras) e da taxa de serviço dos parceiros (10%, 90/10) fora das fontes.
  Fontes: lib/cobranca/regra.ts (FAIXAS_COMISSAO_PADRAO, escadaTaxasTexto, pctTexto, TEXTO_REGRA_UNICA,
  comissaoSobreContrato, escadaTaxasCurta, exemploCobranca, TAXA_MAIOR_TEXTO/TAXA_MENOR_TEXTO) e, para os parceiros, TAXA_SERVICO_PARCEIRO (lib/parceiros/regras.ts) com os textos de
  config/taxa-servico-parceiros.ts. Nas superfícies varridas não sobra nenhum percentual destes escrito à mão.
  Roda: node --test src/lib/cobranca/e1111-alinhamentos-dinheiro.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TAXA_MAIOR_TEXTO, TAXA_MENOR_TEXTO, TEXTO_REGRA_UNICA, escadaTaxasCurta, escadaTaxasTexto, exemploCobranca } from "./regra.ts";
import { TEXTO_CARTEIRAS } from "../../config/planos.ts";
import { ROTULO_TAXA_SERVICO_VIVA, TEXTO_DIVISAO_NA_ORIGEM } from "../../config/taxa-servico-parceiros.ts";
import { fonteSemComentarios as semComentarios } from "../fonte-sem-comentarios.ts";

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
  // Asserção alterada (ORDEM-DUET-533, adaptação ao #3882 / Prompt 078): antes `${escadaTaxasTexto()}` no assistente e no
  // FAQ, com o Plano Gestor; agora a escada curta da fonte (sem Gestor) seguida da linha das carteiras (TEXTO_CARTEIRAS).
  const prompt = readFileSync("src/lib/atendimento/viva-prompt.ts", "utf8");
  const faq = readFileSync("src/lib/atendimento/faq.ts", "utf8");
  assert.match(prompt, /const REGRA_PRECO_TEXTO = TEXTO_REGRA_UNICA;/);
  for (const [nome, s] of [["viva-prompt", prompt], ["faq", faq]] as const) {
    assert.match(s, /\$\{escadaTaxasCurta\(\)\}\. \$\{TEXTO_CARTEIRAS\}/, nome);
    assert.doesNotMatch(semComentarios(s), /Plano Gestor|FAIXA_GESTOR|PORTA_GESTOR_TEXTO/, `${nome}: o Plano Gestor saiu (Prompt 078)`);
  }
  assert.equal(escadaTaxasCurta(), "1–2 = 12%, 3–5 = 10%, 6–15 = 8%, 16–19 = 6%");
  assert.equal(TEXTO_CARTEIRAS, "Carteira a partir de 20 imóveis ou administradora de imóveis: fale com a Viva.");
  assert.ok(escadaTaxasTexto().includes("16–19 imóveis: 6%"));
  assert.ok(TEXTO_REGRA_UNICA.length > 0);
});

test("E1111 (ORDEM-533): o exemplo da cobrança no FAQ e no assistente é calculado pela regra — nenhum R$ escrito à mão", () => {
  const EX = exemploCobranca();
  assert.deepEqual(EX, { meses: 3, aluguel: "R$ 3.000", pct: "12%", total: "R$ 9.000", comissao: "R$ 1.080" });
  for (const f of ["src/lib/atendimento/viva-prompt.ts", "src/lib/atendimento/faq.ts"]) {
    const s = semComentarios(readFileSync(f, "utf8"));
    assert.match(s, /const EXEMPLO = exemploCobranca\(\);/, f);
    assert.doesNotMatch(s, /R\$ ?(?:1\.080|3\.000|9\.000)/, `${f}: exemplo escrito à mão`);
  }
});

test("E1111 (ORDEM-533): o atalho da home diz a escada pelas fontes do Prompt 078 (maior e menor taxa)", () => {
  const home = semComentarios(readFileSync("src/app/(public)/page.tsx", "utf8"));
  assert.match(home, /De \{TAXA_MAIOR_TEXTO\} a \{TAXA_MENOR_TEXTO\} por contrato\. Sem mensalidade\./);
  assert.doesNotMatch(home, /GESTOR_PRECO|GESTOR_PCT_HOME|Plano Gestor/);
  assert.equal(TAXA_MAIOR_TEXTO, "12%");
  assert.equal(TAXA_MENOR_TEXTO, "6%");
});

test("E1111: os textos da taxa de parceiro saem da fonte do valor (TAXA_SERVICO_PARCEIRO)", () => {
  assert.equal(ROTULO_TAXA_SERVICO_VIVA, "Taxa de serviço da Viva (10%)");
  // E1151: a "Regra 90/10" do formulário deu lugar à frase canónica da divisão (a mesma da secção de regras).
  assert.match(TEXTO_DIVISAO_NA_ORIGEM, /^Quando o pagamento pela plataforma estiver ativo, o valor é dividido na origem: 90% vai direto para você e 10% para a Viva\. A Viva não guarda o dinheiro\.$/);
  const cfg = semComentarios(readFileSync("src/config/taxa-servico-parceiros.ts", "utf8"));
  assert.deepEqual(cfg.match(LITERAL) ?? [], [], "a config deriva os números de TAXA_SERVICO_PARCEIRO");
});
