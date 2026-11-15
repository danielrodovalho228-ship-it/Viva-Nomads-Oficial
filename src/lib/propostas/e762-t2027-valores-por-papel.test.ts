/*
  t2027 · Orçamentos (Pista 3, lote 2, item D2 — asserção corrigida pelo coordenador, ORDEM-DUET-068 ponto 5) @E51 @E762
  (sem @ao-vivo-seguro: valores e taxa). Regra: na proposta, o DONO vê dois fatos separados — o valor bruto que o morador
  paga a ele e a taxa de serviço, à parte — sem subtração, sem "líquido" e sem sinal de menos; o MORADOR vê o valor
  mensal, os encargos e os totais, e nunca a taxa. (A guarda E51/E762 vem do modelo: a Viva só conecta e não segura
  dinheiro; uma linha de resultado leria como retenção.)
  Renderiza a tela REAL (proposta-detalhe.tsx) com os totais das regras REAIS e a taxa calculada por taxaServicoProposta;
  e confere no lerProposta (Server Action) que só o papel "owner" recebe a taxa. Dublês só nas bordas
  (ver e722-tela-harness/). A taxa nunca na resposta para o morador também está em src/lib/taxa-matriz.test.ts (5).
  Roda: node --test src/lib/propostas/e762-t2027-valores-por-papel.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TERMOS_BASE, proposta, renderizar, textoDe } from "./e722-tela-harness/proposta.ts";
import { calcularTotais, taxaServicoProposta } from "./regras.ts";

const PCT = 0.12;
const tot = calcularTotais(TERMOS_BASE);
const TAXA = { pct: PCT, valor: taxaServicoProposta(TERMOS_BASE, PCT), congelada: false, valorMensal: tot.valorMensal, meses: tot.dias / 30, seAceitaHoje: null, caiu: null };
const brl = (n: number) => `R$ ${Math.round(n).toLocaleString("pt-BR")}`;

test("D2: o dono vê o bruto que o morador paga e a taxa de serviço à parte — dois fatos, sem subtração", () => {
  const t = textoDe(renderizar(proposta({ papel: "owner", status: "enviada", taxa: TAXA })));
  // Fato 1: o que o morador paga (bruto), nas linhas do morador.
  assert.ok(t.includes(`Total do contrato ${brl(tot.totalContrato)}`), t.slice(0, 600));
  // Fato 2: a taxa, num painel só do dono, com a base escrita.
  assert.match(t, /Só você vê Taxa de serviço: 12% sobre o valor mensal × meses/);
  assert.ok(t.includes(`= ${brl(TAXA.valor)}`), `taxa ${brl(TAXA.valor)} em ${t}`);
  // Sem resultado (bruto − taxa), sem "líquido", sem sinal de menos.
  assert.doesNotMatch(t, /l[íi]quid/i);
  assert.doesNotMatch(t, /[−–-]\s*R\$/);
  assert.equal(t.includes(brl(tot.totalContrato - TAXA.valor)), false, "nenhuma linha com bruto − taxa");
  assert.equal(t.includes(brl(tot.valorMensal * 6 - TAXA.valor)), false, "nenhuma linha com aluguel − taxa");
  assert.doesNotMatch(t, /você recebe[^.]*(menos|descontad|retid)/i);
});

test("D2: o morador vê mensal, encargos e totais — e nenhuma taxa de serviço", () => {
  const t = textoDe(renderizar(proposta({ papel: "tenant", status: "enviada", taxa: null })));
  for (const r of ["Mensal R$ 3.000", "Condomínio R$ 450/mês", "Consumo estimado R$ 200/mês", `Total por mês (com contas) ${brl(tot.totalMensal)}`, `Total do contrato ${brl(tot.totalContrato)}`])
    assert.ok(t.includes(r), `falta "${r}" em ${t.slice(0, 500)}`);
  assert.doesNotMatch(t, /Taxa de servi[çc]o|Só você vê/);
  assert.equal(t.includes(brl(TAXA.valor)), false, "o valor da taxa não aparece para o morador");
});

test("D2: no servidor, só o papel 'owner' recebe a taxa na vista da proposta (o morador recebe null)", () => {
  const src = readFileSync(new URL("../data/propostas-actions.ts", import.meta.url), "utf8");
  const ler = src.slice(src.indexOf("let taxa: PropostaView[\"taxa\"] = null;"), src.indexOf("let taxa: PropostaView[\"taxa\"] = null;") + 300);
  assert.match(ler, /^let taxa: PropostaView\["taxa"\] = null;\s*if \(papel === "owner"\) \{/);
});
