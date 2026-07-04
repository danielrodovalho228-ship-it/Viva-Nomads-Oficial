/**
 * Testes do modelo do Simulador — travam os números validados do produto.
 * Roda com o test runner nativo do Node (sem dependências):  `npm test`
 * (Node 22+ executa TypeScript diretamente via type stripping.)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PREMISSAS_PADRAO,
  VOLUMES_PADRAO,
  PROJECAO_PADRAO,
  CENARIOS,
  calcularMes,
  calcularProjecao,
  receitaCenario,
  formatBRL,
  formatPct,
} from "./model.ts";

test("mês com valores padrão — receita por fonte", () => {
  const r = calcularMes(PREMISSAS_PADRAO, VOLUMES_PADRAO);
  assert.equal(r.comissao, 2400, "comissão por aluguel");
  assert.equal(r.planos, 5160, "mensalidade dos planos");
  assert.equal(r.garantia, 900, "comissão de garantia");
  assert.equal(r.servicos, 200, "serviços");
  assert.equal(r.destaque, 180, "destaque");
  assert.equal(r.total, 8840, "receita total");
});

test("mês com valores padrão — indicadores (custo/lucro/margem/ROI)", () => {
  const r = calcularMes(PREMISSAS_PADRAO, VOLUMES_PADRAO);
  assert.equal(r.custo, 5200, "custo do mês");
  assert.equal(r.lucro, 3640, "lucro");
  assert.equal(formatPct(r.margem), "41%", "margem");
  assert.equal(formatPct(r.roi), "70%", "ROI");
});

test("projeção padrão (12 meses) — agregados", () => {
  const proj = calcularProjecao(PREMISSAS_PADRAO, PROJECAO_PADRAO);
  assert.equal(Math.round(proj.receitaAcumulada), 137397, "receita acumulada");
  assert.equal(Math.round(proj.lucroAcumulado), 70296, "lucro acumulado");
  assert.equal(Math.round(proj.baseFinal), 96, "base de planos no fim");
  assert.equal(Math.round(proj.receitaUltimoMes), 18938, "receita no último mês");
});

test("projeção padrão — formatação em R$ dos agregados", () => {
  const proj = calcularProjecao(PREMISSAS_PADRAO, PROJECAO_PADRAO);
  // Normaliza o espaço não separável do Intl para comparar com segurança.
  const norm = (s: string) => s.replace(/ /g, " ");
  assert.equal(norm(formatBRL(proj.receitaAcumulada)), "R$ 137.397");
  assert.equal(norm(formatBRL(proj.lucroAcumulado)), "R$ 70.296");
  assert.equal(norm(formatBRL(proj.receitaUltimoMes)), "R$ 18.938");
});

test("cenários (mesmas premissas, volumes diferentes)", () => {
  const [inicio, tracao, escala] = CENARIOS;
  assert.equal(receitaCenario(PREMISSAS_PADRAO, inicio), 4420, "Início");
  assert.equal(receitaCenario(PREMISSAS_PADRAO, tracao), 22840, "Tração");
  assert.equal(receitaCenario(PREMISSAS_PADRAO, escala), 86580, "Escala");
});

test("projeção respeita horizonte (clamp 1..60)", () => {
  assert.equal(calcularProjecao(PREMISSAS_PADRAO, { ...PROJECAO_PADRAO, horizonte: 0 }).meses.length, 1);
  assert.equal(calcularProjecao(PREMISSAS_PADRAO, { ...PROJECAO_PADRAO, horizonte: 99 }).meses.length, 60);
});

test("guardas de divisão por zero (receita/custo = 0)", () => {
  const zero = calcularMes(
    { ...PREMISSAS_PADRAO, custoFixo: 0, custoVariavel: 0 },
    { alugueisMes: 0, basePlanos: 0, contratosDestaque: 0 },
  );
  assert.equal(zero.total, 0);
  assert.equal(zero.margem, 0, "margem 0 quando receita 0");
  assert.equal(zero.roi, 0, "ROI 0 quando custo 0");
});
