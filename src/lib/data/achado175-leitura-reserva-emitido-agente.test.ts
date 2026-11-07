/*
  Auditoria de erros e estados vazios, achado nº 175 (reservas, documentos emitidos e agentes): a falha de LEITURA no banco
  não pode virar "Imóvel não encontrado", "Documento não encontrado" nem "Agente não encontrado" — a pessoa concluiria que o
  registro não existe, quando só não foi possível ler. Cada ação lê o erro e responde "Não foi possível ler … agora."
  Roda: node --test src/lib/data/achado175-leitura-reserva-emitido-agente.test.ts
*/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ler = (arq: string) => readFileSync(new URL(`./${arq}`, import.meta.url), "utf8");

test("175a: solicitarReserva — falha ao ler o imóvel não vira 'Imóvel não encontrado'", () => {
  const s = ler("reservas-actions.ts");
  const bloco = s.slice(s.indexOf("const { data: imovel"), s.indexOf('return { ok: false, error: "Imóvel não encontrado." }') + 80);
  assert.match(bloco, /const \{ data: imovel, error: erroImovel \}/);
  assert.match(bloco, /if \(erroImovel\) return \{ ok: false, error: "Não foi possível ler o imóvel agora\. Tente de novo\." \};/);
  assert.ok(bloco.indexOf("erroImovel)") < bloco.indexOf(`error: "Imóvel não encontrado."`), "o erro é conferido antes de dizer 'não encontrado'");
});

test("175b: reenviarEmitido — falha ao ler o documento não vira 'Documento não encontrado'", () => {
  const s = ler("emitidos-actions.ts");
  const bloco = s.slice(s.indexOf("const { data: reg"), s.indexOf('"Documento não encontrado."') + 40);
  assert.match(bloco, /const \{ data: reg, error: erroReg \}/);
  assert.match(bloco, /if \(erroReg\) return \{ ok: false, error: "Não foi possível ler o documento agora\. Tente de novo\." \};/);
});

test("175c: ordem ao agente — falha ao ler o agente não vira 'Agente não encontrado'", () => {
  const s = ler("agentes-actions.ts");
  const bloco = s.slice(s.indexOf("const { data: ag"), s.indexOf('"Agente não encontrado."') + 30);
  assert.match(bloco, /const \{ data: ag, error: erroAg \}/);
  assert.match(bloco, /if \(erroAg\) return \{ ok: false, erro: "Não foi possível ler o agente agora\. Tente de novo\." \};/);
});
