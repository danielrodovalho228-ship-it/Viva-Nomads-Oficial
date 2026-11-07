import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lembretesDeEntrega } from "./lembretes-entrega.ts";
import { agruparInstrucoes } from "./instrucoes.ts";

// E662 (tela): uma instrução de saída, igual para morador e dono; falhas físicas como LEMBRETE do dono.
test("E662: a instrução de saída tem bloco próprio e vem logo depois do 'Como entrar'", () => {
  const g = agruparInstrucoes({ como_entrar: "Portaria", instrucao_saida: "Chave na recepção até as 11 h", observacoes: "x" });
  assert.deepEqual(g.map((x) => x.grupo), ["entrada", "saida", "imovel"]);
  assert.equal(g[1].titulo, "Como sair (check-out)");
  assert.equal(g[1].campos[0].valor, "Chave na recepção até as 11 h");
});

test("E662: bateria da fechadura e imóvel liberado são lembretes (sem 'feito'); a instrução de saída só lembra quando falta", () => {
  const sem = lembretesDeEntrega({ instrucaoSaidaPreenchida: false });
  assert.deepEqual(sem.map((l) => l.chave), ["saida", "fechadura", "liberado"]);
  assert.deepEqual(lembretesDeEntrega({ instrucaoSaidaPreenchida: true }).map((l) => l.chave), ["fechadura", "liberado"]);
  for (const l of sem) assert.ok(!("feito" in l), l.chave);
  assert.match(sem[1].texto, /condomínio/);
});

test("E662: o mesmo componente mostra a saída para morador, dono e convidado; o lembrete é só do dono e fora do checklist", () => {
  const dono = readFileSync("src/app/(dashboard)/dashboard/estadia/[contratoId]/page.tsx", "utf8");
  const conv = readFileSync("src/app/(dashboard)/dashboard/estadia/[contratoId]/convidado/page.tsx", "utf8");
  assert.match(dono, /<InstrucoesEmBlocos /);
  assert.match(conv, /<InstrucoesEmBlocos /);
  assert.match(dono, /\{dono && \(\s*<div className="mt-4 border-t border-line pt-4" data-testid="estadia-lembretes">/);
  const lista = dono.slice(dono.indexOf("e.checklist.map"), dono.indexOf("</ul>", dono.indexOf("e.checklist.map")));
  assert.doesNotMatch(lista, /lembrete/);
});
