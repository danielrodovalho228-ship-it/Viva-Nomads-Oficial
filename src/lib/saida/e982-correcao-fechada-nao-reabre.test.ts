/*
  E982 (t316) — fechar a Correção abria outra igual na hora, com as mesmas saídas dos 30 dias: a regra só via as
  Correções ABERTAS, e a leitura seguinte do painel contava de novo as 4 saídas que a fechada já tinha tratado.
  Regra: uma Correção fechada trata as saídas até o fechamento; só saídas DEPOIS dele (mesmo papel e motivo) podem
  abrir a próxima. Roda: node --test src/lib/saida/e982-correcao-fechada-nao-reabre.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { motivosQueViramCorrecao, type SaidaRegistrada } from "./regras.ts";

const AGORA = new Date("2026-11-16T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA.getTime() - d * 86_400_000).toISOString();
const saida = (d: number, motivo = "parei_servico"): SaidaRegistrada => ({ papel: "parceiro", motivo, criadoEm: diasAtras(d), ajudaOferecida: false, revertida: false });
const quatro = [1, 5, 12, 20].map((d) => saida(d));

test("E982 — fechada depois das 4 saídas: não reabre com as mesmas saídas", () => {
  const fechada = { papel: "parceiro", motivo: "parei_servico", fechadaEm: diasAtras(0.5) };
  assert.deepEqual(motivosQueViramCorrecao(quatro, [fechada], AGORA), []);
});

test("E982 — depois do fechamento, só mais de 3 saídas NOVAS abrem a próxima", () => {
  const fechada = { papel: "parceiro", motivo: "parei_servico", fechadaEm: diasAtras(10) };
  // Antes do fechamento: 12 e 20 dias (não contam). Depois: 1 e 5 → 2, não basta.
  assert.deepEqual(motivosQueViramCorrecao(quatro, [fechada], AGORA), []);
  const novas = [0.2, 2, 3, 4].map((d) => saida(d));
  assert.deepEqual(motivosQueViramCorrecao([...quatro, ...novas], [fechada], AGORA), [{ papel: "parceiro", motivo: "parei_servico", n: 6 }]);
});

test("E982 — a fechada de um motivo não segura outro motivo; sem fechada, a regra de sempre", () => {
  const fechadaOutro = { papel: "parceiro", motivo: "outro_motivo", fechadaEm: diasAtras(0.5) };
  assert.deepEqual(motivosQueViramCorrecao(quatro, [fechadaOutro], AGORA), [{ papel: "parceiro", motivo: "parei_servico", n: 4 }]);
  assert.deepEqual(motivosQueViramCorrecao(quatro, [], AGORA), [{ papel: "parceiro", motivo: "parei_servico", n: 4 }]);
  assert.deepEqual(motivosQueViramCorrecao(quatro, [{ papel: "parceiro", motivo: "parei_servico" }], AGORA), []); // aberta
});

test("E982 — quem abre as Correções lê também as fechadas da janela", () => {
  const s = readFileSync("src/lib/data/qualidade.ts", "utf8");
  const fn = s.slice(s.indexOf("export async function abrirCorrecoesDevidas"), s.indexOf("\n}\n", s.indexOf("export async function abrirCorrecoesDevidas")));
  assert.match(fn, /select\("papel, motivo, fechada_em"\)\.or\(`fechada_em\.is\.null,fechada_em\.gte\.\$\{desde\}`\)/);
  assert.match(fn, /fechadaEm: c\.fechada_em/);
});
